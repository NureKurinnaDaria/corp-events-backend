import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventSchedulerService } from './event-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, NotificationsModule],
  providers: [EventSchedulerService],
})
export class SchedulerModule {}
