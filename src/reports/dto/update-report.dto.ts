import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateReportDto {
  @ApiPropertyOptional({
    example: 'Updated report text after reviewing the final event results.',
    description: 'Updated report text',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;
}
