import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics() {
    const [
      totalEvents,
      totalRegistrations,
      feedbacks,
      categories,
      eventStats,
      allEvents,
      activeUsersRaw,
    ] = await Promise.all([
      this.prisma.event.count(),
      this.prisma.registration.count({ where: { status: 'REGISTERED' } }),
      this.prisma.feedback.findMany({ select: { rating: true } }),
      this.prisma.category.findMany({
        include: {
          _count: { select: { events: true } },
          events: {
            include: { _count: { select: { registrations: true } } },
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
      this.prisma.event.findMany({
        select: {
          startAt: true,
          format: true,
          maxParticipants: true,
          _count: { select: { registrations: true } },
        },
      }),
      this.prisma.registration.findMany({
        where: { status: 'REGISTERED' },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const avgRating =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
        : 0;

    const avgFillRate =
      allEvents.length > 0
        ? allEvents.reduce((sum, e) => {
            const fill =
              e.maxParticipants && e.maxParticipants > 0
                ? (e._count.registrations / e.maxParticipants) * 100
                : 0;
            return sum + fill;
          }, 0) / allEvents.length
        : 0;

    const activeUsers = activeUsersRaw.length;
    const totalFeedbacks = feedbacks.length;

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

    const now = new Date();
    const monthlyActivity = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const count = allEvents.filter(
        (e) => e.startAt >= date && e.startAt < nextDate,
      ).length;
      return {
        month: date.toLocaleDateString('uk-UA', {
          month: 'short',
          year: '2-digit',
        }),
        події: count,
      };
    });

    const onlineCount = allEvents.filter((e) => e.format === 'ONLINE').length;
    const offlineCount = allEvents.filter((e) => e.format === 'OFFLINE').length;
    const formatStats = [
      { name: 'Online', value: onlineCount },
      { name: 'Offline', value: offlineCount },
    ];

    return {
      totalEvents,
      totalRegistrations,
      avgRating: Math.round(avgRating * 10) / 10,
      avgFillRate: Math.round(avgFillRate),
      activeUsers,
      totalFeedbacks,
      topByRegistrations,
      topByRating,
      categoryStats,
      monthlyActivity,
      formatStats,
    };
  }

  async getPeriodReport(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const events = await this.prisma.event.findMany({
      where: {
        startAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        category: true,
        registrations: {
          where: { status: 'REGISTERED' },
        },
        feedbacks: {
          select: { rating: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const mapped = events.map((e) => {
      const regs = e.registrations.length;
      const fillRate =
        e.maxParticipants != null && e.maxParticipants > 0
          ? Math.round((regs / e.maxParticipants) * 100)
          : null;
      const avgRating =
        e.feedbacks.length > 0
          ? Math.round(
              (e.feedbacks.reduce((s, f) => s + f.rating, 0) /
                e.feedbacks.length) *
                10,
            ) / 10
          : null;
      return {
        id: e.id,
        title: e.title,
        category: e.category?.name ?? '',
        date: e.startAt.toISOString(),
        format: e.format,
        status: e.status,
        registrations: regs,
        maxParticipants: e.maxParticipants,
        fillRate,
        avgRating,
        feedbackCount: e.feedbacks.length,
      };
    });

    const totalRegistrations = mapped.reduce((s, e) => s + e.registrations, 0);
    const fillRates = mapped
      .filter((e) => e.fillRate != null)
      .map((e) => e.fillRate as number);
    const avgFillRate =
      fillRates.length > 0
        ? Math.round(fillRates.reduce((s, v) => s + v, 0) / fillRates.length)
        : null;
    const ratings = mapped
      .filter((e) => e.avgRating != null)
      .map((e) => e.avgRating as number);
    const avgRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((s, v) => s + v, 0) / ratings.length) * 10,
          ) / 10
        : null;

    return {
      from,
      to,
      totalEvents: mapped.length,
      totalRegistrations,
      avgFillRate,
      avgRating,
      events: mapped,
    };
  }
}
