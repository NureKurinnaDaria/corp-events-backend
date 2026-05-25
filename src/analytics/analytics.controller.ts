import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Get analytics data' })
  getAnalytics() {
    return this.analyticsService.getAnalytics();
  }

  @Get('report')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Get period report with all events in date range' })
  @ApiQuery({ name: 'from', required: true, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: true, example: '2025-12-31' })
  getPeriodReport(@Query('from') from: string, @Query('to') to: string) {
    return this.analyticsService.getPeriodReport(from, to);
  }
}
