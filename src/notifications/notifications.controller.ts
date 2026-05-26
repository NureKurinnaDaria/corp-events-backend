import { Controller, Get, Patch, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { NotificationsService } from './notifications.service';
import { JwtRequest } from '../types/jwt-payload';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Get all notifications for current user' })
  findAll(@Req() req: JwtRequest) {
    return this.notificationsService.findAllForUser(req.user.id);
  }

  @Patch('read-all')
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Req() req: JwtRequest) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@Param('id') id: string, @Req() req: JwtRequest) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }
}
