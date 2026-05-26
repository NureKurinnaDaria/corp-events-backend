import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventFormat, EventStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { GetEventsQueryDto } from './dto/get-events-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private readonly employeeVisibleStatuses: EventStatus[] = [
    EventStatus.PUBLISHED,
    EventStatus.ONGOING,
  ];

  private async validateEventData(
    dto: {
      startAt?: string;
      endAt?: string;
      format?: EventFormat;
      location?: string;
      onlineUrl?: string;
      categoryId?: string;
      maxParticipants?: number;
    },
    isUpdate = false,
  ) {
    if (dto.startAt && dto.endAt) {
      const startAt = new Date(dto.startAt);
      const endAt = new Date(dto.endAt);

      if (endAt <= startAt) {
        throw new BadRequestException(
          'Дата закінчення має бути пізніше дати початку',
        );
      }
    }

    if (!isUpdate || dto.format === EventFormat.ONLINE) {
      if (dto.format === EventFormat.ONLINE && !dto.onlineUrl) {
        throw new BadRequestException("Посилання обов'язкове для онлайн-подій");
      }
    }

    if (!isUpdate || dto.format === EventFormat.OFFLINE) {
      if (dto.format === EventFormat.OFFLINE && !dto.location) {
        throw new BadRequestException(
          "Місце проведення обов'язкове для офлайн-подій",
        );
      }
    }

    if (dto.maxParticipants !== undefined && dto.maxParticipants < 1) {
      throw new BadRequestException(
        'Максимальна кількість учасників має бути більше 0',
      );
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new BadRequestException('Категорію не знайдено');
      }
    }
  }

  async create(userId: string, dto: CreateEventDto) {
    await this.validateEventData(dto);

    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        format: dto.format,
        location: dto.location,
        onlineUrl: dto.onlineUrl,
        maxParticipants: dto.maxParticipants,
        categoryId: dto.categoryId,
        status: dto.status ?? EventStatus.PUBLISHED,
        createdById: userId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Нотифікуємо всіх EMPLOYEE про нову подію (fire-and-forget)
    void this.notificationsService.notifyAllEmployeesOnEventCreated(event.id);

    // WebSocket: нова подія з'являється у списку всіх підключених клієнтів
    this.eventsGateway.emitEventCreated({
      ...event,
      participantsCount: 0,
    });

    return event;
  }

  async findAll(query: GetEventsQueryDto, role: Role) {
    const search = query.search?.trim();
    const sortOrder = query.sortOrder ?? 'asc';

    const where: any = {
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.format ? { format: query.format } : {}),
    };

    if (role === Role.ADMIN) {
      if (query.status) {
        where.status = query.status;
      }
    } else {
      where.status = {
        in: this.employeeVisibleStatuses,
      };
      // Показуємо тільки події що ще не почались
      where.startAt = { gt: new Date() };

      if (
        query.status &&
        !this.employeeVisibleStatuses.includes(query.status)
      ) {
        throw new ForbiddenException(
          'Співробітники можуть переглядати тільки опубліковані або активні події',
        );
      }

      if (query.status) {
        where.status = query.status;
      }
    }

    if (query.date) {
      const now = new Date();
      if (query.date === 'this_week') {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        where.startAt = { gte: now, lte: endOfWeek };
      } else if (query.date === 'this_month') {
        const endOfMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        where.startAt = { gte: now, lte: endOfMonth };
      }
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: {
        startAt: sortOrder,
      },
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
                status: 'REGISTERED',
              },
            },
          },
        },
      },
    });

    return events.map((event) => ({
      ...event,
      participantsCount: event._count.registrations,
      _count: undefined,
    }));
  }

  async findOne(id: string, role: Role) {
    const event = await this.prisma.event.findUnique({
      where: { id },
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
                status: 'REGISTERED',
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Подію не знайдено');
    }

    if (
      role === Role.EMPLOYEE &&
      !this.employeeVisibleStatuses.includes(event.status)
    ) {
      throw new ForbiddenException('Немає доступу до цієї події');
    }

    return {
      ...event,
      participantsCount: event._count.registrations,
      _count: undefined,
    };
  }

  async update(id: string, dto: UpdateEventDto) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Подію не знайдено');
    }

    const mergedData = {
      startAt: dto.startAt ?? existingEvent.startAt.toISOString(),
      endAt: dto.endAt ?? existingEvent.endAt.toISOString(),
      format: dto.format ?? existingEvent.format,
      location: dto.location ?? existingEvent.location ?? undefined,
      onlineUrl: dto.onlineUrl ?? existingEvent.onlineUrl ?? undefined,
      categoryId: dto.categoryId ?? existingEvent.categoryId ?? undefined,
      maxParticipants:
        dto.maxParticipants ?? existingEvent.maxParticipants ?? undefined,
    };

    await this.validateEventData(mergedData, true);

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        format: dto.format,
        location: dto.location,
        onlineUrl: dto.onlineUrl,
        maxParticipants: dto.maxParticipants,
        categoryId: dto.categoryId,
      },
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
              where: { status: 'REGISTERED' },
            },
          },
        },
      },
    });

    const changedFields = {
      startAt: !!dto.startAt,
      endAt: !!dto.endAt,
      location: !!dto.location,
      onlineUrl: !!dto.onlineUrl,
    };
    const hasImportantChanges = Object.values(changedFields).some(Boolean);
    if (hasImportantChanges) {
      void this.notificationsService.notifyRegisteredUsersOnEventUpdated(
        id,
        changedFields,
      );
    }

    // WebSocket: сповіщаємо всіх хто зараз дивиться цю подію
    this.eventsGateway.emitEventStatusChanged(id, {
      status: updated.status,
      title: updated.title,
    });
    this.eventsGateway.emitParticipantsUpdated(
      id,
      updated._count.registrations,
    );

    return {
      ...updated,
      participantsCount: updated._count.registrations,
      _count: undefined,
    };
  }

  async cancel(id: string) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Подію не знайдено');
    }

    if (
      existingEvent.status !== EventStatus.PUBLISHED &&
      existingEvent.status !== EventStatus.ONGOING
    ) {
      throw new BadRequestException(
        'Скасувати можна тільки опубліковані або активні події',
      );
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELED },
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
              where: { status: 'REGISTERED' },
            },
          },
        },
      },
    });

    void this.notificationsService.notifyRegisteredUsersOnEventCanceled(id);

    // WebSocket: миттєво оновлюємо статус для всіх хто дивиться цю подію
    this.eventsGateway.emitEventStatusChanged(id, {
      status: 'CANCELED',
      title: updated.title,
    });

    return {
      ...updated,
      participantsCount: updated._count.registrations,
      _count: undefined,
    };
  }

  async remove(id: string) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Подію не знайдено');
    }

    if (existingEvent.status === EventStatus.PUBLISHED) {
      throw new BadRequestException(
        'Неможливо видалити опубліковану подію. Спочатку скасуйте її, щоб сповістити учасників.',
      );
    }

    if (existingEvent.status === EventStatus.ONGOING) {
      throw new BadRequestException(
        'Неможливо видалити активну подію. Спочатку скасуйте її, щоб сповістити учасників.',
      );
    }

    if (existingEvent.status === EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Неможливо видалити завершену подію. Завершені події зберігаються в архіві.',
      );
    }

    await this.prisma.event.delete({
      where: { id },
    });

    return {
      message: 'Подію успішно видалено',
    };
  }
}
