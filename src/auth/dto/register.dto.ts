import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'test@mail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password1', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*[0-9])/, {
    message: 'Пароль має містити хоча б одну велику літеру та одну цифру',
  })
  password: string;

  @ApiProperty({ example: 'Test User' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+380000000000' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Frontend Developer' })
  @IsString()
  position: string;
}
