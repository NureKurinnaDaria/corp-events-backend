import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Get all notifications for current user' })
  findAll(@Req() req: Request & { user: any }) {
    return this.notificationsService.findAllForUser(req.user.id);
  }

  @Patch(':id/read')
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Req() req: Request & { user: any }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
