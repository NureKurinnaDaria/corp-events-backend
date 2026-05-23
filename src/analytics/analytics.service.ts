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

    // KPI
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

    // Top by registrations
    const topByRegistrations = [...eventStats]
      .sort((a, b) => b._count.registrations - a._count.registrations)
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: e.title,
        registrations: e._count.registrations,
      }));

    // Top by rating
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

    // Category stats
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

    // Activity by month (last 6 months)
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

    // Format split
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
}
