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
import { AddReportPhotoDto } from './dto/add-report-photo.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Create report for a completed event' })
  create(@Body() createReportDto: CreateReportDto, @Req() req: any) {
    return this.reportsService.create(createReportDto, req.user.role);
  }

  @Get('event/:eventId')
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Get report by event ID' })
  findByEvent(@Param('eventId') eventId: string) {
    return this.reportsService.findByEvent(eventId);
  }

  @Get(':id')
  @Auth(Role.EMPLOYEE, Role.ADMIN)
  @ApiOperation({ summary: 'Get report by ID' })
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Update report text by ID' })
  update(
    @Param('id') id: string,
    @Body() updateReportDto: UpdateReportDto,
    @Req() req: any,
  ) {
    return this.reportsService.update(id, updateReportDto, req.user.role);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Delete report by ID' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.reportsService.remove(id, req.user.role);
  }

  @Post(':id/photos')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Add photo to report' })
  addPhoto(
    @Param('id') id: string,
    @Body() addReportPhotoDto: AddReportPhotoDto,
    @Req() req: any,
  ) {
    return this.reportsService.addPhoto(id, addReportPhotoDto, req.user.role);
  }

  @Delete('photos/:photoId')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Delete photo from report' })
  deletePhoto(@Param('photoId') photoId: string, @Req() req: any) {
    return this.reportsService.deletePhoto(photoId, req.user.role);
  }
}
