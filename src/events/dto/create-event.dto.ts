import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventFormat, EventStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Frontend Workshop' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Internal workshop for frontend team' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-04-10T10:00:00.000Z' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ example: '2026-04-10T12:00:00.000Z' })
  @IsDateString()
  endAt!: string;

  @ApiProperty({ enum: EventFormat, example: EventFormat.ONLINE })
  @IsEnum(EventFormat)
  format!: EventFormat;

  @ApiPropertyOptional({ example: 'Conference Room A' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-defg-hij' })
  @IsOptional()
  @IsString()
  onlineUrl?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({
    example: '9b94a89b-3a74-4d4a-8d01-8a0fdb6f9f6e',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: EventStatus, example: EventStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
