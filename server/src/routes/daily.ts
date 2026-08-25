import { Router, type Request, type Response } from 'express';
import {
  DAILY_STREAK_CAP,
  dailyReward,
  dailyStatus,
  utcDayNumber,
} from '../config/rewards.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const dailyRouter = Router();

dailyRouter.use(requireTelegramAuth);
dailyRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/daily — можно ли забрать бонус и какой. */
dailyRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({ daily: { ...dailyStatus(user, new Date()), streakCap: DAILY_STREAK_CAP } });
});

/** POST /api/daily/claim — забрать бонус за сегодня. */
dailyRouter.post('/claim', async (_req: Request, res: Response) => {
  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();
  const status = dailyStatus(user, now);

  if (!status.available) {
    res.status(409).json({ error: 'Бонус за сегодня уже получен', code: 'ALREADY_CLAIMED' });
    return;
  }

  const reward = dailyReward(user, status.nextStreak);
  const today = utcDayNumber(now);

  // Условие по дате отсекает второй запрос: если бонус уже засчитан сегодня,
  // строка не совпадёт и списания не будет.
  const updated = await prisma.user.updateMany({
    where: {
      telegramId,
      OR: [
        { lastDailyAt: null },
        { lastDailyAt: { lt: new Date(today * 86_400_000) } },
      ],
    },
    data: {
      balance: { increment: reward },
      totalEarned: { increment: reward },
      dailyStreak: status.nextStreak,
      lastDailyAt: now,
    },
  });

  if (updated.count === 0) {
    res.status(409).json({ error: 'Бонус за сегодня уже получен', code: 'ALREADY_CLAIMED' });
    return;
  }

  const fresh = {
    ...user,
    balance: user.balance + reward,
    totalEarned: user.totalEarned + reward,
    dailyStreak: status.nextStreak,
    lastDailyAt: now,
  };
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    reward: reward.toString(),
    streak: status.nextStreak,
    daily: { ...dailyStatus(fresh, now), streakCap: DAILY_STREAK_CAP },
    state: toGameState({ ...fresh, energy }),
  });
});
