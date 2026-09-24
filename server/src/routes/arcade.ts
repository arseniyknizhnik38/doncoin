import { Router, type Request, type Response } from 'express';
import { utcDayNumber } from '../config/rewards.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const arcadeRouter = Router();

arcadeRouter.use(requireTelegramAuth);
arcadeRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/**
 * «Сбор выручки» — единственная скилловая минута в игре.
 *
 * Забег раз в день: тапай по падающим пачкам, не трогай жетоны. Очки
 * превращаются в монеты по курсу «очко = один тап»: награда растёт вместе
 * с прокачкой, но никогда не обгоняет честный заработок руками — это
 * дневной бонус за ловкость, а не станок.
 *
 * Потолок очков — от геометрии забега: больше предметов, чем спавнится,
 * поймать нельзя, и присланный с клиента счёт выше потолка — это не
 * рекорд, а подделка.
 */
export const ARCADE_MAX_SCORE = 1_500;

arcadeRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const today = utcDayNumber(new Date());

  res.json({
    arcade: {
      available: user.arcadeDay < today,
      best: user.arcadeBest,
      /** Во сколько монет превращается одно очко. */
      perPoint: user.coinsPerTap,
      maxScore: ARCADE_MAX_SCORE,
    },
  });
});

/** POST /api/arcade/claim — сдать выручку забега. */
arcadeRouter.post('/claim', async (req: Request, res: Response) => {
  const { score } = (req.body ?? {}) as { score?: unknown };

  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > ARCADE_MAX_SCORE
  ) {
    res.status(400).json({ error: 'Такой выручки не бывает', code: 'BAD_SCORE' });
    return;
  }

  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();
  const today = utcDayNumber(now);
  const reward = BigInt(score) * BigInt(user.coinsPerTap);

  // День закрывается условием в UPDATE: два одновременных забега не
  // сдадут выручку дважды.
  const counted = await prisma.user.updateMany({
    where: { telegramId, arcadeDay: { lt: today } },
    data: {
      arcadeDay: today,
      arcadeBest: Math.max(user.arcadeBest, score),
      balance: { increment: reward },
      totalEarned: { increment: reward },
      lifetimeEarned: { increment: reward },
    },
  });

  if (counted.count === 0) {
    res.status(409).json({
      error: 'Выручка за сегодня уже сдана. Новый заход — завтра',
      code: 'ALREADY_PLAYED',
    });
    return;
  }

  const fresh = {
    ...user,
    balance: user.balance + reward,
    totalEarned: user.totalEarned + reward,
  };
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    reward: reward.toString(),
    best: Math.max(user.arcadeBest, score),
    isRecord: score > user.arcadeBest,
    state: toGameState({ ...fresh, energy }),
  });
});
