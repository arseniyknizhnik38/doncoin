import { Router, type Request, type Response } from 'express';
import { loadFeed } from '../lib/feed.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const feedRouter = Router();

feedRouter.use(requireTelegramAuth);
feedRouter.use(writeRateLimit());

/**
 * GET /api/feed — что слышно.
 *
 * Лента общая для всех: это новости, а не персональная выдача. Имена в ней
 * те же, что в лидерборде, — ничего нового наружу не отдаётся.
 */
feedRouter.get('/', async (_req: Request, res: Response) => {
  // Текст собирается на сервере, поэтому и язык решается здесь же.
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
    select: { language: true },
  });

  res.json({ events: await loadFeed(user?.language === 'en' ? 'en' : 'ru') });
});
