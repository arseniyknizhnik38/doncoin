import { Router, type Request, type Response } from 'express';
import { describeBoosters } from '../config/boosters.js';
import { utcDayNumber } from '../config/rewards.js';
import { useBooster } from '../lib/boosters.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const boostersRouter = Router();

boostersRouter.use(requireTelegramAuth);
boostersRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/boosters — сколько зарядов осталось на сегодня. */
boostersRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();

  res.json({ boosters: describeBoosters(user, utcDayNumber(now), now) });
});

/** POST /api/boosters/:id/use — потратить заряд. */
boostersRouter.post('/:id/use', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();
  const fresh = await useBooster(user, id ?? '', now);
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    boosters: describeBoosters(fresh, utcDayNumber(now), now),
    state: toGameState({ ...fresh, energy }),
  });
});
