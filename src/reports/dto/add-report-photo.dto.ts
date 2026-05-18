import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddReportPhotoDto {
  @ApiProperty({
    example: '/uploads/1234567890-987654321.jpg',
    description: 'Photo URL',
  })
  @IsString()
  @IsNotEmpty()
  url: string;
}
