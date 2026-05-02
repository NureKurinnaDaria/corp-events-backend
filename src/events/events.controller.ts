import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Auth } from '../auth/decorators/auth.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { GetEventsQueryDto } from './dto/get-events-query.dto';

@ApiTags('Events')
@ApiBearerAuth('access-token')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiOperation({ summary: 'Create event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @Auth(Role.ADMIN)
  @Post()
  create(@Req() req: any, @Body() dto: CreateEventDto) {
    return this.eventsService.create(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Get events list with filters and sorting' })
  @ApiResponse({ status: 200, description: 'Events returned successfully' })
  @Auth(Role.ADMIN, Role.EMPLOYEE)
  @Get()
  findAll(@Req() req: any, @Query() query: GetEventsQueryDto) {
    return this.eventsService.findAll(query, req.user.role);
  }

  @ApiOperation({ summary: 'Get event by id' })
  @ApiResponse({ status: 200, description: 'Event returned successfully' })
  @Auth(Role.ADMIN, Role.EMPLOYEE)
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.eventsService.findOne(id, req.user.role);
  }

  @ApiOperation({ summary: 'Update event by id' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @Auth(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete event by id if no registrations exist' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  @Auth(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
