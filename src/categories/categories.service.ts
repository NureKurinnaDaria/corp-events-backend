import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });

    if (existingCategory) {
      throw new BadRequestException('Категорія з такою назвою вже існує');
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
      },
    });
  }

  async findAll(query: GetCategoriesQueryDto) {
    const search = query.search?.trim();
    const sortOrder = query.sortOrder ?? 'asc';

    return this.prisma.category.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: {
        name: sortOrder,
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Категорію не знайдено');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException('Категорію не знайдено');
    }

    if (dto.name && dto.name !== existingCategory.name) {
      const categoryWithSameName = await this.prisma.category.findUnique({
        where: { name: dto.name },
      });

      if (categoryWithSameName) {
        throw new BadRequestException('Категорія з такою назвою вже існує');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
      },
    });
  }

  async remove(id: string) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException('Категорію не знайдено');
    }

    const eventsCount = await this.prisma.event.count({
      where: { categoryId: id },
    });

    if (eventsCount > 0) {
      throw new BadRequestException(
        "Неможливо видалити категорію, до якої прив'язані події",
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return {
      message: 'Категорію успішно видалено',
    };
  }
}
