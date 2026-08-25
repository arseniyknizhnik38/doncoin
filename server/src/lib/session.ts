import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Короткий сессионный токен вместо пересылки initData на каждый запрос.
 *
 * Зачем: initData Telegram живут сутки, и приложение, открытое дольше,
 * начинало получать 401 без возможности обновиться. Плюс сырые данные
 * пользователя больше не ходят в каждом запросе.
 *
 * Формат: base64url(payload).base64url(hmac) — самодостаточно, хранить
 * сессии на сервере не нужно. Это важно для serverless, где общей памяти
 * между вызовами нет.
 */

/** Сколько живёт токен. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

interface SessionPayload {
  /** telegramId владельца. */
  sub: string;
  /** Unix-время истечения. */
  exp: number;
}

export class SessionError extends Error {
  constructor(readonly code: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED') {
    super('Сессия недействительна');
    this.name = 'SessionError';
  }
}

const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * Ключ подписи. Отдельный SESSION_SECRET предпочтителен, но по умолчанию
 * выводим его из токена бота — чтобы не заводить ещё одну обязательную
 * переменную окружения. Не сам токен: если ключ утечёт, бот не пострадает.
 */
function sessionKey(botToken: string): Buffer {
  const secret = process.env.SESSION_SECRET;

  return secret
    ? Buffer.from(secret)
    : createHmac('sha256', 'DONCOIN_SESSION').update(botToken).digest();
}

function sign(data: string, key: Buffer): string {
  return createHmac('sha256', key).update(data).digest('base64url');
}

export function createSessionToken(telegramId: string, botToken: string): {
  token: string;
  expiresAt: number;
} {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = encode({ sub: telegramId, exp } satisfies SessionPayload);
  const token = `${payload}.${sign(payload, sessionKey(botToken))}`;

  return { token, expiresAt: exp };
}

export function verifySessionToken(token: string, botToken: string): SessionPayload {
  const [payload, signature] = token.split('.');

  if (!payload || !signature) {
    throw new SessionError('MALFORMED');
  }

  const expected = Buffer.from(sign(payload, sessionKey(botToken)), 'base64url');
  const actual = Buffer.from(signature, 'base64url');

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new SessionError('BAD_SIGNATURE');
  }

  let parsed: SessionPayload;

  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionPayload;
  } catch {
    throw new SessionError('MALFORMED');
  }

  if (typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') {
    throw new SessionError('MALFORMED');
  }

  if (parsed.exp * 1000 <= Date.now()) {
    throw new SessionError('EXPIRED');
  }

  return parsed;
}
