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
import { AddReportPhotoDto } from './dto/add-report-photo.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create report for a completed event' })
  create(
    @Body() createReportDto: CreateReportDto,
    @Req() req: Request & { user: any },
  ) {
    return this.reportsService.create(createReportDto, req.user.role);
  }

  @Get('event/:eventId')
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Get report by event ID' })
  findByEvent(@Param('eventId') eventId: string) {
    return this.reportsService.findByEvent(eventId);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'ADMIN')
  @ApiOperation({ summary: 'Get report by ID' })
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update report text by ID' })
  update(
    @Param('id') id: string,
    @Body() updateReportDto: UpdateReportDto,
    @Req() req: Request & { user: any },
  ) {
    return this.reportsService.update(id, updateReportDto, req.user.role);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete report by ID' })
  remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.reportsService.remove(id, req.user.role);
  }

  @Post(':id/photos')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add photo to report' })
  addPhoto(
    @Param('id') id: string,
    @Body() addReportPhotoDto: AddReportPhotoDto,
    @Req() req: Request & { user: any },
  ) {
    return this.reportsService.addPhoto(id, addReportPhotoDto, req.user.role);
  }

  @Delete('photos/:photoId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete photo from report' })
  deletePhoto(
    @Param('photoId') photoId: string,
    @Req() req: Request & { user: any },
  ) {
    return this.reportsService.deletePhoto(photoId, req.user.role);
  }
}
