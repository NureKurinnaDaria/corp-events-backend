import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [NotificationsModule, GatewayModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
