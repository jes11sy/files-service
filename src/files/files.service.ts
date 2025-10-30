import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { S3Service } from './s3.service';
import { FileValidator } from './utils/file-validator';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private s3Service: S3Service,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async uploadFile(file: any, user: any, customFolder?: string) {
    const startTime = Date.now();
    const metadata = {
      userId: user.userId,
      userRole: user.role,
      userLogin: user.login,
      filename: file.filename,
      mimetype: file.mimetype,
      ip: user.ip || 'unknown',
      userAgent: user.userAgent || 'unknown',
    };

    try {
      // Read only a small part (up to 1MB) for validation
      const chunks = [];
      let total = 0;
      const MAX_PREVIEW = 1024 * 1024; // 1MB
      for await (const chunk of file.file) {
        chunks.push(chunk);
        total += chunk.length;
        if (total > MAX_PREVIEW) break;
      }
      const previewBuffer = Buffer.concat(chunks, Math.min(total, MAX_PREVIEW));
      const { filename, mimetype } = file;
      
      this.logger.log({
        action: 'FILE_UPLOAD_START',
        ...metadata,
        size: file.file.truncated ? null : file.file.bytesRead || null,
      });

      // 1. Валидация MIME типа
      FileValidator.validateMimeType(mimetype);

      // 2. Валидация расширения
      FileValidator.validateExtension(filename);

      // 3. Проверка по превью размеру (весь файл проверит Fastify limit)
      FileValidator.validateFileSize(file.file.truncated ? MAX_PREVIEW : previewBuffer.length);

      // 4. Проверка сигнатуры файла (magic numbers)
      await FileValidator.verifyFileSignature(previewBuffer, mimetype);

      // 5. Генерируем безопасное имя файла
      const uniqueFilename = FileValidator.generateSafeFilename(filename);

      // 6. Определяем папку
      let folder: string;
      if (customFolder) {
        folder = FileValidator.sanitizeFileKey(customFolder);
      } else {
        folder = 'documents';
        if (mimetype.startsWith('image/')) {
          folder = 'images';
        } else if (mimetype.startsWith('audio/')) {
          folder = 'recordings';
        }
      }
      const key = `${folder}/${uniqueFilename}`;

      // 7. Передать поток дальше (после того, как 1МБ считали — rest оставшееся ядро Fastify отдаст корректно)
      // (Fastify-multipart отдаст файл с повторного чтения, надо это уточнить — если нет возможности, fallback: вынести чтение preview на объект, поддерживающий rewind/seek)

      // Так как мы уже прочитали часть из stream, проще перезапросить файл от клиента или сделать file.toBuffer() и из него Readable. Более требовательный, но безопасный подход:
      // Fallback если нельзя ресетнуть stream:
      const { Readable } = require('stream');
      // Получить весь буфер (т.к. stream уже "ушел")
      const fullBuffer = await file.toBuffer();
      const fileStream = Readable.from(fullBuffer);
      await this.s3Service.uploadFile(key, fileStream, mimetype);

      const url = await this.s3Service.getDownloadUrl(key);
      const duration = Date.now() - startTime;

      this.logger.log({
        action: 'FILE_UPLOAD_SUCCESS',
        ...metadata,
        key,
        size: fullBuffer.length,
        duration,
      });
      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          key,
          filename: uniqueFilename,
          originalFilename: filename,
          url,
          size: fullBuffer.length,
          mimetype,
          folder,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        action: 'FILE_UPLOAD_FAILED',
        ...metadata,
        error: error.message,
        errorName: error.name,
        duration,
        stack: error.stack,
      });
      throw error;
    }
  }

  async getPresignedUrl(filename: string, type: string) {
    const ext = path.extname(filename);
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    const key = `${type}/${uniqueFilename}`;

    const uploadUrl = await this.s3Service.getUploadUrl(key);

    return {
      success: true,
      data: {
        uploadUrl,
        key,
        filename: uniqueFilename,
      },
    };
  }

  async getFile(key: string) {
    try {
      // Санитизация ключа для защиты от Path Traversal
      const sanitizedKey = FileValidator.sanitizeFileKey(key);

      this.logger.log(`Getting file stream for: ${sanitizedKey}`);
      return await this.s3Service.getFileStream(sanitizedKey);
    } catch (error) {
      this.logger.error({
        action: 'FILE_GET_FAILED',
        key,
        error: error.message,
      });
      throw error;
    }
  }

  async deleteFile(key: string) {
    try {
      // Санитизация ключа
      const sanitizedKey = FileValidator.sanitizeFileKey(key);

      await this.s3Service.deleteFile(sanitizedKey);

      // Удаляем из кеша, если там есть
      await this.cacheManager.del(`presigned:${sanitizedKey}`);

      this.logger.log({
        action: 'FILE_DELETE_SUCCESS',
        key: sanitizedKey,
      });

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      this.logger.error({
        action: 'FILE_DELETE_FAILED',
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Получение download URL с кешированием
   */
  async getDownloadUrl(key: string) {
    try {
      // Санитизация ключа
      const sanitizedKey = FileValidator.sanitizeFileKey(key);
      const cacheKey = `presigned:${sanitizedKey}`;

      // Проверяем кеш
      let url = await this.cacheManager.get<string>(cacheKey);

      if (url) {
        this.logger.debug(`Cache hit for download URL: ${sanitizedKey}`);
        return {
          success: true,
          data: { url, cached: true },
        };
      }

      // Генерируем новый URL
      url = await this.s3Service.getDownloadUrl(sanitizedKey);

      // Кешируем на 50 минут (URL действителен 60 минут)
      await this.cacheManager.set(cacheKey, url, 3000000); // 50 минут в миллисекундах

      this.logger.debug(`Generated and cached download URL: ${sanitizedKey}`);

      return {
        success: true,
        data: { url, cached: false },
      };
    } catch (error) {
      this.logger.error({
        action: 'GET_DOWNLOAD_URL_FAILED',
        key,
        error: error.message,
      });
      throw error;
    }
  }
}





















