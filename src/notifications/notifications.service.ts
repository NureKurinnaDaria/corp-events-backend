import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, EventStatus } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventsGateway: EventsGateway,
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

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private emailWrapper(
    accentColor: string,
    title: string,
    body: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: ${accentColor}; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Corp Events</h2>
        </div>
        <div style="padding: 28px 32px; background: #f8fafc; border-radius: 0 0 8px 8px;">
          <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px;">${title}</h3>
          ${body}
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Корпоративна система управління подіями
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Надсилає адміністраторам підтвердження що розсилку надіслано
   */
  private async notifyAdminsOnBroadcastSent(
    eventId: string,
    eventTitle: string,
    recipientCount: number,
    actionLabel: string,
  ): Promise<void> {
    if (recipientCount === 0) return;

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    const plural = recipientCount === 1 ? 'співробітнику' : 'співробітникам';

    for (const admin of admins) {
      await this.prisma.notification.create({
        data: {
          userId: admin.id,
          title: `Розсилку надіслано: ${eventTitle}`,
          message: `${actionLabel} успішно надіслано ${recipientCount} ${plural}.`,
          type: NotificationType.SYSTEM,
          eventId,
        },
      });
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

    const startDate = this.formatDate(event.startAt);
    const formatLabel = event.format === 'ONLINE' ? 'Онлайн' : 'Офлайн';

    const rows = [
      `<tr><td style="color:#64748b;padding:6px 0;width:140px;">Дата початку:</td><td><strong>${startDate}</strong></td></tr>`,
      `<tr><td style="color:#64748b;padding:6px 0;">Формат:</td><td><strong>${formatLabel}</strong></td></tr>`,
      event.location
        ? `<tr><td style="color:#64748b;padding:6px 0;">Місце:</td><td><strong>${event.location}</strong></td></tr>`
        : '',
      event.onlineUrl
        ? `<tr><td style="color:#64748b;padding:6px 0;">Посилання:</td><td><a href="${event.onlineUrl}" style="color:#2563eb;">${event.onlineUrl}</a></td></tr>`
        : '',
      event.maxParticipants
        ? `<tr><td style="color:#64748b;padding:6px 0;">Кількість місць:</td><td><strong>${event.maxParticipants}</strong></td></tr>`
        : '',
      event.category
        ? `<tr><td style="color:#64748b;padding:6px 0;">Категорія:</td><td><strong>${event.category.name}</strong></td></tr>`
        : '',
    ]
      .filter(Boolean)
      .join('');

    const body = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:20px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
        ${event.description ? `<p style="color:#475569;margin:0 0 12px 0;">${event.description}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      <p style="color:#475569;">Зареєструйтесь на подію через корпоративну систему.</p>
    `;

    const html = this.emailWrapper('#2563eb', 'Нова корпоративна подія', body);

    // Паралельно створюємо сповіщення і одразу емітимо WS для кожного
    await Promise.all(
      employees.map(async (employee) => {
        const notification = await this.prisma.notification.create({
          data: {
            userId: employee.id,
            title: `Нова подія: ${event.title}`,
            message: `Запрошуємо вас на корпоративний захід "${event.title}", який відбудеться ${startDate}.`,
            type: NotificationType.EVENT_CREATED,
            eventId: event.id,
          },
        });

        // WebSocket: миттєво після запису в БД
        this.eventsGateway.emitNewNotification(employee.id, {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          eventId: notification.eventId,
          createdAt: notification.createdAt,
        });

        // Email — fire-and-forget, не блокує
        void this.sendEmail(
          employee.email,
          `Нова корпоративна подія: ${event.title}`,
          html,
        );
      }),
    );

    this.logger.log(
      `EVENT_CREATED notifications sent for event ${eventId} to ${employees.length} employees`,
    );

    await this.notifyAdminsOnBroadcastSent(
      event.id,
      event.title,
      employees.length,
      `Сповіщення про нову подію "${event.title}"`,
    );
  }

  /**
   * Надсилає email зареєстрованим учасникам при зміні критичних полів події
   */

  async notifyRegisteredUsersOnEventUpdated(
    eventId: string,
    changedFields: {
      startAt?: boolean;
      endAt?: boolean;
      location?: boolean;
      onlineUrl?: boolean;
    },
  ): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) return;

    const registrations = await this.prisma.registration.findMany({
      where: { eventId, status: 'REGISTERED' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (registrations.length === 0) return;

    const startDate = this.formatDate(event.startAt);
    const endDate = this.formatDate(event.endAt);

    const changedLines: string[] = [];
    if (changedFields.startAt)
      changedLines.push(
        `<li>Новий початок: <strong>${startDate}</strong></li>`,
      );
    if (changedFields.endAt)
      changedLines.push(`<li>Новий кінець: <strong>${endDate}</strong></li>`);
    if (changedFields.location)
      changedLines.push(
        `<li>Нове місце: <strong>${event.location}</strong></li>`,
      );
    if (changedFields.onlineUrl)
      changedLines.push(
        `<li>Нове посилання: <a href="${event.onlineUrl}" style="color:#2563eb;">${event.onlineUrl}</a></li>`,
      );

    const body = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:20px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
        <p style="color:#475569;margin:0 0 12px 0;">Деталі події, на яку ви зареєстровані, були змінені:</p>
        <ul style="color:#475569;padding-left:20px;line-height:2;">${changedLines.join('')}</ul>
      </div>
      <p style="color:#475569;">Перевірте актуальну інформацію у корпоративній системі.</p>
    `;

    const html = this.emailWrapper('#7c3aed', 'Подію оновлено', body);

    const changedFieldsUa = [
      changedFields.startAt && 'час початку',
      changedFields.endAt && 'час завершення',
      changedFields.location && 'місце проведення',
      changedFields.onlineUrl && 'посилання',
    ]
      .filter(Boolean)
      .join(', ');

    for (const registration of registrations) {
      const user = registration.user;
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title: `Подію оновлено: ${event.title}`,
          message: `Змінено: ${changedFieldsUa}. Перевірте актуальні деталі події.`,
          type: NotificationType.EVENT_UPDATED,
          eventId: event.id,
        },
      });
      await this.sendEmail(user.email, `Подію оновлено: ${event.title}`, html);
    }

    this.logger.log(
      `EVENT_UPDATED notifications sent for event ${eventId} to ${registrations.length} users`,
    );

    await this.notifyAdminsOnBroadcastSent(
      eventId,
      event.title,
      registrations.length,
      `Сповіщення про зміни в події "${event.title}" (${changedFieldsUa})`,
    );
  }

  /**
   * Надсилає email зареєстрованим учасникам при скасуванні події
   */

  async notifyRegisteredUsersOnEventCanceled(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { category: true },
    });
    if (!event) return;

    const registrations = await this.prisma.registration.findMany({
      where: { eventId, status: 'REGISTERED' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (registrations.length === 0) return;

    const startDate = this.formatDate(event.startAt);

    const body = `
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:20px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
        <p style="color:#475569;margin:0 0 8px 0;">На жаль, цю подію було скасовано адміністратором.</p>
        <p style="color:#64748b;margin:0;">Планована дата: <strong>${startDate}</strong></p>
      </div>
      <p style="color:#475569;">Слідкуйте за новими подіями у корпоративній системі.</p>
    `;

    const html = this.emailWrapper('#e11d48', 'Подію скасовано', body);

    for (const registration of registrations) {
      const user = registration.user;
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title: `Подію скасовано: ${event.title}`,
          message: `На жаль, подія "${event.title}", запланована на ${startDate}, була скасована.`,
          type: NotificationType.EVENT_CANCELED,
          eventId: event.id,
        },
      });
      await this.sendEmail(user.email, `Подію скасовано: ${event.title}`, html);
    }

    this.logger.log(
      `EVENT_CANCELED notifications sent for event ${eventId} to ${registrations.length} users`,
    );

    await this.notifyAdminsOnBroadcastSent(
      eventId,
      event.title,
      registrations.length,
      `Сповіщення про скасування події "${event.title}"`,
    );
  }

  /**
   * Надсилає нагадування зареєстрованим учасникам за вказану кількість годин до початку
   */

  async sendEventReminders(hoursBeforeStart: number): Promise<void> {
    const now = new Date();
    const windowStart = new Date(
      now.getTime() + hoursBeforeStart * 60 * 60 * 1000,
    );
    const windowEnd = new Date(windowStart.getTime() + 31 * 60 * 1000); // вікно 31 хвилина (перекриває інтервал крона)

    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        startAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        title: true,
        format: true,
        startAt: true,
        location: true,
        onlineUrl: true,
      },
    });

    for (const event of events) {
      // Перевіряємо чи вже надсилали нагадування з таким часом
      const reminderLabel = `reminder_${hoursBeforeStart}h`;
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          eventId: event.id,
          type: NotificationType.EVENT_UPDATED,
          message: { contains: reminderLabel },
        },
      });
      if (alreadySent) continue;

      const registrations = await this.prisma.registration.findMany({
        where: { eventId: event.id, status: 'REGISTERED' },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });
      if (registrations.length === 0) continue;

      const startDate = this.formatDate(event.startAt);
      const timeLabel =
        hoursBeforeStart >= 24
          ? `${hoursBeforeStart / 24} ${hoursBeforeStart / 24 === 1 ? 'день' : 'дні'}`
          : `${hoursBeforeStart} ${hoursBeforeStart === 1 ? 'годину' : 'годин'}`;

      const locationRow =
        event.format === 'OFFLINE' && event.location
          ? `<p style="color:#64748b;margin:4px 0;">Місце: <strong>${event.location}</strong></p>`
          : event.format === 'ONLINE' && event.onlineUrl
            ? `<p style="color:#64748b;margin:4px 0;">Посилання: <a href="${event.onlineUrl}" style="color:#2563eb;">${event.onlineUrl}</a></p>`
            : '';

      const body = `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:20px;margin-bottom:16px;">
          <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
          <p style="color:#475569;margin:0 0 8px 0;">Нагадуємо, що до початку події залишилось <strong>${timeLabel}</strong>.</p>
          <p style="color:#64748b;margin:4px 0;">Дата початку: <strong>${startDate}</strong></p>
          ${locationRow}
        </div>
        <p style="color:#475569;">Не пропустіть захід!</p>
      `;

      const html = this.emailWrapper('#2563eb', `Нагадування про подію`, body);

      for (const reg of registrations) {
        const user = reg.user;
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            title: `Нагадування: ${event.title}`,
            message: `[${reminderLabel}] До початку події "${event.title}" залишилось ${timeLabel}. Захід розпочнеться ${startDate}.`,
            type: NotificationType.EVENT_UPDATED,
            eventId: event.id,
          },
        });
        await this.sendEmail(
          user.email,
          `Нагадування: ${event.title} - через ${timeLabel}`,
          html,
        );
      }

      this.logger.log(
        `Reminders (${hoursBeforeStart}h) sent for event ${event.id} to ${registrations.length} users`,
      );
    }
  }

  /**
   * Надсилає нагадування лише для подій конкретного формату (OFFLINE/ONLINE)
   */
  async sendEventRemindersForFormat(
    hoursBeforeStart: number,
    format: string,
  ): Promise<void> {
    const now = new Date();
    const windowStart = new Date(
      now.getTime() + hoursBeforeStart * 60 * 60 * 1000,
    );
    const windowEnd = new Date(windowStart.getTime() + 31 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        format: format as any,
        startAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        title: true,
        format: true,
        startAt: true,
        location: true,
        onlineUrl: true,
      },
    });

    for (const event of events) {
      const reminderLabel = `reminder_${hoursBeforeStart}h`;
      const alreadySent = await this.prisma.notification.findFirst({
        where: {
          eventId: event.id,
          type: NotificationType.EVENT_UPDATED,
          message: { contains: reminderLabel },
        },
      });
      if (alreadySent) continue;

      const registrations = await this.prisma.registration.findMany({
        where: { eventId: event.id, status: 'REGISTERED' },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });
      if (registrations.length === 0) continue;

      const startDate = this.formatDate(event.startAt);
      const timeLabel =
        hoursBeforeStart >= 1
          ? `${hoursBeforeStart} ${hoursBeforeStart === 1 ? 'годину' : 'годин'}`
          : `${hoursBeforeStart * 60} хвилин`;

      const locationRow =
        format === 'OFFLINE' && event.location
          ? `<p style="color:#64748b;margin:4px 0;">Місце: <strong>${event.location}</strong></p>`
          : format === 'ONLINE' && event.onlineUrl
            ? `<p style="color:#64748b;margin:4px 0;">Посилання: <a href="${event.onlineUrl}" style="color:#2563eb;">${event.onlineUrl}</a></p>`
            : '';

      const body = `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:20px;margin-bottom:16px;">
          <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
          <p style="color:#475569;margin:0 0 8px 0;">Нагадуємо, що до початку події залишилось <strong>${timeLabel}</strong>.</p>
          <p style="color:#64748b;margin:4px 0;">Дата початку: <strong>${startDate}</strong></p>
          ${locationRow}
        </div>
        <p style="color:#475569;">Не пропустіть захід!</p>
      `;

      const html = this.emailWrapper('#2563eb', `Нагадування про подію`, body);

      for (const reg of registrations) {
        const user = reg.user;
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            title: `Нагадування: ${event.title}`,
            message: `[${reminderLabel}] До початку події "${event.title}" залишилось ${timeLabel}. Захід розпочнеться ${startDate}.`,
            type: NotificationType.EVENT_UPDATED,
            eventId: event.id,
          },
        });
        await this.sendEmail(
          user.email,
          `Нагадування: ${event.title} - через ${timeLabel}`,
          html,
        );
      }

      this.logger.log(
        `Reminders (${hoursBeforeStart}h, ${format}) sent for event ${event.id} to ${registrations.length} users`,
      );
    }
  }

  async sendRegistrationCancelledByAdmin(
    userId: string,
    eventId: string,
    userEmail: string,
    userFullName: string,
    eventTitle: string,
    eventStartAt: Date,
  ): Promise<void> {
    const startDate = this.formatDate(eventStartAt);

    const body = `
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:20px;margin-bottom:16px;">
        <p style="color:#475569;margin:0 0 8px 0;">Шановний(а) <strong>${userFullName}</strong>,</p>
        <p style="color:#475569;margin:0 0 8px 0;">Адміністратор скасував вашу реєстрацію на подію:</p>
        <h4 style="color:#1e293b;margin:0 0 8px 0;">${eventTitle}</h4>
        <p style="color:#64748b;margin:0;">Дата події: <strong>${startDate}</strong></p>
      </div>
      <p style="color:#475569;">Якщо у вас є питання — зверніться до адміністратора.</p>
    `;

    const html = this.emailWrapper(
      '#e11d48',
      'Вашу реєстрацію скасовано',
      body,
    );

    await this.prisma.notification.create({
      data: {
        userId,
        title: `Реєстрацію скасовано: ${eventTitle}`,
        message: `Адміністратор скасував вашу реєстрацію на подію "${eventTitle}", яка відбудеться ${startDate}.`,
        type: NotificationType.EVENT_CANCELED,
        eventId,
      },
    });

    await this.sendEmail(
      userEmail,
      `Реєстрацію скасовано: ${eventTitle}`,
      html,
    );
    this.logger.log(
      `REGISTRATION_CANCELLED_BY_ADMIN sent to ${userEmail} for event "${eventTitle}"`,
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
      where: { eventId, status: 'REGISTERED' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });

    const feedbacks = await this.prisma.feedback.findMany({
      where: { eventId },
      select: { userId: true },
    });
    const usersWithFeedback = new Set(feedbacks.map((f) => f.userId));
    const usersToNotify = registrations
      .map((r) => r.user)
      .filter((u) => !usersWithFeedback.has(u.id));
    if (usersToNotify.length === 0) return;

    const body = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:20px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
        <p style="color:#475569;margin:0 0 8px 0;">Захід завершено! Дякуємо за вашу участь.</p>
        <p style="color:#475569;margin:0;">Будь ласка, залиште відгук та оцінку від 1 до 5 — це допоможе нам покращити майбутні події.</p>
      </div>
      <p style="color:#475569;">Відгук можна залишити у корпоративній системі на сторінці події.</p>
    `;

    const html = this.emailWrapper('#059669', 'Залиште відгук про подію', body);

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
        `Залиште відгук про подію: ${event.title}`,
        html,
      );
    }

    this.logger.log(
      `FEEDBACK_REMINDER notifications sent for event ${eventId} to ${usersToNotify.length} users`,
    );

    await this.notifyAdminsOnBroadcastSent(
      eventId,
      event.title,
      usersToNotify.length,
      `Нагадування про відгук для події "${event.title}"`,
    );
  }

  /**
   * Надсилає email зареєстрованим учасникам після публікації звіту
   */

  async notifyRegisteredUsersOnReportCreated(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) return;

    const registrations = await this.prisma.registration.findMany({
      where: { eventId, status: 'REGISTERED' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (registrations.length === 0) return;

    const body = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:20px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
        <p style="color:#475569;margin:0;">Адміністратор опублікував звіт про захід. Ви можете переглянути його у корпоративній системі.</p>
      </div>
      <p style="color:#475569;">Дякуємо за участь у заході!</p>
    `;

    const html = this.emailWrapper(
      '#059669',
      'Звіт про подію опубліковано',
      body,
    );

    for (const registration of registrations) {
      const user = registration.user;
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title: `Звіт опубліковано: ${event.title}`,
          message: `Адміністратор опублікував звіт про захід "${event.title}". Перегляньте його у корпоративній системі.`,
          type: NotificationType.REPORT_PUBLISHED,
          eventId: event.id,
        },
      });
      await this.sendEmail(user.email, `Звіт про подію: ${event.title}`, html);
    }

    this.logger.log(
      `REPORT_PUBLISHED notifications sent for event ${eventId} to ${registrations.length} users`,
    );

    await this.notifyAdminsOnBroadcastSent(
      eventId,
      event.title,
      registrations.length,
      `Сповіщення про публікацію звіту для події "${event.title}"`,
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
      return { message: 'Сповіщення не знайдено або доступ заборонено' };
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Надсилає сповіщення зареєстрованим учасникам при оновленні звіту
   */
  async notifyRegisteredUsersOnReportUpdated(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) return;

    const registrations = await this.prisma.registration.findMany({
      where: { eventId, status: 'REGISTERED' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (registrations.length === 0) return;

    const body = `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:20px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
        <p style="color:#475569;margin:0;">Адміністратор оновив звіт про захід. Перегляньте актуальну версію у корпоративній системі.</p>
      </div>
      <p style="color:#475569;">Дякуємо за участь у заході!</p>
    `;

    const html = this.emailWrapper('#7c3aed', 'Звіт про подію оновлено', body);

    for (const registration of registrations) {
      const user = registration.user;
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title: `Звіт оновлено: ${event.title}`,
          message: `Адміністратор оновив звіт про захід "${event.title}". Перегляньте актуальну версію.`,
          type: NotificationType.REPORT_PUBLISHED,
          eventId: event.id,
        },
      });
      await this.sendEmail(user.email, `Звіт оновлено: ${event.title}`, html);
    }

    this.logger.log(
      `REPORT_UPDATED notifications sent for event ${eventId} to ${registrations.length} users`,
    );

    await this.notifyAdminsOnBroadcastSent(
      eventId,
      event.title,
      registrations.length,
      `Сповіщення про оновлення звіту для події "${event.title}"`,
    );
  }

  /**
   * Надсилає сповіщення зареєстрованим учасникам при видаленні звіту
   */
  async notifyRegisteredUsersOnReportDeleted(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) return;

    const registrations = await this.prisma.registration.findMany({
      where: { eventId, status: 'REGISTERED' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (registrations.length === 0) return;

    const body = `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:20px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;color:#1e293b;">${event.title}</h4>
        <p style="color:#475569;margin:0;">Адміністратор видалив звіт про цей захід.</p>
      </div>
      <p style="color:#475569;">Якщо у вас є питання — зверніться до адміністратора.</p>
    `;

    const html = this.emailWrapper('#ea580c', 'Звіт про подію видалено', body);

    for (const registration of registrations) {
      const user = registration.user;
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          title: `Звіт видалено: ${event.title}`,
          message: `Адміністратор видалив звіт про захід "${event.title}".`,
          type: NotificationType.SYSTEM,
          eventId: event.id,
        },
      });
      await this.sendEmail(user.email, `Звіт видалено: ${event.title}`, html);
    }

    this.logger.log(
      `REPORT_DELETED notifications sent for event ${eventId} to ${registrations.length} users`,
    );

    await this.notifyAdminsOnBroadcastSent(
      eventId,
      event.title,
      registrations.length,
      `Сповіщення про видалення звіту для події "${event.title}"`,
    );
  }

  /**
   * Позначити всі сповіщення користувача як прочитані
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'Всі сповіщення позначено як прочитані' };
  }
}
