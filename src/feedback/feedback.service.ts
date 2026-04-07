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
      throw new NotFoundException('User not found');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Feedback can only be left after the event is completed',
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
        'You cannot leave feedback because you are not registered for this event',
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
      throw new BadRequestException(
        'You have already left feedback for this event',
      );
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
      throw new NotFoundException('Event not found');
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
      throw new NotFoundException('Feedback not found');
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
      throw new NotFoundException('Feedback not found');
    }

    const isOwner = feedback.userId === currentUserId;

    if (!isOwner) {
      throw new ForbiddenException('You can only update your own feedback');
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
      throw new NotFoundException('Feedback not found');
    }

    const isAdmin = currentUserRole === Role.ADMIN;
    const isOwner = feedback.userId === currentUserId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You can only delete your own feedback');
    }

    await this.prisma.feedback.delete({
      where: { id },
    });

    return {
      message: 'Feedback deleted successfully',
    };
  }
}
