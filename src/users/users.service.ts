import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        phone: true,
        position: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundException('Користувача не знайдено');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.password !== undefined && {
          passwordHash: await bcrypt.hash(dto.password, 10),
        }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        phone: true,
        position: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  async getAllUsers(search?: string) {
    const users = await this.prisma.user.findMany({
      where: search
        ? {
            role: 'EMPLOYEE',
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : { role: 'EMPLOYEE' },
      select: {
        id: true,
        email: true,
        fullName: true,
        position: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      position: u.position,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      registrationsCount: u._count.registrations,
    }));
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        position: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        registrations: {
          where: { status: 'REGISTERED' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            event: {
              select: {
                id: true,
                title: true,
                startAt: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        feedbacks: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            event: {
              select: { id: true, title: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    return user;
  }

  async setUserActive(adminId: string, userId: string, isActive: boolean) {
    if (adminId === userId) {
      throw new ForbiddenException('Не можна заблокувати самого себе');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Не можна заблокувати адміністратора');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
      },
    });
  }
}
