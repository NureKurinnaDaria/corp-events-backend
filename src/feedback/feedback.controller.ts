import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('Feedback')
@ApiBearerAuth('access-token')
@Controller('feedback')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Roles('EMPLOYEE')
  @ApiOperation({ summary: 'Create feedback for a completed event' })
  create(
    @Body() createFeedbackDto: CreateFeedbackDto,
    @Req() req: Request & { user: any },
  ) {
    return this.feedbackService.create(createFeedbackDto, req.user.userId);
  }

  @Get('my')
  @Roles('EMPLOYEE')
  @ApiOperation({ summary: 'Get current employee feedbacks' })
  findMyFeedbacks(@Req() req: Request & { user: any }) {
    return this.feedbackService.findMyFeedbacks(req.user.userId);
  }

  @Get('event/:eventId')
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Get feedbacks for a specific event' })
  findByEvent(@Param('eventId') eventId: string) {
    return this.feedbackService.findByEvent(eventId);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Get feedback by ID' })
  findOne(@Param('id') id: string) {
    return this.feedbackService.findOne(id);
  }

  @Patch(':id')
  @Roles('EMPLOYEE')
  @ApiOperation({ summary: 'Update feedback by ID' })
  update(
    @Param('id') id: string,
    @Body() updateFeedbackDto: UpdateFeedbackDto,
    @Req() req: Request & { user: any },
  ) {
    return this.feedbackService.update(id, updateFeedbackDto, req.user.userId);
  }

  @Delete(':id')
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Delete feedback by ID' })
  remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.feedbackService.remove(id, req.user.userId, req.user.role);
  }
}
