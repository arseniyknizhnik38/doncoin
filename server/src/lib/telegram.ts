import { createHmac, timingSafeEqual } from 'node:crypto';

/** Пользователь из поля `user` внутри initData (формат Telegram — snake_case). */
export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface ParsedInitData {
  user: TelegramUser;
  /** start_param — значение из реферальной ссылки `?startapp=CODE`. */
  startParam: string | null;
  authDate: Date;
}

export type InitDataErrorCode =
  | 'MALFORMED'
  | 'MISSING_HASH'
  | 'BAD_SIGNATURE'
  | 'EXPIRED'
  | 'NO_USER';

export class InitDataError extends Error {
  constructor(
    readonly code: InitDataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InitDataError';
  }
}

/**
 * data-check-string по алгоритму Telegram: все поля, кроме исключённых,
 * отсортированы по ключу и склеены через \n в виде `key=value`.
 */
function buildDataCheckString(
  params: URLSearchParams,
  exclude: readonly string[],
): string {
  return [...params.entries()]
    .filter(([key]) => !exclude.includes(key))
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function equalsHex(actualHex: string, expected: Buffer): boolean {
  let actual: Buffer;
  try {
    actual = Buffer.from(actualHex, 'hex');
  } catch {
    return false;
  }
  // Сравнение за постоянное время — чтобы подпись нельзя было подобрать
  // побайтово по времени ответа.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Проверяет подпись initData ключом, производным от токена бота, и возвращает
 * разобранные данные. Бросает InitDataError, если данные подделаны или устарели.
 *
 * @param raw — строка initData как есть (query-string), без изменений.
 * @param botToken — TELEGRAM_BOT_TOKEN.
 * @param maxAgeSeconds — максимальный возраст auth_date (0 — не проверять).
 */
export function validateInitData(
  raw: string,
  botToken: string,
  maxAgeSeconds = 86_400,
): ParsedInitData {
  const params = new URLSearchParams(raw);

  const hash = params.get('hash');
  if (!hash) {
    throw new InitDataError('MISSING_HASH', 'initData не содержит поле hash');
  }

  // secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token)
  const secretKey = hmacSha256('WebAppData', botToken);

  // Начиная с Bot API 8.0 initData содержит поле `signature` (подпись Ed25519
  // для сторонней проверки), которое не входит в data-check-string. Проверяем
  // основной вариант, а если не сошлось — вариант без исключения `signature`.
  // Оба варианта — полноценная HMAC-проверка, подобрать их без токена нельзя.
  const candidates = [
    buildDataCheckString(params, ['hash', 'signature']),
    buildDataCheckString(params, ['hash']),
  ];

  const signatureValid = candidates.some((dataCheckString) =>
    equalsHex(hash, hmacSha256(secretKey, dataCheckString)),
  );

  if (!signatureValid) {
    throw new InitDataError('BAD_SIGNATURE', 'Подпись initData не совпала');
  }

  const authDateRaw = Number(params.get('auth_date'));
  if (!Number.isFinite(authDateRaw) || authDateRaw <= 0) {
    throw new InitDataError('MALFORMED', 'Некорректное поле auth_date');
  }
  const authDate = new Date(authDateRaw * 1000);

  if (maxAgeSeconds > 0) {
    const ageSeconds = (Date.now() - authDate.getTime()) / 1000;
    if (ageSeconds > maxAgeSeconds) {
      throw new InitDataError('EXPIRED', 'initData устарели, откройте приложение заново');
    }
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new InitDataError('NO_USER', 'initData не содержит данные пользователя');
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new InitDataError('MALFORMED', 'Не удалось разобрать поле user');
  }

  if (typeof user.id !== 'number') {
    throw new InitDataError('MALFORMED', 'В поле user отсутствует id');
  }

  return {
    user,
    startParam: params.get('start_param'),
    authDate,
  };
}
