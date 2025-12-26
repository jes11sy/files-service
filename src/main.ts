import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      trustProxy: true,
      bodyLimit: 10485760, // 10MB по умолчанию (для других endpoint'ов)
      connectionTimeout: 60000,
      keepAliveTimeout: 65000,
    }),
  );

  const logger = new Logger('FilesService');

  // 🍪 РЕГИСТРАЦИЯ COOKIE PLUGIN (до CORS!)
  await app.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET,
  });
  logger.log('✅ Cookie plugin registered');

  // CORS конфигурация с безопасными настройками
  await app.register(require('@fastify/cors'), {
    origin:
      process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
      ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // ✅ Добавлены PUT и PATCH
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Use-Cookies', // 🍪 Поддержка cookie mode
      'Cookie', // ✅ Добавлен для httpOnly cookies
    ],
    exposedHeaders: ['Set-Cookie'], // ✅ Разрешаем браузеру видеть Set-Cookie
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Helmet для безопасности с включенным CSP
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // Compression для лучшей производительности
  await app.register(require('@fastify/compress'), {
    global: true,
    threshold: 1024, // Минимальный размер для сжатия (1KB)
    encodings: ['gzip', 'deflate', 'br'], // Поддержка brotli
  });

  // Multipart для загрузки файлов
  await app.register(require('@fastify/multipart'), {
    limits: {
      fileSize: 52428800, // 50MB максимум
      files: 1, // Один файл за раз
      fields: 10, // Максимум дополнительных полей
    },
    attachFieldsToBody: false,
  });

  // Validation Pipe с детальными ошибками
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      errorHttpStatusCode: 400,
    }),
  );

  // Swagger документация
  const config = new DocumentBuilder()
    .setTitle('Files Service API')
    .setDescription('Secure Files and S3 storage microservice with validation')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('files', 'File operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 5008;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Files Service running on http://localhost:${port}`);
  logger.log(`📚 API Docs available at http://localhost:${port}/api/docs`);
  logger.log(`✅ Security: JWT validation, Rate limiting, CORS, CSP enabled`);
  logger.log(`⚡ Performance: Compression, Caching, Streaming enabled`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, closing HTTP server gracefully...`);

    try {
      await app.close();
      logger.log('HTTP server closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Failed to start application: ${error.message}`, error.stack);
  process.exit(1);
});





















