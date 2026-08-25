/**
 * Тонкий клиент Telegram Bot API для проверки подписки на канал.
 *
 * Разделяем два исхода, потому что вести себя с ними надо по-разному:
 *  - «не подписан» — обычный отказ, игроку показываем подсказку;
 *  - «не смогли проверить» — проблема настройки или сети, награду не выдаём,
 *    но и не обвиняем игрока.
 */

/** Статусы, при которых человек считается подписанным на канал. */
const SUBSCRIBED_STATUSES = new Set(['creator', 'administrator', 'member']);

export interface ChatMember {
  status: string;
  /** Для ограниченных участников важно, в канале ли они ещё. */
  is_member?: boolean;
}

/** Чистая функция — легко проверить тестом без обращения к сети. */
export function isSubscribedStatus(member: ChatMember): boolean {
  if (SUBSCRIBED_STATUSES.has(member.status)) {
    return true;
  }

  // «restricted» встречается в группах: человек ограничен, но состоит.
  return member.status === 'restricted' && member.is_member === true;
}

export type SubscriptionCheckErrorCode =
  | 'BOT_NOT_ADMIN'
  | 'CHAT_NOT_FOUND'
  | 'BAD_TOKEN'
  | 'NETWORK'
  | 'UNKNOWN';

export class SubscriptionCheckError extends Error {
  constructor(
    readonly code: SubscriptionCheckErrorCode,
    message: string,
    /** Текст от Telegram — пишем в лог, наружу не отдаём. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'SubscriptionCheckError';
  }
}

/** Ответ Telegram на ошибку. */
function classify(description: string): SubscriptionCheckErrorCode {
  const text = description.toLowerCase();

  if (text.includes('chat not found')) {
    return 'CHAT_NOT_FOUND';
  }

  if (text.includes('unauthorized')) {
    return 'BAD_TOKEN';
  }

  if (
    text.includes('not enough rights') ||
    text.includes('member list is inaccessible') ||
    text.includes('bot is not a member') ||
    text.includes('forbidden')
  ) {
    return 'BOT_NOT_ADMIN';
  }

  return 'UNKNOWN';
}

/**
 * Проверяет, подписан ли пользователь на канал.
 *
 * Для публичных каналов chatId может быть как числовым, так и @username —
 * Bot API принимает оба варианта. Бот должен быть администратором канала,
 * иначе Telegram не даст читать список участников.
 */
export async function checkSubscription(
  chatId: string,
  telegramUserId: string,
  botToken: string,
  timeoutMs = 5_000,
): Promise<boolean> {
  const url = new URL(`https://api.telegram.org/bot${botToken}/getChatMember`);
  url.searchParams.set('chat_id', chatId);
  url.searchParams.set('user_id', telegramUserId);

  let payload: { ok: boolean; result?: ChatMember; description?: string };

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    payload = (await response.json()) as typeof payload;
  } catch (cause) {
    throw new SubscriptionCheckError(
      'NETWORK',
      'Не удалось связаться с Telegram',
      cause instanceof Error ? cause.message : undefined,
    );
  }

  if (!payload.ok || !payload.result) {
    const description = payload.description ?? 'неизвестная ошибка';

    // «user not found» означает, что человека в канале нет, а не поломку.
    if (description.toLowerCase().includes('user not found')) {
      return false;
    }

    throw new SubscriptionCheckError(
      classify(description),
      'Проверка подписки недоступна',
      description,
    );
  }

  return isSubscribedStatus(payload.result);
}
