import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Response,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { CookieJwtAuthGuard } from '../auth/guards/cookie-jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { FilesService } from './files.service';
import { S3Service } from './s3.service';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';
import { FileKeyDto, FileQueryDto } from './dto/file-key.dto';

@ApiTags('files')
@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private filesService: FilesService,
    private s3Service: S3Service,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint with S3 connectivity test' })
  async health() {
    const s3Status = await this.s3Service.healthCheck();

    return {
      success: s3Status,
      message: s3Status
        ? 'Files service is healthy'
        : 'S3 connection is unavailable',
      s3Connected: s3Status,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  @Post('upload')
  @UseGuards(CookieJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 загрузок в минуту
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file to S3 with validation' })
  async uploadFile(@Request() req: any, @Query() query: FileQueryDto) {
    try {
      const data = await req.file();

      if (!data) {
        return {
          success: false,
          message: 'No file provided',
        };
      }

      // Добавляем IP и UserAgent для логирования
      req.user.ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      req.user.userAgent = req.headers['user-agent'] || 'unknown';

      const result = await this.filesService.uploadFile(
        data,
        req.user,
        query.folder,
      );
      return result;
    } catch (error) {
      this.logger.error(`Upload error: ${error.message}`);
      throw error;
    }
  }

  @Get('presigned-url')
  @UseGuards(CookieJwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 запросов в минуту
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get presigned URL for upload' })
  async getPresignedUrl(@Query() query: FileQueryDto) {
    if (!query.filename || !query.type) {
      return {
        success: false,
        message: 'filename and type are required',
      };
    }

    return this.filesService.getPresignedUrl(query.filename, query.type);
  }

  @Get(':key')
  @UseGuards(CookieJwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 запросов в минуту
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get file from S3 (stream)' })
  async getFile(@Param() params: FileKeyDto, @Response() res: any) {
    try {
      const stream = await this.filesService.getFile(params.key);
      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Get file error: ${error.message}`);
      throw error;
    }
  }

  @Delete(':key')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 удалений в минуту
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Delete file from S3 (Admin only)' })
  async deleteFile(@Param() params: FileKeyDto, @Request() req: any) {
    this.logger.log({
      action: 'FILE_DELETE_REQUEST',
      key: params.key,
      userId: req.user.userId,
      userRole: req.user.role,
    });

    return this.filesService.deleteFile(params.key);
  }

  @Get('download/:key')
  @UseGuards(CookieJwtAuthGuard)
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 запросов в минуту
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get download URL for file (cached)' })
  async getDownloadUrl(@Param() params: FileKeyDto) {
    return this.filesService.getDownloadUrl(params.key);
  }
}





















