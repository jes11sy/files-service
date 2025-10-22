import { Controller, Post, Get, Delete, Param, Query, UseGuards, Request, HttpCode, HttpStatus, Response } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FilesService } from './files.service';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    return {
      success: true,
      message: 'Files module is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('upload')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file to S3' })
  async uploadFile(@Request() req: any) {
    const data = await req.file();
    const result = await this.filesService.uploadFile(data, req.user);
    return result;
  }

  @Get('presigned-url')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get presigned URL for upload' })
  async getPresignedUrl(@Query('filename') filename: string, @Query('type') type: string) {
    return this.filesService.getPresignedUrl(filename, type);
  }

  @Get(':key')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get file from S3' })
  async getFile(@Param('key') key: string, @Response() res: any) {
    const stream = await this.filesService.getFile(key);
    stream.pipe(res);
  }

  @Delete(':key')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Delete file from S3' })
  async deleteFile(@Param('key') key: string) {
    return this.filesService.deleteFile(key);
  }

  @Get('download/:key')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get download URL for file' })
  async getDownloadUrl(@Param('key') key: string) {
    return this.filesService.getDownloadUrl(key);
  }
}





