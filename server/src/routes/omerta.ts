import { Router, type Request, type Response } from 'express';
import { isValidGuess } from '../config/omerta.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { guessOmerta, omertaState } from '../lib/omerta.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const omertaRouter = Router();

omertaRouter.use(requireTelegramAuth);
omertaRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/omerta — предметы, попытки и, если разгадан, ответ. */
omertaRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { telegramId: getTelegramId(res) } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({ omerta: omertaState(user, new Date()) });
});

/** POST /api/omerta/guess — тело `{ "guess": ["cigar", "ring", "duck", "dice"] }`. */
omertaRouter.post('/guess', async (req: Request, res: Response) => {
  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const guess = (req.body as { guess?: unknown })?.guess;

  if (!isValidGuess(guess)) {
    res.status(400).json({ error: 'Разложите все предметы без повторов', code: 'BAD_GUESS' });
    return;
  }

  const now = new Date();
  const { hits, reward } = await guessOmerta(user, guess, now);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    hits,
    reward: reward.toString(),
    omerta: omertaState(fresh, now),
    state: toGameState({ ...fresh, energy }),
  });
});
