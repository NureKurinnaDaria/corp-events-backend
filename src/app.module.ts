import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { EventsModule } from './events/events.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UploadModule } from './upload/upload.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    EventsModule,
    RegistrationsModule,
    FeedbackModule,
    ReportsModule,
    NotificationsModule,
    SchedulerModule,
    AnalyticsModule,
    UploadModule,
    GatewayModule,
  ],
})
export class AppModule {}
