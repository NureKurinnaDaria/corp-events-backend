import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async register(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        maxParticipants: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Подію не знайдено');
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException(
        'Реєстрація доступна тільки для опублікованих подій',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
  SELECT max_participants FROM events WHERE id = ${eventId}::uuid FOR UPDATE
`;
      const maxParticipants = event.maxParticipants ?? null;

      const existingRegistration = await tx.registration.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (existingRegistration?.status === RegistrationStatus.REGISTERED) {
        throw new BadRequestException('Ви вже зареєстровані на цю подію');
      }

      if (maxParticipants !== null && maxParticipants !== undefined) {
        const activeRegistrationsCount = await tx.registration.count({
          where: {
            eventId,
            status: RegistrationStatus.REGISTERED,
          },
        });

        if (activeRegistrationsCount >= maxParticipants) {
          throw new BadRequestException('Немає вільних місць');
        }
      }

      if (existingRegistration?.status === RegistrationStatus.CANCELED) {
        return tx.registration.update({
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
          data: {
            status: RegistrationStatus.REGISTERED,
          },
          include: {
            event: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });
      }

      return tx.registration.create({
        data: {
          userId,
          eventId,
          status: RegistrationStatus.REGISTERED,
        },
        include: {
          event: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    const newCount = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.REGISTERED },
    });
    this.eventsGateway.emitParticipantsUpdated(eventId, newCount);
    this.eventsGateway.emitParticipantsUpdatedGlobal(eventId, newCount);

    return result;
  }

  async cancel(eventId: string, userId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      include: {
        event: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Реєстрацію не знайдено');
    }

    if (registration.status === RegistrationStatus.CANCELED) {
      throw new BadRequestException('Реєстрацію вже скасовано');
    }

    if (
      registration.event.status === EventStatus.COMPLETED ||
      registration.event.status === EventStatus.CANCELED
    ) {
      throw new BadRequestException(
        'Неможливо скасувати реєстрацію для завершеної або скасованої події',
      );
    }

    const cancelled = await this.prisma.registration.update({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      data: {
        status: RegistrationStatus.CANCELED,
      },
      include: {
        event: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const newCount = await this.prisma.registration.count({
      where: { eventId, status: RegistrationStatus.REGISTERED },
    });
    this.eventsGateway.emitParticipantsUpdated(eventId, newCount);
    this.eventsGateway.emitParticipantsUpdatedGlobal(eventId, newCount);

    return cancelled;
  }

  async adminCancelRegistration(registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
        event: {
          select: {
            title: true,
            startAt: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Реєстрацію не знайдено');
    }

    if (registration.status === RegistrationStatus.CANCELED) {
      throw new BadRequestException('Реєстрацію вже скасовано');
    }

    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: { status: RegistrationStatus.CANCELED },
    });

    await this.notificationsService.sendRegistrationCancelledByAdmin(
      registration.userId,
      registration.eventId,
      registration.user.email,
      registration.user.fullName ?? '',
      registration.event.title,
      registration.event.startAt,
    );

    return updated;
  }

  async getMyRegistrations(userId: string) {
    const registrations = await this.prisma.registration.findMany({
      where: {
        userId,
      },
      orderBy: {
        event: {
          startAt: 'asc',
        },
      },
      include: {
        event: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                registrations: {
                  where: {
                    status: RegistrationStatus.REGISTERED,
                  },
                },
              },
            },
          },
        },
      },
    });

    const mapRegistration = (reg: (typeof registrations)[number]) => ({
      ...reg,
      event: {
        ...reg.event,
        participantsCount: reg.event._count.registrations,
        _count: undefined,
      },
    });

    const upcoming = registrations
      .filter(
        (reg) =>
          reg.event.status !== EventStatus.COMPLETED &&
          reg.event.status !== EventStatus.CANCELED &&
          reg.status === RegistrationStatus.REGISTERED,
      )
      .map(mapRegistration);

    const completed = registrations
      .filter(
        (reg) =>
          reg.event.status === EventStatus.COMPLETED &&
          reg.status === RegistrationStatus.REGISTERED,
      )
      .map(mapRegistration);

    return { upcoming, completed };
  }

  async getEventRegistrations(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Подію не знайдено');
    }

    const registrations = await this.prisma.registration.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            position: true,
            avatarUrl: true,
          },
        },
      },
    });

    return registrations.map((r) => ({
      registrationId: r.id,
      status: r.status,
      registeredAt: r.createdAt,
      user: r.user,
    }));
  }
}
