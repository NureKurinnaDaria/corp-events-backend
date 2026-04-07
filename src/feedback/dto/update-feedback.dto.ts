import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateFeedbackDto {
  @ApiPropertyOptional({
    example: 4,
    description: 'Updated rating from 1 to 5',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    example: 'Updated feedback comment',
    description: 'Updated optional comment',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
