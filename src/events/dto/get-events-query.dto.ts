import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventFormat, EventStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetEventsQueryDto {
  @ApiPropertyOptional({ example: 'workshop' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: '9b94a89b-3a74-4d4a-8d01-8a0fdb6f9f6e',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: EventFormat, example: EventFormat.ONLINE })
  @IsOptional()
  @IsEnum(EventFormat)
  format?: EventFormat;

  @ApiPropertyOptional({ enum: EventStatus, example: EventStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ example: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
