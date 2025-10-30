# Files Service 🔒

Защищенный микросервис для работы с файлами и S3 хранилищем с полной валидацией, кешированием и rate limiting.

## ✨ Функционал

- 📁 **Загрузка файлов** в S3 с валидацией типов и размера
- 🔗 **Генерация presigned URLs** с кешированием
- 📥 **Streaming скачивание** больших файлов
- 🗑️ **Удаление файлов** с проверкой прав
- 🎙️ **Хранение записей** звонков
- 📄 **Хранение документов** и чеков
- 🔐 **JWT аутентификация** с валидацией секрета
- 🛡️ **Защита от Path Traversal** атак
- 🚦 **Rate Limiting** для защиты от DDoS
- ⚡ **Compression** для оптимизации трафика
- 📊 **Детальное логирование** всех операций

## 🔒 Безопасность

### Реализованные защиты:
- ✅ Валидация JWT секрета (минимум 32 символа)
- ✅ Проверка MIME типов и расширений файлов
- ✅ Верификация Magic Numbers (сигнатур файлов)
- ✅ Защита от Path Traversal
- ✅ Rate Limiting на всех endpoint'ах
- ✅ CORS с white-list доменов
- ✅ Content Security Policy (CSP)
- ✅ Helmet security headers
- ✅ Валидация всех входных данных

### Запрещенные типы файлов:
- Исполняемые: `.exe`, `.bat`, `.sh`, `.cmd`, `.dll`, `.so`
- Скрипты: `.js`, `.vbs`, `.jar`
- Другие опасные: `.msi`, `.app`, `.pif`, `.scr`

## 🚀 API Endpoints

### Health Check
- `GET /api/v1/files/health` - проверка работоспособности и S3 соединения

### Файловые операции (требуют JWT)
- `POST /api/v1/files/upload` - загрузка файла (limit: 10/min, max: 50MB)
- `GET /api/v1/files/presigned-url` - получить presigned URL (limit: 20/min)
- `GET /api/v1/files/:key` - получить файл stream (limit: 30/min)
- `DELETE /api/v1/files/:key` - удалить файл (limit: 5/min, только admin)
- `GET /api/v1/files/download/:key` - получить download URL (limit: 50/min)

## 📋 Переменные окружения

### Обязательные:
```env
# JWT (минимум 32 символа!)
JWT_SECRET=your-super-secure-secret-key-minimum-32-characters-long

# S3 Configuration (все обязательные)
S3_BUCKET_NAME=my-bucket-name
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_REGION=us-east-1
```

### Опциональные:
```env
# Server
PORT=5008
NODE_ENV=production

# S3 для MinIO/DigitalOcean Spaces
S3_ENDPOINT=https://s3.example.com
S3_FORCE_PATH_STYLE=true

# CORS (разделенные запятой)
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

## 🛠️ Запуск

### Development
```bash
npm install
npm run start:dev
```

### Production
```bash
npm install
npm run build
npm run start:prod
```

### Docker
```bash
docker build -t files-service:latest .
docker run -p 5008:5008 --env-file .env files-service:latest
```

## ⚡ Производительность

### Оптимизации:
- 🔄 **Connection Pooling** для S3 (50 max sockets)
- 💾 **Кеширование** presigned URLs (50 минут)
- 📦 **Compression** (gzip, deflate, brotli)
- 🌊 **Streaming** загрузка/скачивание больших файлов
- ♻️ **Retry механизм** для S3 операций (3 попытки)

### Лимиты:
- Максимальный размер файла: **50MB**
- Кеш URL: **1000 записей**
- TTL кеша: **50 минут**

## 📊 Логирование

Все операции логируются с деталями:
```json
{
  "action": "FILE_UPLOAD_SUCCESS",
  "userId": 123,
  "userRole": "director",
  "filename": "document.pdf",
  "key": "documents/1234567890-abc123.pdf",
  "size": 1024000,
  "duration": 850,
  "ip": "192.168.1.1"
}
```

## 🔍 Health Check

```bash
curl http://localhost:5008/api/v1/files/health
```

Ответ:
```json
{
  "success": true,
  "message": "Files service is healthy",
  "s3Connected": true,
  "timestamp": "2025-10-30T12:00:00.000Z",
  "version": "1.0.0"
}
```

## 📚 Swagger документация

Доступна по адресу: `http://localhost:5008/api/docs`

## 🧪 Тестирование

```bash
# Проверка зависимостей
npm audit

# Загрузка файла
curl -X POST http://localhost:5008/api/v1/files/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@document.pdf" \
  -F "folder=documents"

# Получение download URL
curl http://localhost:5008/api/v1/files/download/documents/file.pdf \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🐛 Troubleshooting

### Ошибка: "JWT_SECRET environment variable is required"
**Решение:** Установите `JWT_SECRET` минимум 32 символа

### Ошибка: "Missing required S3 environment variables"
**Решение:** Проверьте наличие всех S3 переменных окружения

### Ошибка: "File type 'application/x-msdownload' is not allowed"
**Решение:** Тип файла запрещен по соображениям безопасности

### Ошибка: "Too Many Requests"
**Решение:** Превышен rate limit, подождите 60 секунд

## 📝 Changelog

### Version 1.0.0 (2025-10-30)
- ✅ Добавлена валидация JWT секрета
- ✅ Защита от Path Traversal
- ✅ Валидация типов файлов и Magic Numbers
- ✅ Rate Limiting на всех endpoint'ах
- ✅ Кеширование presigned URLs
- ✅ Connection pooling для S3
- ✅ Compression (gzip, brotli)
- ✅ Streaming загрузка файлов
- ✅ CSP и security headers
- ✅ Детальное логирование
- ✅ Улучшенная обработка ошибок
- ✅ Graceful shutdown

## 🔐 Безопасность

Если обнаружили уязвимость, пожалуйста сообщите на: security@yourcompany.com

## 📄 Лицензия

MIT





















