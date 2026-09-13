import type { User } from '../generated/prisma/client.js';
import type { Lang } from './i18n.js';
import { activeIncomePerHour } from './rewards.js';

/**
 * «Кента подозревают»: приглашённый пропал на сутки — бот пишет ему, что
 * пацаны уже думают, будто он стучит федералам. Вернулся — обоим куш.
 *
 * Это напоминание, которое работает сильнее обычного: оно не про монеты, а
 * про человека, который тебя позвал. И платит обоим, поэтому пригласившему
 * тоже есть смысл дёргать своего кента.
 */

/** Сколько часов без захода, чтобы кента заподозрили. */
export const SNITCH_IDLE_HOURS = 24;

/**
 * Не чаще раза в неделю на одного кента.
 *
 * Иначе куш превращается в зарплату за прогулы: пропал на сутки, вернулся,
 * получил — и так через день. Раз в неделю это событие, а не схема.
 */
export const SNITCH_COOLDOWN_HOURS = 7 * 24;

/** Куш каждому — в часах собственного активного дохода. */
export const KUSH_HOURS = 3;

/** Нижняя граница куша: у новичка три часа дохода — это копейки. */
export const KUSH_MIN = 5_000n;

export function kushFor(user: Pick<User, 'coinsPerTap' | 'energyPerSecond'>): bigint {
  const byIncome = BigInt(Math.floor(activeIncomePerHour(user) * KUSH_HOURS));

  return byIncome > KUSH_MIN ? byIncome : KUSH_MIN;
}

/**
 * Можно ли сейчас заподозрить игрока.
 *
 * Только настоящий кент: пришёл по ссылке и отыграл порог приглашения.
 * Без этого куш пригласившему фармился бы пустыми аккаунтами — завёл по
 * своей ссылке, подождал сутки, открыл.
 */
export function canCallSnitch(
  user: Pick<User, 'referredById' | 'referralRewarded' | 'lastSeenAt' | 'snitchCalledAt' | 'snitchPending'>,
  now: Date,
): boolean {
  if (user.referredById === null || !user.referralRewarded || user.snitchPending) {
    return false;
  }

  const idleHours = (now.getTime() - user.lastSeenAt.getTime()) / 3_600_000;

  if (idleHours < SNITCH_IDLE_HOURS) {
    return false;
  }

  if (user.snitchCalledAt === null) {
    return true;
  }

  return (now.getTime() - user.snitchCalledAt.getTime()) / 3_600_000 >= SNITCH_COOLDOWN_HOURS;
}

/**
 * Цитаты. Свои, а не из кино: узнаваемая интонация, но ни одной чужой строки.
 * {inviter} — имя того, кто позвал.
 */
export const SNITCH_QUOTES: Record<Lang, readonly string[]> = {
  ru: [
    '🐟 Толстый Бобби говорит, что последнее время ты перестал появляться на людях. Среди умников пошли сомнения, и подозрения на твой счёт растут. {inviter} пока за тебя впрягается. Покажись — и вам обоим занесут куш.',
    '🐟 На районе базарят, что тебя видели в машине без номеров с двумя в костюмах. Умники считают дни, пока ты не появишься. {inviter} говорит, что ты не такой. Докажи — зайди, и куш получите оба.',
    '🐟 Кривой Сэл за столом спросил, где ты пропадаешь. Никто не ответил. Нехорошая была тишина. {inviter} за тебя поручился своим словом — не делай из него дурака. Появись, и обоим прилетит куш.',
    '🐟 Толстый Бобби уже второй день поглядывает на твой пустой стул. Говорит, так пропадают только те, у кого появились новые друзья с корочками. {inviter} пока держит за тебя слово. Зайди — и куш на двоих.',
  ],
  en: [
    '🐟 Fat Bobby says you stopped showing your face around lately. The wiseguys are starting to have doubts, and the talk about you is getting louder. {inviter} is still standing up for you. Show up and you both get a cut.',
    '🐟 Word on the street is you were seen in an unmarked car with two guys in suits. The wiseguys are counting the days. {inviter} says you are not that kind. Prove it — come back and you both get a cut.',
    '🐟 Crooked Sal asked at the table where you have been. Nobody answered. It was a bad kind of quiet. {inviter} put their word on you — do not make a fool of them. Show up and you both get a cut.',
    '🐟 Fat Bobby keeps looking at your empty chair. Says the only guys who disappear like that are the ones with new friends carrying badges. {inviter} is still vouching for you. Come back — a cut for both of you.',
  ],
};

/** Сообщение пригласившему, когда кент вернулся. */
export const COMEBACK_TO_INVITER: Record<Lang, string> = {
  ru: '🤝 {friend} снова на людях. Толстый Бобби отозвал своих — пацан чистый. Ты за него впрягся и не прогадал: твой куш +{amount} DONC.',
  en: '🤝 {friend} is back on the street. Fat Bobby called off his guys — the kid is clean. You stood up for them and it paid: your cut +{amount} DONC.',
};
