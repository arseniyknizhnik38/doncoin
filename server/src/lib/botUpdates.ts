import { greetingFor, startPayload } from './bot.js';
import { prisma } from './prisma.js';

/**
 * Разбор одного обновления Telegram.
 *
 * Вынесен из маршрута, потому что обновления приходят двумя путями —
 * вебхуком и опросом, — а поведение у них обязано быть одинаковым.
 */

export interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { id?: number | string; language_code?: string };
  };
}

export async function handleUpdate(
  update: TelegramUpdate,
  botToken: string,
): Promise<void> {
  const message = update.message;
  const chatId = message?.chat?.id;

  if (!message || chatId === undefined) {
    return;
  }

  // Пока отвечаем только на /start. Всё остальное игрок пишет не нам:
  // лишние ответы бота в личке раздражают сильнее, чем молчание.
  if (!(message.text ?? '').startsWith('/start')) {
    return;
  }

  const greeting = greetingFor(message.from?.language_code, startPayload(message.text));

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...greeting }),
    signal: AbortSignal.timeout(5_000),
  });

  // Человек сам пришёл в чат — значит, писать ему снова можно. Снимаем
  // отметку, которую могла поставить неудачная попытка рассылки: без неё
  // игрок, которому однажды не дозвонились, остался бы немым навсегда.
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
