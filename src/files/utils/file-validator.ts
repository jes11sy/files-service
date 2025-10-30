import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

// Разрешенные MIME типы
export const ALLOWED_MIMETYPES = [
  // Изображения
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Аудио
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  // Документы
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  // Архивы
  'application/zip',
  'application/x-rar-compressed',
];

// Запрещенные расширения
export const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.sh',
  '.cmd',
  '.com',
  '.pif',
  '.scr',
  '.vbs',
  '.js',
  '.jar',
  '.app',
  '.msi',
  '.dll',
  '.so',
  '.dylib',
];

// Magic numbers для проверки реального типа файла
export const FILE_SIGNATURES: { [key: string]: number[] } = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/zip': [0x50, 0x4b, 0x03, 0x04],
};

export class FileValidator {
  /**
   * Проверка MIME типа
   */
  static validateMimeType(mimetype: string): void {
    if (!ALLOWED_MIMETYPES.includes(mimetype)) {
      throw new BadRequestException(
        `File type '${mimetype}' is not allowed. Allowed types: ${ALLOWED_MIMETYPES.join(', ')}`,
      );
    }
  }

  /**
   * Проверка расширения файла
   */
  static validateExtension(filename: string): void {
    const ext = path.extname(filename).toLowerCase();

    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `File extension '${ext}' is blocked for security reasons`,
      );
    }
  }

  /**
   * Проверка Magic Numbers (сигнатуры файла)
   */
  static async verifyFileSignature(
    buffer: Buffer,
    expectedMimetype: string,
  ): Promise<boolean> {
    const signature = FILE_SIGNATURES[expectedMimetype];

    // Если нет сигнатуры для этого типа, пропускаем проверку
    if (!signature) {
      return true;
    }

    // Проверяем первые байты файла
    const matches = signature.every((byte, index) => buffer[index] === byte);

    if (!matches) {
      throw new BadRequestException(
        'File content does not match declared type. Possible file type spoofing detected.',
      );
    }

    return true;
  }

  /**
   * Проверка размера файла
   */
  static validateFileSize(size: number, maxSize: number = 52428800): void {
    // 50MB по умолчанию
    if (size > maxSize) {
      throw new BadRequestException(
        `File size ${size} bytes exceeds maximum allowed size ${maxSize} bytes (${Math.round(maxSize / 1024 / 1024)}MB)`,
      );
    }
  }

  /**
   * Санитизация ключа файла (защита от Path Traversal)
   */
  static sanitizeFileKey(key: string): string {
    // Удаляем все попытки обхода директорий
    let sanitized = key.replace(/\.\./g, '');
    sanitized = sanitized.replace(/^\/+/, ''); // Удаляем начальные слеши
    sanitized = sanitized.replace(/\/+/g, '/'); // Заменяем множественные слеши на одиночные

    // Проверяем на недопустимые символы
    if (!/^[a-zA-Z0-9\-_\/\.]+$/.test(sanitized)) {
      throw new BadRequestException('Invalid characters in file key');
    }

    return sanitized;
  }

  /**
   * Генерация безопасного имени файла
   */
  static generateSafeFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}${ext}`;
  }

  /**
   * Полная валидация файла
   */
  static async validateFile(
    file: any,
    buffer: Buffer,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const { filename, mimetype } = file;

      // 1. Проверка MIME типа
      this.validateMimeType(mimetype);

      // 2. Проверка расширения
      this.validateExtension(filename);

      // 3. Проверка размера
      this.validateFileSize(buffer.length);

      // 4. Проверка сигнатуры файла
      await this.verifyFileSignature(buffer, mimetype);

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}

