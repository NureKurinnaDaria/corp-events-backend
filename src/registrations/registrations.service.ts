import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException('Event not found');
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException(
        'You can register only for published events',
      );
    }

    const existingRegistration = await this.prisma.registration.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (existingRegistration?.status === RegistrationStatus.REGISTERED) {
      throw new BadRequestException('Registration already exists');
    }

    const activeRegistrationsCount = await this.prisma.registration.count({
      where: {
        eventId,
        status: RegistrationStatus.REGISTERED,
      },
    });

    if (
      event.maxParticipants !== null &&
      event.maxParticipants !== undefined &&
      activeRegistrationsCount >= event.maxParticipants
    ) {
      throw new BadRequestException('No available places');
    }

    if (existingRegistration?.status === RegistrationStatus.CANCELED) {
      return this.prisma.registration.update({
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

    return this.prisma.registration.create({
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
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === RegistrationStatus.CANCELED) {
      throw new BadRequestException('Registration is already canceled');
    }

    if (
      registration.event.status === EventStatus.COMPLETED ||
      registration.event.status === EventStatus.CANCELED
    ) {
      throw new BadRequestException(
        'Cannot cancel registration for completed or canceled event',
      );
    }

    return this.prisma.registration.update({
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
          },
        },
      },
    });

    const upcoming = registrations.filter(
      (registration) => registration.event.status !== EventStatus.COMPLETED,
    );

    const completed = registrations.filter(
      (registration) => registration.event.status === EventStatus.COMPLETED,
    );

    return {
      upcoming,
      completed,
    };
  }

  async getEventRegistrations(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.registration.findMany({
      where: {
        eventId,
      },
      orderBy: {
        createdAt: 'asc',
      },
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
  }
}
