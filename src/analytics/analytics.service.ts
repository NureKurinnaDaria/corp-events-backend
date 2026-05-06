import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics() {
    const [totalEvents, totalRegistrations, feedbacks, categories, eventStats] =
      await Promise.all([
        this.prisma.event.count(),
        this.prisma.registration.count({ where: { status: 'REGISTERED' } }),
        this.prisma.feedback.findMany({ select: { rating: true } }),
        this.prisma.category.findMany({
          include: {
            _count: { select: { events: true } },
            events: {
              include: {
                _count: { select: { registrations: true } },
              },
            },
          },
        }),
        this.prisma.event.findMany({
          include: {
            _count: { select: { registrations: true } },
            feedbacks: { select: { rating: true } },
            category: { select: { name: true } },
          },
        }),
      ]);

    const avgRating =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
        : 0;

    const topByRegistrations = [...eventStats]
      .sort((a, b) => b._count.registrations - a._count.registrations)
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: e.title,
        registrations: e._count.registrations,
      }));

    const topByRating = eventStats
      .filter((e) => e.feedbacks.length > 0)
      .map((e) => ({
        id: e.id,
        title: e.title,
        avgRating:
          e.feedbacks.reduce((sum, f) => sum + f.rating, 0) /
          e.feedbacks.length,
        feedbackCount: e.feedbacks.length,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 5);

    const categoryStats = categories.map((c) => {
      const totalRegs = c.events.reduce(
        (sum, e) => sum + e._count.registrations,
        0,
      );
      return {
        id: c.id,
        name: c.name,
        eventsCount: c._count.events,
        registrationsCount: totalRegs,
      };
    });

    return {
      totalEvents,
      totalRegistrations,
      avgRating: Math.round(avgRating * 10) / 10,
      topByRegistrations,
      topByRating,
      categoryStats,
    };
  }
}
