import type { AdTag } from '../config/attribution.js';

/**
 * Отправка конверсии в рекламную сеть.
 *
 * Адрес и набор параметров задаёт кабинет сети, а не мы: у каждой свой
 * формат, и выдуманный «похожий» URL молча уходит в никуда — деньги за
 * закупку при этом тратятся как обычно. Поэтому шаблон целиком приходит из
 * переменной окружения, а код лишь подставляет в него значения:
 *
 *   AD_POSTBACK_URL="https://сеть.example/postback?click_id={click_id}&event={event}"
 *
 * Поддерживаемые подстановки: {click_id} {source} {placement} {user_id}
 * {event} {value}. Шаблон не задан — конверсия не отправляется, но в журнал
 * попадает: когда адрес появится, по журналу видно, что было потеряно.
 */

/** Сколько раз пробуем отправить, прежде чем признать неудачу. */
export const POSTBACK_ATTEMPTS = 3;

/** Сколько ждём ответ сети. Дольше держать нельзя — это горячий путь тапа. */
const TIMEOUT_MS = 5_000;

export interface PostbackResult {
  status: 'sent' | 'failed' | 'disabled';
  /** Машинная причина для журнала. */
  reason: string;
  /** Что ответила сеть — в журнал, наружу не отдаём. */
  detail?: string;
  attempts: number;
}

export interface PostbackInput {
  tag: AdTag;
  /** Наш идентификатор игрока: сети отдаём telegramId, он же в их отчётах. */
  userId: string;
  /** Имя события в терминах сети. */
  event: string;
  /** Ценность конверсии, если сеть её принимает. */
  value?: string;
}

/** Подставляет значения в шаблон, экранируя каждое для URL. */
export function buildPostbackUrl(template: string, input: PostbackInput): string {
  const values: Record<string, string> = {
    click_id: input.tag.clickId,
    source: input.tag.source,
    placement: input.tag.placement ?? '',
    user_id: input.userId,
    event: input.event,
    value: input.value ?? '',
  };

  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? encodeURIComponent(values[key]!) : whole,
  );
}

/**
 * Шлёт postback с повторами.
 *
 * Повторяем только то, что имеет шанс пройти со второй попытки: сетевой
 * сбой и 5xx на стороне сети. На 4xx повтор бессмысленен — сеть внятно
 * сказала, что запрос ей не нравится, и три одинаковых запроса этого не
 * изменят.
 */
export async function sendPostback(input: PostbackInput): Promise<PostbackResult> {
  const template = process.env.AD_POSTBACK_URL;

  if (!template) {
    return { status: 'disabled', reason: 'no-postback-url', attempts: 0 };
  }

  const url = buildPostbackUrl(template, input);
  let lastDetail = '';

  for (let attempt = 1; attempt <= POSTBACK_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.ok) {
        return { status: 'sent', reason: 'ok', detail: String(response.status), attempts: attempt };
      }

      lastDetail = `http-${response.status}`;

      // Сеть отвергла сам запрос — повторять нечего.
      if (response.status >= 400 && response.status < 500) {
        return { status: 'failed', reason: lastDetail, detail: lastDetail, attempts: attempt };
      }
    } catch (error) {
      lastDetail = error instanceof Error ? error.message.slice(0, 200) : 'network';
    }

    // Пауза растёт: сеть, которая легла, за 200 мс не встанет.
    if (attempt < POSTBACK_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }

  return {
    status: 'failed',
    reason: 'network',
    detail: lastDetail || 'network',
    attempts: POSTBACK_ATTEMPTS,
  };
}
