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

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
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
        throw new BadRequestException('endAt must be later than startAt');
      }
    }

    if (!isUpdate || dto.format === EventFormat.ONLINE) {
      if (dto.format === EventFormat.ONLINE && !dto.onlineUrl) {
        throw new BadRequestException(
          'onlineUrl is required for ONLINE events',
        );
      }
    }

    if (!isUpdate || dto.format === EventFormat.OFFLINE) {
      if (dto.format === EventFormat.OFFLINE && !dto.location) {
        throw new BadRequestException(
          'location is required for OFFLINE events',
        );
      }
    }

    if (dto.maxParticipants !== undefined && dto.maxParticipants < 1) {
      throw new BadRequestException('maxParticipants must be greater than 0');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new BadRequestException('Category not found');
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

      if (
        query.status &&
        !this.employeeVisibleStatuses.includes(query.status)
      ) {
        throw new ForbiddenException(
          'Employees can only view published or ongoing events',
        );
      }

      if (query.status) {
        where.status = query.status;
      }
    }

    return this.prisma.event.findMany({
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
      },
    });
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
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (
      role === Role.EMPLOYEE &&
      !this.employeeVisibleStatuses.includes(event.status)
    ) {
      throw new ForbiddenException('You do not have access to this event');
    }

    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw new NotFoundException('Event not found');
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
        status: dto.status,
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

    // Якщо статус змінився на COMPLETED — надсилаємо feedback reminder
    if (
      dto.status === EventStatus.COMPLETED &&
      existingEvent.status !== EventStatus.COMPLETED
    ) {
      void this.notificationsService.notifyRegisteredUsersOnEventCompleted(id);
    }

    return updated;
  }

  async remove(id: string) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existingEvent) {
      throw new NotFoundException('Event not found');
    }

    if (existingEvent.registrations.length > 0) {
      throw new BadRequestException(
        'Cannot delete event with existing registrations. Use CANCELED status instead.',
      );
    }

    await this.prisma.event.delete({
      where: { id },
    });

    return {
      message: 'Event deleted successfully',
    };
  }
}
