import { Router, type Request, type Response } from 'express';
import { loadFeed } from '../lib/feed.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { requireTelegramAuth } from '../middleware/telegramAuth.js';

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
  res.json({ events: await loadFeed() });
});
