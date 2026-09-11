import { Router, type Request, type Response } from 'express';
import { describeRetirement } from '../config/retirement.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { retire } from '../lib/retirement.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const retirementRouter = Router();

retirementRouter.use(requireTelegramAuth);
retirementRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/retirement — сколько кругов пройдено и можно ли уйти. */
retirementRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({ retirement: describeRetirement(user.retirements, user.totalEarned) });
});

/**
 * POST /api/retirement — уйти на покой.
 *
 * Действие необратимое и обнуляет всё нажитое, поэтому подтверждение берётся
 * на клиенте, а здесь проверяется только право уйти.
 */
retirementRouter.post('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const fresh = await retire(user);
  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    retirement: describeRetirement(fresh.retirements, fresh.totalEarned),
    state: toGameState({ ...fresh, energy }),
  });
});
