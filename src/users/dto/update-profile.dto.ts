import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Updated User Name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+380000000999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Backend Developer' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ example: 'NewPassword123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password?: string;
}
