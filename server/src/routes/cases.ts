import { Router, type Request, type Response } from 'express';
import { CaseError, caseView, claimCase, startCase } from '../lib/cases.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const casesRouter = Router();

casesRouter.use(requireTelegramAuth);
casesRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

async function loadUser(res: Response) {
  return prisma.user.findUnique({ where: { telegramId: getTelegramId(res) } });
}

/** GET /api/cases — текущее дело от Бобби. */
casesRouter.get('/', async (_req: Request, res: Response) => {
  const user = await loadUser(res);

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({ case: await caseView(user, new Date()) });
});

/** POST /api/cases/start — взять предложенное дело. */
casesRouter.post('/start', async (_req: Request, res: Response) => {
  const user = await loadUser(res);

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();

  try {
    await startCase(user, now);
  } catch (error) {
    if (error instanceof CaseError) {
      res.status(409).json({ error: error.message, code: error.code });
      return;
    }

    throw error;
  }

  res.json({ case: await caseView(user, now) });
});

/** POST /api/cases/claim — закрыть готовое дело и забрать награду. */
casesRouter.post('/claim', async (_req: Request, res: Response) => {
  const user = await loadUser(res);

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();

  try {
    const claim = await claimCase(user, now);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const { energy } = regenerateEnergy(fresh, now);

    res.json({
      ...claim,
      case: await caseView(fresh, now),
      state: toGameState({ ...fresh, energy }),
    });
  } catch (error) {
    if (error instanceof CaseError) {
      res.status(409).json({ error: error.message, code: error.code });
      return;
    }

    throw error;
  }
});
