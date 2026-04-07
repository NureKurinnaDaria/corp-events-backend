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

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createReportDto: CreateReportDto, currentUserRole: Role) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can create reports');
    }

    const { eventId, text } = createReportDto;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Report can only be created for a completed event',
      );
    }

    const existingReport = await this.prisma.eventReport.findUnique({
      where: { eventId },
    });

    if (existingReport) {
      throw new BadRequestException('This event already has a report');
    }

    return this.prisma.eventReport.create({
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
  }

  async findByEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
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
      throw new NotFoundException('Report not found');
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
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async update(
    id: string,
    updateReportDto: UpdateReportDto,
    currentUserRole: Role,
  ) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can update reports');
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
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
      throw new ForbiddenException('Only admin can delete reports');
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.eventReport.delete({
      where: { id },
    });

    return {
      message: 'Report deleted successfully',
    };
  }

  async addPhoto(
    reportId: string,
    addReportPhotoDto: AddReportPhotoDto,
    currentUserRole: Role,
  ) {
    if (currentUserRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can add report photos');
    }

    const report = await this.prisma.eventReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
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
      throw new ForbiddenException('Only admin can delete report photos');
    }

    const photo = await this.prisma.reportPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException('Report photo not found');
    }

    await this.prisma.reportPhoto.delete({
      where: { id: photoId },
    });

    return {
      message: 'Report photo deleted successfully',
    };
  }
}
