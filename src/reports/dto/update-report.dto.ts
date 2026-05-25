import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateReportDto {
  @ApiPropertyOptional({
    example: 'Updated report text after reviewing the final event results.',
    description: 'Updated report text',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Якщо true — надіслати сповіщення зареєстрованим учасникам про оновлення звіту',
  })
  @IsOptional()
  @IsBoolean()
  notifyParticipants?: boolean;
}
