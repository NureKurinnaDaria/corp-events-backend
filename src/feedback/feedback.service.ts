import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, RegistrationStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFeedbackDto: CreateFeedbackDto, currentUserId: string) {
    const { eventId, rating, comment } = createFeedbackDto;

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Подію не знайдено');
    }

    if (event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Відгук можна залишити тільки після завершення події',
      );
    }

    const registration = await this.prisma.registration.findUnique({
      where: {
        userId_eventId: {
          userId: currentUserId,
          eventId,
        },
      },
    });

    if (
      !registration ||
      registration.status !== RegistrationStatus.REGISTERED
    ) {
      throw new ForbiddenException(
        'Ви не можете залишити відгук, оскільки не зареєстровані на цю подію',
      );
    }

    const existingFeedback = await this.prisma.feedback.findUnique({
      where: {
        userId_eventId: {
          userId: currentUserId,
          eventId,
        },
      },
    });

    if (existingFeedback) {
      throw new BadRequestException('Ви вже залишили відгук для цієї події');
    }

    return this.prisma.feedback.create({
      data: {
        userId: currentUserId,
        eventId,
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  async findMyFeedbacks(currentUserId: string) {
    return this.prisma.feedback.findMany({
      where: { userId: currentUserId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Подію не знайдено');
    }

    return this.prisma.feedback.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            position: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!feedback) {
      throw new NotFoundException('Відгук не знайдено');
    }

    return feedback;
  }

  async update(
    id: string,
    updateFeedbackDto: UpdateFeedbackDto,
    currentUserId: string,
  ) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      throw new NotFoundException('Відгук не знайдено');
    }

    const isOwner = feedback.userId === currentUserId;

    if (!isOwner) {
      throw new ForbiddenException(
        'Ви можете редагувати тільки власний відгук',
      );
    }

    return this.prisma.feedback.update({
      where: { id },
      data: {
        ...(updateFeedbackDto.rating !== undefined && {
          rating: updateFeedbackDto.rating,
        }),
        ...(updateFeedbackDto.comment !== undefined && {
          comment: updateFeedbackDto.comment,
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  async remove(id: string, currentUserId: string, currentUserRole: Role) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      throw new NotFoundException('Відгук не знайдено');
    }

    const isAdmin = currentUserRole === Role.ADMIN;
    const isOwner = feedback.userId === currentUserId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Ви можете видаляти тільки власний відгук');
    }

    await this.prisma.feedback.delete({
      where: { id },
    });

    return {
      message: 'Відгук успішно видалено',
    };
  }
}
