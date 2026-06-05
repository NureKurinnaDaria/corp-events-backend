import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtRequest } from '../types/jwt-payload';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'Register a new employee user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    this.setTokenCookie(res, result.accessToken);
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Login and get access token' })
  @ApiResponse({ status: 200, description: 'Logged in successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    this.setTokenCookie(res, result.accessToken);
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Logout — clear auth cookie' })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', { path: '/' });
    return { message: 'Logged out' };
  }

  @ApiOperation({ summary: 'Get current authorized user from JWT' })
  @ApiResponse({ status: 200, description: 'Current user payload' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Req() req: JwtRequest) {
    return req.user;
  }

  private setTokenCookie(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
