import { createHmac } from 'node:crypto';
import type { User } from '../generated/prisma/client.js';
import { activeIncomePerHour } from './rewards.js';

/**
 * Шифр Омерты.
 *
 * Каждый день из двенадцати предметов складывается комбинация из четырёх, и
 * порядок важен. Угадать её в одиночку почти нельзя: вариантов 11 880, а
 * попыток три. После каждой игрок узнаёт только, сколько предметов стоят на
 * своих местах, но не какие именно.
 *
 * Так и задумано. Разгадавшие делятся ответом, остальные ищут, где им
 * поделились, — и вокруг игры сами собой появляются паблики. Разгадка
 * вслепую сработала бы против этого.
 */

export interface OmertaItem {
  id: string;
  emoji: string;
  title: { ru: string; en: string };
}

export const OMERTA_ITEMS: readonly OmertaItem[] = [
  { id: 'cigar', emoji: '🚬', title: { ru: 'Сигара Тони', en: "Tony's cigar" } },
  { id: 'steak', emoji: '🥩', title: { ru: 'Стейк из лавки', en: 'Steak from the butcher shop' } },
  { id: 'ring', emoji: '💍', title: { ru: 'Золотой перстень с печаткой', en: 'Gold signet ring' } },
  { id: 'bourbon', emoji: '🥃', title: { ru: 'Бокал с бурбоном', en: 'Glass of bourbon' } },
  { id: 'revolver', emoji: '🔫', title: { ru: 'Револьвер с глушителем', en: 'Silenced revolver' } },
  { id: 'envelope', emoji: '✉️', title: { ru: 'Белый пухлый конверт с кэшем', en: 'Fat white envelope of cash' } },
  { id: 'duck', emoji: '🦆', title: { ru: 'Резиновая уточка', en: 'Rubber duck' } },
  { id: 'payphone', emoji: '📞', title: { ru: 'Трубка таксофона', en: 'Payphone receiver' } },
  { id: 'shades', emoji: '🕶️', title: { ru: 'Тёмные очки', en: 'Dark shades' } },
  { id: 'prosciutto', emoji: '🥓', title: { ru: 'Кусок прошутто', en: 'Slice of prosciutto' } },
  { id: 'dice', emoji: '🎲', title: { ru: 'Игральные кости из Bada Bing', en: 'Dice from the Bada Bing' } },
  { id: 'car_keys', emoji: '🏎️', title: { ru: 'Ключи от спорткара', en: 'Sports car keys' } },
];

/** Сколько предметов в комбинации. */
export const OMERTA_LENGTH = 4;

/** Попыток в сутки. */
export const OMERTA_ATTEMPTS_PER_DAY = 3;

/** Награда в часах активного дохода и её нижняя граница. */
export const OMERTA_REWARD_HOURS = 4;
export const OMERTA_REWARD_MIN = 10_000n;

export function omertaReward(user: Pick<User, 'coinsPerTap' | 'energyPerSecond'>): bigint {
  const byIncome = BigInt(Math.floor(activeIncomePerHour(user) * OMERTA_REWARD_HOURS));

  return byIncome > OMERTA_REWARD_MIN ? byIncome : OMERTA_REWARD_MIN;
}

/**
 * Комбинация дня.
 *
 * Не хранится в базе, а вычисляется из дня и секрета: одна и та же у всех
 * игроков, меняется в полночь сама и не требует от владельца заводить её
 * руками. Без секрета её можно было бы посчитать по открытому коду.
 */
export function omertaCombination(dayNumber: number, secret: string): string[] {
  const ids = OMERTA_ITEMS.map((item) => item.id);
  let block = createHmac('sha256', secret).update(`omerta:${dayNumber}`).digest();
  let offset = 0;

  // Частичное перемешивание Фишера — Йетса: первые позиции и есть ответ.
  for (let i = 0; i < OMERTA_LENGTH; i += 1) {
    if (offset + 4 > block.length) {
      block = createHmac('sha256', secret).update(block).digest();
      offset = 0;
    }

    const j = i + (block.readUInt32BE(offset) % (ids.length - i));
    offset += 4;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }

  return ids.slice(0, OMERTA_LENGTH);
}

/** Годится ли присланный ответ: нужная длина, известные предметы, без повторов. */
export function isValidGuess(guess: unknown): guess is string[] {
  if (!Array.isArray(guess) || guess.length !== OMERTA_LENGTH) {
    return false;
  }

  const known = new Set(OMERTA_ITEMS.map((item) => item.id));

  return (
    guess.every((id) => typeof id === 'string' && known.has(id)) &&
    new Set(guess).size === guess.length
  );
}

/** Сколько предметов стоят на своих местах. */
export function countInPlace(guess: readonly string[], answer: readonly string[]): number {
  return guess.reduce((sum, id, index) => sum + (answer[index] === id ? 1 : 0), 0);
}

export function omertaSecret(): string {
  const secret = process.env.OMERTA_SECRET || process.env.TELEGRAM_BOT_TOKEN;

  if (!secret) {
    throw new Error('Не задан ни OMERTA_SECRET, ни TELEGRAM_BOT_TOKEN');
  }

  return secret;
}
