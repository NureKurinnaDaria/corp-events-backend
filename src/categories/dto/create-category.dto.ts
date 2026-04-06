import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Training' })
  @IsString()
  @Length(2, 100)
  name!: string;
}
