# Files Service

Микросервис для работы с файлами и S3 хранилищем.

## Функционал

- 📁 Загрузка файлов в S3
- 🔗 Генерация presigned URLs
- 📥 Скачивание файлов
- 🗑️ Удаление файлов
- 🎙️ Хранение записей звонков
- 📄 Хранение документов и чеков

## API Endpoints

- `POST /api/v1/files/upload` - загрузка файла
- `GET /api/v1/files/presigned-url` - получить presigned URL
- `GET /api/v1/files/:key` - получить файл
- `DELETE /api/v1/files/:key` - удалить файл
- `GET /api/v1/files/download/:key` - получить ссылку на скачивание

## Переменные окружения

```env
JWT_SECRET=...
PORT=5008
S3_BUCKET_NAME=my-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=... (опционально, для совместимых с S3 хранилищ)
S3_FORCE_PATH_STYLE=true (опционально)
```

## Запуск

```bash
npm install
npm run build
npm run start:prod
```

