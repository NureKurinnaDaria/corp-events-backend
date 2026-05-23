import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventStatus, EventFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventSchedulerService {
  private readonly logger = new Logger(EventSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Кожну хвилину — оновлення статусів подій
  @Cron(CronExpression.EVERY_MINUTE)
  async updateEventStatuses() {
    const now = new Date();

    // PUBLISHED → ONGOING
    const toOngoing = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { id: true },
    });

    if (toOngoing.length > 0) {
      await this.prisma.event.updateMany({
        where: { id: { in: toOngoing.map((e) => e.id) } },
        data: { status: EventStatus.ONGOING },
      });
      this.logger.log(`Set ONGOING: ${toOngoing.length} event(s)`);
    }

    // ONGOING/PUBLISHED → COMPLETED
    const toCompleted = await this.prisma.event.findMany({
      where: {
        status: { in: [EventStatus.ONGOING, EventStatus.PUBLISHED] },
        endAt: { lte: now },
      },
      select: { id: true },
    });

    if (toCompleted.length > 0) {
      await this.prisma.event.updateMany({
        where: { id: { in: toCompleted.map((e) => e.id) } },
        data: { status: EventStatus.COMPLETED },
      });
      this.logger.log(`Set COMPLETED: ${toCompleted.length} event(s)`);

      for (const event of toCompleted) {
        void this.notificationsService.notifyRegisteredUsersOnEventCompleted(
          event.id,
        );
      }
    }
  }

  // Кожні 30 хвилин — нагадування
  @Cron('*/30 * * * *')
  async sendEventReminders() {
    // Нагадування за 24 години — для всіх форматів
    await this.notificationsService.sendEventReminders(24);

    // Нагадування за 2 години — для офлайн
    await this.notificationsService.sendEventRemindersForFormat(
      2,
      EventFormat.OFFLINE,
    );

    // Нагадування за 30 хвилин — для онлайн
    await this.notificationsService.sendEventRemindersForFormat(
      0.5,
      EventFormat.ONLINE,
    );
  }
}
