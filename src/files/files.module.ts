import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3Service } from './s3.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 3000000, // 50 минут
      max: 1000, // Максимум 1000 URL в кеше
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, S3Service],
  exports: [FilesService, S3Service],
})
export class FilesModule {}





















