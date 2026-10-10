import { handleUpdate, type TelegramUpdate } from './botUpdates.js';

/**
 * Опрос Telegram вместо вебхука.
 *
 * Вебхук был бы проще, но до нашего сервера Telegram не дозванивается:
 * домен открывается из Германии, Швеции и США, а их серверы получают
 * «Connection timed out» — входящие к российскому хостингу фильтруются.
 * Исходящие при этом ходят свободно, сообщения уходят без отказов.
 *
 * Поэтому инициативу берём на себя: длинный опрос держит одно соединение
 * до 25 секунд и возвращает обновления, как только они появятся. Задержки
 * это не добавляет, а зависеть от чужих маршрутов перестаёт.
 */

/** Сколько секунд Telegram держит соединение, если обновлений нет. */
const LONG_POLL_SECONDS = 25;

/** Пауза после сбоя: сеть моргнула — не долбим её в цикле. */
const RETRY_MS = 3_000;

interface UpdatesResponse {
  ok: boolean;
  result?: (TelegramUpdate & { update_id: number })[];
  description?: string;
}

let running = false;

/**
 * Запускает опрос. Второй вызов игнорируется: два цикла забирали бы
 * обновления друг у друга, и половина игроков осталась бы без ответа.
 */
export function startBotPolling(botToken: string): void {
  if (running) {
    return;
  }

  running = true;
  void loop(botToken);
}

async function loop(botToken: string): Promise<void> {
  // Вебхук и опрос несовместимы: пока зарегистрирован первый, Telegram
  // не отдаёт обновления второму.
  await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
    method: 'POST',
  }).catch(() => undefined);

  let offset = 0;

  for (;;) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            offset,
            timeout: LONG_POLL_SECONDS,
            allowed_updates: ['message'],
          }),
          // Чуть больше, чем держит Telegram: иначе мы обрываем соединение
          // сами, за мгновение до ответа.
          signal: AbortSignal.timeout((LONG_POLL_SECONDS + 10) * 1_000),
        },
      );

      const payload = (await response.json()) as UpdatesResponse;

      if (!payload.ok) {
        console.warn(`[bot] опрос отклонён: ${payload.description ?? 'без описания'}`);
        await sleep(RETRY_MS);
        continue;
      }

      for (const update of payload.result ?? []) {
        // Сдвигаем указатель до обработки: упавшее обновление не должно
        // возвращаться вечно и затыкать очередь всем остальным.
        offset = update.update_id + 1;

        try {
          await handleUpdate(update, botToken);
        } catch (error) {
          console.warn('[bot] обновление не обработано', error);
        }
      }
    } catch {
      // Таймаут длинного опроса — обычное дело, а не поломка.
      await sleep(RETRY_MS);
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
