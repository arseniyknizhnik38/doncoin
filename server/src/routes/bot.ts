import { Router, type Request, type Response } from 'express';
import { greetingFor, startPayload } from '../lib/bot.js';
import { prisma } from '../lib/prisma.js';

export const botRouter = Router();

/**
 * Приём обновлений Telegram.
 *
 * Отвечаем 200 всегда и сразу: Telegram считает любой другой ответ сбоем и
 * присылает то же обновление снова, по нарастающей. Наша ошибка не должна
 * превращаться в поток повторов.
 */
botRouter.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  // Адрес вебхука открыт наружу, поэтому постучаться может кто угодно.
  // Telegram возвращает в заголовке секрет, заданный при регистрации.
  if (secret && req.get('x-telegram-bot-api-secret-token') !== secret) {
    res.status(401).json({ ok: false });
    return;
  }

  res.json({ ok: true });

  try {
    await handleUpdate(req.body as TelegramUpdate);
  } catch (error) {
    console.warn('[bot] обновление не обработано', error);
  }
});

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { id?: number | string; language_code?: string };
  };
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const chatId = message?.chat?.id;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!message || chatId === undefined || !botToken) {
    return;
  }

  const payload = startPayload(message.text);

  // Пока отвечаем только на /start. Всё остальное игрок пишет не нам, а в
  // пустоту: лишние ответы бота в личке раздражают сильнее, чем молчание.
  if (payload === null && !(message.text ?? '').startsWith('/start')) {
    return;
  }

  const greeting = greetingFor(message.from?.language_code, payload);

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...greeting }),
    signal: AbortSignal.timeout(5_000),
  });

  // Человек сам пришёл в чат — значит, писать ему снова можно. Снимаем
  // отметку, которую могла поставить неудачная попытка рассылки: без этого
  // игрок, которому однажды не дозвонились, оставался бы немым навсегда.
  const telegramId = message.from?.id;

  if (telegramId !== undefined) {
    await prisma.user
      .updateMany({
        where: { telegramId: String(telegramId), notificationsBlocked: true },
        data: { notificationsBlocked: false },
      })
      .catch(() => {
        // Игрока может ещё не быть в базе — он создастся при входе в игру.
      });
  }
}
