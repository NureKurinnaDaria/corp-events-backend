import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackService } from './feedback.service';
import { JwtRequest } from '../types/jwt-payload';

@ApiTags('Feedback')
@ApiBearerAuth('access-token')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Auth(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Create feedback for a completed event' })
  create(@Body() createFeedbackDto: CreateFeedbackDto, @Req() req: JwtRequest) {
    return this.feedbackService.create(createFeedbackDto, req.user.id);
  }

  @Get('my')
  @Auth(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get current employee feedbacks' })
  findMyFeedbacks(@Req() req: JwtRequest) {
    return this.feedbackService.findMyFeedbacks(req.user.id);
  }

  @Get('event/:eventId')
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Get feedbacks for a specific event' })
  findByEvent(@Param('eventId') eventId: string) {
    return this.feedbackService.findByEvent(eventId);
  }

  @Get(':id')
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Get feedback by ID' })
  findOne(@Param('id') id: string) {
    return this.feedbackService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Update feedback by ID' })
  update(
    @Param('id') id: string,
    @Body() updateFeedbackDto: UpdateFeedbackDto,
    @Req() req: JwtRequest,
  ) {
    return this.feedbackService.update(id, updateFeedbackDto, req.user.id);
  }

  @Delete(':id')
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Delete feedback by ID' })
  remove(@Param('id') id: string, @Req() req: JwtRequest) {
    return this.feedbackService.remove(id, req.user.id, req.user.role);
  }
}
