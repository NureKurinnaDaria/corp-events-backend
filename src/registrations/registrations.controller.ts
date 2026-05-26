import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Auth } from '../auth/decorators/auth.decorator';
import { RegistrationsService } from './registrations.service';
import { JwtRequest } from '../types/jwt-payload';

@ApiTags('Registrations')
@ApiBearerAuth('access-token')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @ApiOperation({ summary: 'Register current employee for an event' })
  @ApiResponse({ status: 201, description: 'Registered successfully' })
  @Auth(Role.EMPLOYEE)
  @Post(':eventId')
  register(@Param('eventId') eventId: string, @Req() req: JwtRequest) {
    return this.registrationsService.register(eventId, req.user.id);
  }

  @ApiOperation({
    summary: 'Cancel current employee registration for an event',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration canceled successfully',
  })
  @Auth(Role.EMPLOYEE)
  @Patch(':eventId/cancel')
  cancel(@Param('eventId') eventId: string, @Req() req: JwtRequest) {
    return this.registrationsService.cancel(eventId, req.user.id);
  }

  @ApiOperation({
    summary:
      'Get current employee registrations grouped by upcoming and completed',
  })
  @ApiResponse({
    status: 200,
    description: 'Registrations returned successfully',
  })
  @Auth(Role.EMPLOYEE)
  @Get('my')
  getMyRegistrations(@Req() req: JwtRequest) {
    return this.registrationsService.getMyRegistrations(req.user.id);
  }

  @ApiOperation({ summary: 'Get registrations for a specific event' })
  @ApiResponse({
    status: 200,
    description: 'Event registrations returned successfully',
  })
  @Auth(Role.ADMIN)
  @Get('event/:eventId')
  getEventRegistrations(@Param('eventId') eventId: string) {
    return this.registrationsService.getEventRegistrations(eventId);
  }
  @ApiOperation({ summary: 'Admin cancel a registration by ID' })
  @ApiResponse({
    status: 200,
    description: 'Registration canceled by admin successfully',
  })
  @Auth(Role.ADMIN)
  @Delete(':registrationId/admin-cancel')
  adminCancelRegistration(@Param('registrationId') registrationId: string) {
    return this.registrationsService.adminCancelRegistration(registrationId);
  }
}
