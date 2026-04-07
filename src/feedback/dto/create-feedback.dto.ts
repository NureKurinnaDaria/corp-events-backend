import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({
    example: '6f0b5e7d-7c8a-4c1c-9c9b-123456789abc',
    description: 'Event ID',
  })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    example: 5,
    description: 'Rating from 1 to 5',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    example: 'Great event',
    description: 'Optional feedback comment',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
