import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from './s3.service';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private s3Service: S3Service) {}

  async uploadFile(file: any, user: any) {
    try {
      const buffer = await file.toBuffer();
      const filename = file.filename;
      const mimetype = file.mimetype;

      // Генерируем уникальное имя файла
      const ext = path.extname(filename);
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

      // Определяем папку в зависимости от типа файла
      let folder = 'documents';
      if (mimetype.startsWith('image/')) {
        folder = 'images';
      } else if (mimetype.startsWith('audio/')) {
        folder = 'recordings';
      }

      const key = `${folder}/${uniqueFilename}`;

      // Загружаем в S3
      await this.s3Service.uploadFile(key, buffer, mimetype);

      this.logger.log(`File uploaded: ${key} by user ${user.userId}`);

      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          key,
          filename,
          url: await this.s3Service.getDownloadUrl(key),
        },
      };
    } catch (error) {
      this.logger.error(`Upload error: ${error.message}`, error.stack);
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
    return this.s3Service.getFileStream(key);
  }

  async deleteFile(key: string) {
    await this.s3Service.deleteFile(key);

    return {
      success: true,
      message: 'File deleted successfully',
    };
  }

  async getDownloadUrl(key: string) {
    const url = await this.s3Service.getDownloadUrl(key);

    return {
      success: true,
      data: { url },
    };
  }
}














