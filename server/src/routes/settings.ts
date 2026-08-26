import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const settingsRouter = Router();

settingsRouter.use(requireTelegramAuth);
settingsRouter.use(writeRateLimit());

/** GET /api/settings — текущие настройки игрока. */
settingsRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
    select: { notificationsEnabled: true, notificationsBlocked: true },
  });

  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден', code: 'USER_NOT_FOUND' });
    return;
  }

  res.json({ notifications: user });
});

/** PATCH /api/settings — включить или выключить уведомления. */
settingsRouter.patch('/', async (req: Request, res: Response) => {
  const { notificationsEnabled } = req.body as { notificationsEnabled?: unknown };

  if (typeof notificationsEnabled !== 'boolean') {
    res.status(400).json({ error: 'Ожидалось поле notificationsEnabled (true/false)' });
    return;
  }

  const updated = await prisma.user.update({
    where: { telegramId: getTelegramId(res) },
    data: {
      notificationsEnabled,
      // Включая уведомления заново, снимаем отметку блокировки: возможно,
      // человек разблокировал бота и хочет их снова.
      ...(notificationsEnabled ? { notificationsBlocked: false } : {}),
    },
    select: { notificationsEnabled: true, notificationsBlocked: true },
  });

  res.json({ notifications: updated });
});
