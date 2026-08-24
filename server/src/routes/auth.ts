import { Router, type Request, type Response } from 'express';
import { toGameState } from '../lib/game.js';
import { InitDataError, validateInitData } from '../lib/telegram.js';
import { upsertUserFromTelegram } from '../lib/users.js';

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

  const { user, isNew } = await upsertUserFromTelegram(parsed);

  res.json({
    isNew,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      referredByCode: user.referredByCode,
      createdAt: user.createdAt,
    },
    state: toGameState(user),
  });
});
