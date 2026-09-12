import { Router, type Request, type Response } from 'express';
import { utcDayNumber } from '../config/rewards.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { envelopeState, openEnvelope } from '../lib/envelope.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const envelopeRouter = Router();

envelopeRouter.use(requireTelegramAuth);
envelopeRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/envelope — заносят ли уже, и брали ли сегодня. */
envelopeRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({ envelope: envelopeState(user, new Date()) });
});

/** POST /api/envelope/open — открыть сегодняшний конверт. */
envelopeRouter.post('/open', async (_req: Request, res: Response) => {
  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();
  const { tier, amount } = await openEnvelope(user, now);

  // Перечитывать строку незачем: UPDATE прошёл ровно с теми условиями,
  // которые проверялись, значит результат известен точно.
  const fresh = {
    ...user,
    balance: user.balance + amount,
    totalEarned: user.totalEarned + amount,
    envelopeDay: utcDayNumber(now),
    envelopeTier: tier.id,
    envelopeAmount: amount,
  };
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    opened: { tier: tier.id, title: tier.title, amount: amount.toString() },
    envelope: envelopeState(fresh, now),
    state: toGameState({ ...fresh, energy }),
  });
});
