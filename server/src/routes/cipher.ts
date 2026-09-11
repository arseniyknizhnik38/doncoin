import { Router, type Request, type Response } from 'express';
import { cipherState, solveCipher } from '../lib/cipher.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const cipherRouter = Router();

cipherRouter.use(requireTelegramAuth);
cipherRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/cipher — есть ли шифр на сегодня и разгадан ли он. */
cipherRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({ cipher: await cipherState(user, new Date()) });
});

/** POST /api/cipher/solve — проверить код, тело `{ "code": "..." }`. */
cipherRouter.post('/solve', async (req: Request, res: Response) => {
  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const code = (req.body as { code?: unknown })?.code;

  if (typeof code !== 'string' || code.length > 64) {
    res.status(400).json({ error: 'Введите код', code: 'BAD_CODE' });
    return;
  }

  const now = new Date();
  const { reward } = await solveCipher(user, code, now);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    reward: reward.toString(),
    cipher: await cipherState(fresh, now),
    state: toGameState({ ...fresh, energy }),
  });
});
