import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, EventStatus } from '@prisma/client';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const from = this.configService.get<string>(
      'SMTP_FROM',
      'noreply@corp-events.com',
    );

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Надсилає email всім EMPLOYEE при створенні нової події
   */
  async notifyAllEmployeesOnEventCreated(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { category: true },
    });

    if (!event) return;

    const employees = await this.prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: { id: true, email: true, fullName: true },
    });

    if (employees.length === 0) return;

    const startDate = new Date(event.startAt).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">🎉 Нова корпоративна подія</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 16px 0;">
          <h3 style="color: #34495e; margin-top: 0;">${event.title}</h3>
          ${event.description ? `<p style="color: #555;">${event.description}</p>` : ''}
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <tr><td style="color: #888; padding: 4px 0; width: 140px;">📅 Дата початку:</td><td><strong>${startDate}</strong></td></tr>
            <tr><td style="color: #888; padding: 4px 0;">📍 Формат:</td><td><strong>${event.format === 'ONLINE' ? 'Онлайн' : 'Офлайн'}</strong></td></tr>
            ${event.location ? `<tr><td style="color: #888; padding: 4px 0;">🏢 Місце:</td><td><strong>${event.location}</strong></td></tr>` : ''}
            ${event.onlineUrl ? `<tr><td style="color: #888; padding: 4px 0;">🔗 Посилання:</td><td><a href="${event.onlineUrl}">${event.onlineUrl}</a></td></tr>` : ''}
            ${event.maxParticipants ? `<tr><td style="color: #888; padding: 4px 0;">👥 Місць:</td><td><strong>${event.maxParticipants}</strong></td></tr>` : ''}
            ${event.category ? `<tr><td style="color: #888; padding: 4px 0;">🏷️ Категорія:</td><td><strong>${event.category.name}</strong></td></tr>` : ''}
          </table>
        </div>
        <p style="color: #888; font-size: 13px;">Зареєструйтесь на подію через корпоративну систему.</p>
      </div>
    `;

    // Зберігаємо notifications у БД та надсилаємо email
    for (const employee of employees) {
      await this.prisma.notification.create({
        data: {
          userId: employee.id,
          title: `Нова подія: ${event.title}`,
          message: `Запрошуємо вас на корпоративний захід "${event.title}", який відбудеться ${startDate}.`,
          type: NotificationType.EVENT_CREATED,
          eventId: event.id,
        },
      });

      await this.sendEmail(
        employee.email,
        `🎉 Нова корпоративна подія: ${event.title}`,
        html,
      );
    }

    this.logger.log(
      `EVENT_CREATED notifications sent for event ${eventId} to ${employees.length} employees`,
    );
  }

  /**
   * Надсилає email зареєстрованим учасникам після завершення події з нагадуванням залишити feedback
   */
  async notifyRegisteredUsersOnEventCompleted(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status !== EventStatus.COMPLETED) return;

    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId,
        status: 'REGISTERED',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Знаходимо тих, хто ще не залишив feedback
    const feedbacks = await this.prisma.feedback.findMany({
      where: { eventId },
      select: { userId: true },
    });
    const usersWithFeedback = new Set(feedbacks.map((f) => f.userId));

    const usersToNotify = registrations
      .map((r) => r.user)
      .filter((u) => !usersWithFeedback.has(u.id));

    if (usersToNotify.length === 0) return;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">📝 Залиште відгук про подію</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 16px 0;">
          <h3 style="color: #34495e; margin-top: 0;">${event.title}</h3>
          <p style="color: #555;">
            Захід завершено! Ваша думка важлива для нас.<br/>
            Будь ласка, залиште відгук і оцінку (від 1 до 5), щоб ми могли покращити майбутні події.
          </p>
        </div>
        <p style="color: #888; font-size: 13px;">Відгук можна залишити у корпоративній системі в розділі «Feedback».</p>
      </div>
    `;

    for (const user of usersToNotify) {
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title: `Залиште відгук: ${event.title}`,
          message: `Захід "${event.title}" завершено. Будь ласка, залиште свій відгук.`,
          type: NotificationType.FEEDBACK_REMINDER,
          eventId: event.id,
        },
      });

      await this.sendEmail(
        user.email,
        `📝 Залиште відгук про подію: ${event.title}`,
        html,
      );
    }

    this.logger.log(
      `FEEDBACK_REMINDER notifications sent for event ${eventId} to ${usersToNotify.length} users`,
    );
  }

  /**
   * Отримати всі сповіщення поточного користувача
   */
  async findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Позначити сповіщення як прочитане
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return { message: 'Notification not found or access denied' };
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Позначити всі сповіщення користувача як прочитані
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read' };
  }
}
