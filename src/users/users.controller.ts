import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Auth } from '../auth/decorators/auth.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtRequest } from '../types/jwt-payload';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile returned successfully' })
  @Auth(Role.ADMIN, Role.EMPLOYEE)
  @Get('profile')
  getProfile(@Req() req: JwtRequest) {
    return this.usersService.getProfile(req.user.id);
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @Auth(Role.ADMIN, Role.EMPLOYEE)
  @Patch('profile')
  updateProfile(@Req() req: JwtRequest, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @ApiOperation({ summary: '[ADMIN] Get all users' })
  @ApiQuery({ name: 'search', required: false })
  @Auth(Role.ADMIN)
  @Get('admin/list')
  getAllUsers(@Query('search') search?: string) {
    return this.usersService.getAllUsers(search);
  }

  @ApiOperation({ summary: '[ADMIN] Get user details' })
  @Auth(Role.ADMIN)
  @Get('admin/:id')
  getUserDetails(@Param('id') id: string) {
    return this.usersService.getUserDetails(id);
  }

  @ApiOperation({ summary: '[ADMIN] Block user' })
  @Auth(Role.ADMIN)
  @Patch('admin/:id/block')
  blockUser(@Req() req: JwtRequest, @Param('id') id: string) {
    return this.usersService.setUserActive(req.user.id, id, false);
  }

  @ApiOperation({ summary: '[ADMIN] Unblock user' })
  @Auth(Role.ADMIN)
  @Patch('admin/:id/unblock')
  unblockUser(@Req() req: JwtRequest, @Param('id') id: string) {
    return this.usersService.setUserActive(req.user.id, id, true);
  }
}
