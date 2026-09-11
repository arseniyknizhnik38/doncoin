/**
 * Шифр дня.
 *
 * Код прячется в канале, вводится в игре. Смысл не в награде, а в том, что
 * игра начинает кормить канал: за кодом нужно идти туда, где живёт
 * аудитория. Это же делает канал ценным для рекламодателей — то есть шифр
 * окупается не внутри игры, а снаружи.
 *
 * Награда крупная намеренно: шесть часов дохода стоят того, чтобы человек
 * подписался и заходил в канал ежедневно.
 */
export const CIPHER_REWARD_HOURS = 6;

/** Сколько попыток в сутки, чтобы код нельзя было подобрать перебором. */
export const CIPHER_ATTEMPTS_PER_DAY = 10;

/** Код приводим к одному виду: игрок вводит как получится. */
export function normalizeCipher(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Код годится, если это буквы и цифры разумной длины. */
export function isValidCipher(code: string): boolean {
  return /^[A-ZА-Я0-9]{3,32}$/.test(code);
}

/** Что нужно знать о попытках игрока: день и счётчик. */
export interface CipherAttempts {
  cipherDay: number;
  cipherAttempts: number;
}

/**
 * Сколько попыток игрок уже потратил сегодня.
 *
 * Счётчик не обнуляется фоновой задачей — он протухает вместе с cipherDay,
 * тем же приёмом, что и заряды бустеров. Значит «вчерашние» попытки
 * сегодня просто не считаются.
 */
export function attemptsUsed(user: CipherAttempts, today: number): number {
  return user.cipherDay === today ? user.cipherAttempts : 0;
}

/** Сколько попыток осталось сегодня. */
export function attemptsLeft(user: CipherAttempts, today: number): number {
  return Math.max(0, CIPHER_ATTEMPTS_PER_DAY - attemptsUsed(user, today));
}
