import { Router, type Request, type Response } from 'express';
import {
  MAX_TAPS_PER_REQUEST,
  applyTaps,
  regenerateEnergy,
  toGameState,
} from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const gameRouter = Router();

gameRouter.use(requireTelegramAuth);

const USER_NOT_FOUND = {
  error: 'Пользователь не найден, выполните вход заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/game/state — текущий баланс и энергия (с учётом восстановления). */
gameRouter.get('/state', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(USER_NOT_FOUND);
    return;
  }

  const { energy } = regenerateEnergy(user, new Date());
  res.json({ state: toGameState({ ...user, energy }) });
});

/** POST /api/game/tap — тело: { "taps": 1..50 }. */
gameRouter.post('/tap', async (req: Request, res: Response) => {
  const { taps } = req.body as { taps?: unknown };

  if (typeof taps !== 'number' || !Number.isInteger(taps) || taps < 1) {
    res.status(400).json({ error: 'Ожидалось поле taps (целое число ≥ 1)' });
    return;
  }

  if (taps > MAX_TAPS_PER_REQUEST) {
    res.status(400).json({
      error: `За один запрос можно засчитать не больше ${MAX_TAPS_PER_REQUEST} тапов`,
    });
    return;
  }

  const result = await applyTaps(getTelegramId(res), taps);

  if (!result) {
    res.status(404).json(USER_NOT_FOUND);
    return;
  }

  res.json(result);
});
