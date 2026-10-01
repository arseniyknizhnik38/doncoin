import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const settingsRouter = Router();

settingsRouter.use(requireTelegramAuth);
settingsRouter.use(writeRateLimit());

/** Языки, которые можно выбрать руками. Всё остальное в базу не пускаем. */
const LANGS = ['ru', 'en', 'zh'] as const;

/** GET /api/settings — текущие настройки игрока. */
settingsRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
    select: { notificationsEnabled: true, notificationsBlocked: true, language: true },
  });

  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден', code: 'USER_NOT_FOUND' });
    return;
  }

  res.json({
    notifications: {
      notificationsEnabled: user.notificationsEnabled,
      notificationsBlocked: user.notificationsBlocked,
    },
    language: user.language,
  });
});

/** PATCH /api/settings — уведомления и язык интерфейса. */
settingsRouter.patch('/', async (req: Request, res: Response) => {
  const { notificationsEnabled, language } = req.body as {
    notificationsEnabled?: unknown;
    language?: unknown;
  };

  const togglesNotifications = typeof notificationsEnabled === 'boolean';
  const picksLanguage =
    typeof language === 'string' && (LANGS as readonly string[]).includes(language);

  if (!togglesNotifications && !picksLanguage) {
    res.status(400).json({
      error: 'Ожидалось notificationsEnabled (true/false) или language (ru/en/zh)',
    });
    return;
  }

  const updated = await prisma.user.update({
    where: { telegramId: getTelegramId(res) },
    data: {
      ...(togglesNotifications
        ? {
            notificationsEnabled,
            // Включая уведомления заново, снимаем отметку блокировки:
            // возможно, человек разблокировал бота и хочет их снова.
            ...(notificationsEnabled ? { notificationsBlocked: false } : {}),
          }
        : {}),
      ...(picksLanguage ? { language } : {}),
    },
    select: { notificationsEnabled: true, notificationsBlocked: true, language: true },
  });

  res.json({
    notifications: {
      notificationsEnabled: updated.notificationsEnabled,
      notificationsBlocked: updated.notificationsBlocked,
    },
    language: updated.language,
  });
});
