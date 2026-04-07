import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class AddReportPhotoDto {
  @ApiProperty({
    example: 'https://example.com/photos/event-photo-1.jpg',
    description: 'Photo URL',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;
}
