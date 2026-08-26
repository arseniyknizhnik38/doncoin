import { Router, type Request, type Response } from 'express';
import { isAdmin } from '../config/admin.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const adminRouter = Router();

adminRouter.use(requireTelegramAuth);
adminRouter.use(writeRateLimit());

/** Отсекаем всех, кроме перечисленных в ADMIN_TELEGRAM_IDS. */
adminRouter.use((_req: Request, res: Response, next) => {
  if (!isAdmin(getTelegramId(res))) {
    // 404, а не 403: посторонним незачем знать, что такой раздел существует.
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  next();
});

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

/** GET /api/admin/stats — сводка по игрокам, воронке и экономике. */
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  const day = hoursAgo(24);
  const week = hoursAgo(24 * 7);

  const [
    total,
    newToday,
    newWeek,
    dau,
    wau,
    withUpgrade,
    withBusiness,
    inClan,
    claimedDaily,
    invited,
    completedFavor,
    money,
    clans,
    topPlayers,
    returnedRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: day } } }),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: day } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: week } } }),
    prisma.user.count({
      where: {
        OR: [{ tapLevel: { gt: 0 } }, { energyLevel: { gt: 0 } }, { regenLevel: { gt: 0 } }],
      },
    }),
    prisma.userBusiness.findMany({ distinct: ['userId'], select: { userId: true } }),
    prisma.user.count({ where: { clanId: { not: null } } }),
    prisma.user.count({ where: { lastDailyAt: { not: null } } }),
    prisma.user.count({ where: { referredById: { not: null } } }),
    prisma.favorCompletion.findMany({ distinct: ['userId'], select: { userId: true } }),
    prisma.user.aggregate({
      _sum: { balance: true, totalEarned: true },
      _max: { totalEarned: true },
    }),
    prisma.clan.count(),
    prisma.user.findMany({
      orderBy: { totalEarned: 'desc' },
      take: 5,
      select: { firstName: true, username: true, totalEarned: true, lastSeenAt: true },
    }),
    // Вернулся ли игрок хотя бы через сутки после регистрации — сравнение
    // двух колонок, которого нет в обычном where.
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "User"
      WHERE "lastSeenAt" >= "createdAt" + INTERVAL '24 hours'
    `,
  ]);

  const olderThanDay = await prisma.user.count({
    where: { createdAt: { lt: day } },
  });
  const returned = Number(returnedRows[0]?.count ?? 0n);

  res.json({
    players: {
      total,
      newToday,
      newWeek,
      dau,
      wau,
      /** Из тех, кто зарегистрировался больше суток назад. */
      returnedNextDay: returned,
      eligibleForReturn: olderThanDay,
    },
    funnel: {
      boughtUpgrade: withUpgrade,
      boughtBusiness: withBusiness.length,
      joinedClan: inClan,
      claimedDaily,
      cameFromReferral: invited,
      completedFavor: completedFavor.length,
    },
    economy: {
      inCirculation: (money._sum.balance ?? 0n).toString(),
      totalEarned: (money._sum.totalEarned ?? 0n).toString(),
      richest: (money._max.totalEarned ?? 0n).toString(),
      clans,
    },
    top: topPlayers.map((player) => ({
      name: player.firstName ?? (player.username ? `@${player.username}` : 'Аноним'),
      totalEarned: player.totalEarned.toString(),
      lastSeenAt: player.lastSeenAt,
    })),
  });
});
