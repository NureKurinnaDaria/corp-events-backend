import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({
    example: '6f0b5e7d-7c8a-4c1c-9c9b-123456789abc',
    description: 'Event ID',
  })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    example:
      'The event was successfully held. Employees actively participated in all activities.',
    description: 'Report text',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
