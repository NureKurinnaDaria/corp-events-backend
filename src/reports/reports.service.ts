import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { AddReportPhotoDto } from './dto/add-report-photo.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createReportDto: CreateReportDto, currentUserRole: Role) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Тільки адміністратор може створювати звіти',
      );
    }

    const { eventId, text } = createReportDto;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Подію не знайдено');
    }

    if (event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Звіт можна створити тільки для завершеної події',
      );
    }

    const existingReport = await this.prisma.eventReport.findUnique({
      where: { eventId },
    });

    if (existingReport) {
      throw new BadRequestException('Для цієї події вже існує звіт');
    }

    const report = await this.prisma.eventReport.create({
      data: {
        eventId,
        text,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
        photos: true,
      },
    });

    void this.notificationsService.notifyRegisteredUsersOnReportCreated(
      eventId,
    );

    return report;
  }

  async findByEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Подію не знайдено');
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { eventId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
        photos: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Звіт не знайдено');
    }

    return report;
  }

  async findOne(id: string) {
    const report = await this.prisma.eventReport.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
        photos: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Звіт не знайдено');
    }

    return report;
  }

  async update(
    id: string,
    updateReportDto: UpdateReportDto,
    currentUserRole: Role,
  ) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Тільки адміністратор може редагувати звіти',
      );
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Звіт не знайдено');
    }

    return this.prisma.eventReport.update({
      where: { id },
      data: {
        ...(updateReportDto.text !== undefined && {
          text: updateReportDto.text,
        }),
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        photos: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async remove(id: string, currentUserRole: Role) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException('Тільки адміністратор може видаляти звіти');
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Звіт не знайдено');
    }

    await this.prisma.eventReport.delete({
      where: { id },
    });

    return {
      message: 'Звіт успішно видалено',
    };
  }

  async addPhoto(
    reportId: string,
    addReportPhotoDto: AddReportPhotoDto,
    currentUserRole: Role,
  ) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Тільки адміністратор може додавати фото до звіту',
      );
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Звіт не знайдено');
    }

    return this.prisma.reportPhoto.create({
      data: {
        reportId,
        url: addReportPhotoDto.url,
      },
    });
  }

  async deletePhoto(photoId: string, currentUserRole: Role) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Тільки адміністратор може видаляти фото зі звіту',
      );
    }

    const photo = await this.prisma.reportPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException('Фото звіту не знайдено');
    }

    await this.prisma.reportPhoto.delete({
      where: { id: photoId },
    });

    return {
      message: 'Фото успішно видалено',
    };
  }
}
