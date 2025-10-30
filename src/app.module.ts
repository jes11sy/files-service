import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    // Rate limiting для защиты от DDoS
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 секунд
        limit: 100, // 100 запросов по умолчанию
      },
    ]),
    AuthModule,
    FilesModule,
  ],
  providers: [
    // Глобальный guard для rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}





















