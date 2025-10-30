import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import * as https from 'https';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    // Валидация обязательных переменных окружения
    const requiredEnvVars = [
      'S3_BUCKET_NAME',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_REGION',
    ];

    const missing = requiredEnvVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required S3 environment variables: ${missing.join(', ')}`,
      );
    }

    this.bucketName = process.env.S3_BUCKET_NAME;

    // Connection pooling для производительности
    const agent = new https.Agent({
      keepAlive: true,
      maxSockets: 50, // Максимум параллельных соединений
      maxFreeSockets: 10, // Поддерживать 10 свободных соединений
      timeout: 60000, // 60 секунд таймаут
      keepAliveMsecs: 1000, // Интервал keep-alive
    });

    // Инициализация S3 Client с оптимизациями
    this.s3Client = new S3Client({
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      endpoint: process.env.S3_ENDPOINT, // Для MinIO, DigitalOcean Spaces и т.д.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      // Retry механизм
      maxAttempts: 3,
      retryMode: 'adaptive',
      // Connection pooling
      requestHandler: new NodeHttpHandler({
        httpsAgent: agent,
        connectionTimeout: 3000, // 3 секунды на установку соединения
        requestTimeout: 30000, // 30 секунд на выполнение запроса
      }),
    });

    this.logger.log('✅ S3 Service initialized with connection pooling');
  }

  /**
   * Проверка доступа к S3 bucket при старте приложения
   */
  async onModuleInit() {
    try {
      await this.verifyBucketAccess();
      this.logger.log(`✅ S3 bucket '${this.bucketName}' is accessible`);
    } catch (error) {
      this.logger.error(
        `❌ Cannot access S3 bucket '${this.bucketName}': ${error.message}`,
      );
      throw new Error(
        `S3 bucket verification failed: ${error.message}`,
      );
    }
  }

  /**
   * Проверка доступа к bucket
   */
  private async verifyBucketAccess(): Promise<void> {
    const command = new HeadBucketCommand({
      Bucket: this.bucketName,
    });

    await this.s3Client.send(command);
  }

  /**
   * Загрузка файла в S3 с поддержкой streaming для больших файлов
   */
  async uploadFile(
    key: string,
    stream: Readable,
    contentType: string,
  ): Promise<void> {
    try {
      const startTime = Date.now();

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: stream,
          ContentType: contentType,
        },
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
        leavePartsOnError: false,
      });

      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded && progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          this.logger.debug(
            `Upload progress for ${key}: ${percent}% (${progress.loaded}/${progress.total} bytes)`,
          );
        }
      });

      await upload.done();

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ File uploaded to S3: ${key} (${duration}ms, ${contentType})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to upload file ${key}: ${error.message}`,
        error.stack,
      );
      throw this.handleS3Error(error, 'upload');
    }
  }

  /**
   * Получение файла как stream
   */
  async getFileStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      this.logger.log(`File stream retrieved: ${key}`);
      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to get file stream ${key}: ${error.message}`);
      throw this.handleS3Error(error, 'read');
    }
  }

  /**
   * Удаление файла из S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`✅ File deleted from S3: ${key}`);
    } catch (error) {
      this.logger.error(`❌ Failed to delete file ${key}: ${error.message}`);
      throw this.handleS3Error(error, 'delete');
    }
  }

  /**
   * Генерация presigned URL для загрузки
   */
  async getUploadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      this.logger.debug(`Generated upload URL for ${key}`);
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate upload URL for ${key}: ${error.message}`,
      );
      throw this.handleS3Error(error, 'presign');
    }
  }

  /**
   * Генерация presigned URL для скачивания
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      this.logger.debug(`Generated download URL for ${key}`);
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate download URL for ${key}: ${error.message}`,
      );
      throw this.handleS3Error(error, 'presign');
    }
  }

  /**
   * Health check для S3
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.verifyBucketAccess();
      return true;
    } catch (error) {
      this.logger.error(`S3 health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Обработка ошибок S3 с понятными сообщениями
   */
  private handleS3Error(error: any, operation: string): Error {
    const errorMap = {
      NoSuchBucket: 'S3 bucket not found',
      NoSuchKey: 'File not found in S3',
      AccessDenied: 'Access denied to S3 resource',
      InvalidAccessKeyId: 'Invalid S3 credentials',
      SignatureDoesNotMatch: 'Invalid S3 signature',
      RequestTimeout: 'S3 request timed out',
      ServiceUnavailable: 'S3 service temporarily unavailable',
      InternalError: 'S3 internal error',
      SlowDown: 'Too many S3 requests, please slow down',
      EntityTooLarge: 'File is too large',
      ECONNREFUSED: 'Cannot connect to S3 service',
      ETIMEDOUT: 'S3 connection timed out',
      ENOTFOUND: 'S3 endpoint not found',
    };

    const errorName = error.name || error.code;
    const userMessage =
      errorMap[errorName] || `S3 ${operation} operation failed`;

    this.logger.error(
      `S3 Error [${errorName}] during ${operation}: ${error.message}`,
    );

    const enhancedError = new Error(userMessage);
    enhancedError.name = errorName;
    (enhancedError as any).originalError = error;

    return enhancedError;
  }
}





















