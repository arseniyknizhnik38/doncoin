import { Router, type Request, type Response } from 'express';
import { resolveRank } from '../config/ranks.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const leaderboardRouter = Router();

leaderboardRouter.use(requireTelegramAuth);
leaderboardRouter.use(writeRateLimit());

/** Сколько строк показываем в каждом топе. */
const TOP_LIMIT = 50;

const displayName = (entry: { firstName: string | null; username: string | null }) =>
  entry.firstName ?? (entry.username ? `@${entry.username}` : 'Аноним');

/**
 * GET /api/leaderboard — топ игроков по заработанному и топ кланов по общаку,
 * плюс собственная позиция в обоих.
 *
 * Позиция считается через COUNT «сколько выше меня» — по индексу это дешевле,
 * чем нумеровать всю таблицу.
 */
leaderboardRouter.get('/', async (_req: Request, res: Response) => {
  const telegramId = getTelegramId(res);

  const me = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      id: true,
      firstName: true,
      username: true,
      totalEarned: true,
      respect: true,
      clanId: true,
    },
  });

  if (!me) {
    res.status(404).json({
      error: 'Пользователь не найден, войдите заново',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  const [players, playersAbove, clans, myClan] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ totalEarned: 'desc' }, { createdAt: 'asc' }],
      take: TOP_LIMIT,
      select: {
        id: true,
        firstName: true,
        username: true,
        totalEarned: true,
        respect: true,
        clan: { select: { name: true } },
      },
    }),
    prisma.user.count({ where: { totalEarned: { gt: me.totalEarned } } }),
    prisma.clan.findMany({
      orderBy: [{ treasury: 'desc' }, { createdAt: 'asc' }],
      take: TOP_LIMIT,
      select: {
        id: true,
        name: true,
        treasury: true,
        _count: { select: { members: true } },
      },
    }),
    me.clanId
      ? prisma.clan.findUnique({
          where: { id: me.clanId },
          select: { id: true, name: true, treasury: true },
        })
      : null,
  ]);

  const clansAbove = myClan
    ? await prisma.clan.count({ where: { treasury: { gt: myClan.treasury } } })
    : 0;

  res.json({
    players: {
      top: players.map((player, index) => ({
        position: index + 1,
        name: displayName(player),
        totalEarned: player.totalEarned.toString(),
        respect: player.respect,
        rank: resolveRank(player.totalEarned).title,
        clan: player.clan?.name ?? null,
        isMe: player.id === me.id,
      })),
      me: {
        position: playersAbove + 1,
        name: displayName(me),
        totalEarned: me.totalEarned.toString(),
        respect: me.respect,
        rank: resolveRank(me.totalEarned).title,
      },
    },
    clans: {
      top: clans.map((clan, index) => ({
        position: index + 1,
        name: clan.name,
        treasury: clan.treasury.toString(),
        memberCount: clan._count.members,
        isMine: clan.id === me.clanId,
      })),
      me: myClan
        ? {
            position: clansAbove + 1,
            name: myClan.name,
            treasury: myClan.treasury.toString(),
          }
        : null,
    },
  });
});
