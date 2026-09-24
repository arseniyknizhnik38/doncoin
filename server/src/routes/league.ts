import { Router, type Request, type Response } from 'express';
import { ensureLeague, leagueView } from '../lib/league.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const leagueRouter = Router();

leagueRouter.use(requireTelegramAuth);
leagueRouter.use(writeRateLimit());

/**
 * GET /api/league — группа игрока на этой неделе.
 *
 * Перекат вызывается и здесь: игрок мог держать вкладку открытой через
 * полночь понедельника, и его таблица должна была смениться, а не врать.
 */
leagueRouter.get('/', async (_req: Request, res: Response) => {
  const stored = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!stored) {
    res.status(404).json({ error: 'Пользователь не найден, войдите заново', code: 'USER_NOT_FOUND' });
    return;
  }

  const now = new Date();
  const user = await ensureLeague(stored, now);

  res.json({ league: await leagueView(user, now) });
});
