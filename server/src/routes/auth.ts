import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { InitDataError, validateInitData } from '../lib/telegram.js';

export const authRouter = Router();

/**
 * POST /api/auth/telegram
 * Тело: { "initData": "<сырая строка initData из Telegram SDK>" }
 *
 * Проверяет подпись, затем находит или создаёт пользователя.
 */
authRouter.post('/telegram', async (req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.status(503).json({
      error: 'TELEGRAM_BOT_TOKEN не задан на сервере (см. server/.env)',
    });
    return;
  }

  const { initData } = req.body as { initData?: unknown };

  if (typeof initData !== 'string' || initData.length === 0) {
    res.status(400).json({ error: 'Ожидалось поле initData (строка)' });
    return;
  }

  let parsed;
  try {
    parsed = validateInitData(initData, botToken);
  } catch (error) {
    if (error instanceof InitDataError) {
      // Наружу не раскрываем детали проверки подписи.
      res.status(401).json({ error: 'initData не прошли проверку', code: error.code });
      return;
    }
    throw error;
  }

  const { user: tgUser, startParam } = parsed;
  const telegramId = String(tgUser.id);

  const existing = await prisma.user.findUnique({ where: { telegramId } });

  // referredByCode пишем только при создании: кто пригласил — не меняется.
  const user = existing
    ? await prisma.user.update({
        where: { telegramId },
        data: {
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
        },
      })
    : await prisma.user.create({
        data: {
          telegramId,
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
          referredByCode: startParam,
        },
      });

  res.json({
    isNew: !existing,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      referredByCode: user.referredByCode,
      createdAt: user.createdAt,
    },
  });
});
