import { IsString, Matches, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FileKeyDto {
  @ApiProperty({
    description: 'File key in S3 bucket',
    example: 'documents/1234567890-abc123.pdf',
  })
  @IsString()
  @MaxLength(500)
  @Matches(/^[a-zA-Z0-9\-_\/\.]+$/, {
    message: 'Invalid file key format. Only alphanumeric characters, hyphens, underscores, slashes and dots are allowed',
  })
  key: string;
}

export class FileQueryDto {
  @ApiProperty({
    description: 'Filename for upload',
    example: 'document.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @ApiProperty({
    description: 'File type/folder',
    example: 'documents',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\-_]+$/, {
    message: 'Invalid folder name',
  })
  type?: string;

  @ApiProperty({
    description: 'Custom folder path',
    example: 'director/orders/bso_doc',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\-_\/]+$/, {
    message: 'Invalid folder path',
  })
  folder?: string;
}

