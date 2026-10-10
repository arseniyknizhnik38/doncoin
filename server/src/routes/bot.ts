import { Router, type Request, type Response } from 'express';
import { handleUpdate, type TelegramUpdate } from '../lib/botUpdates.js';

export const botRouter = Router();

/**
 * Приём обновлений Telegram вебхуком.
 *
 * Основной путь сейчас другой — опрос (см. lib/botPolling.ts): до нашего
 * хостинга серверы Telegram не дозваниваются. Маршрут оставлен рабочим на
 * случай переезда или смены маршрутизации: включается он одной командой
 * setWebhook и ничего не стоит, пока не зарегистрирован.
 *
 * Отвечаем 200 всегда и сразу: Telegram считает любой другой ответ сбоем и
 * присылает то же обновление снова, по нарастающей.
 */
botRouter.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // Адрес открыт наружу, постучаться может кто угодно. Telegram возвращает
  // в заголовке секрет, заданный при регистрации.
  if (secret && req.get('x-telegram-bot-api-secret-token') !== secret) {
    res.status(401).json({ ok: false });
    return;
  }

  res.json({ ok: true });

  if (!botToken) {
    return;
  }

  try {
    await handleUpdate(req.body as TelegramUpdate, botToken);
  } catch (error) {
    console.warn('[bot] обновление не обработано', error);
  }
});
