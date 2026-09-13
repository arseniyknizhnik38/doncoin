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
    '🐟 Сутки тебя не видно. {inviter} говорит, тебя заметили у здания федералов. Зайди и докажи, что ты не крыса. Вернёшься — куш и тебе, и {inviter}.',
    '🐟 Кто пропадает на сутки, тот либо в больнице, либо даёт показания. В больнице тебя нет. {inviter} за тебя поручился — не подставляй. Заходи, обоим занесут куш.',
    '🐟 Федералы тебе уже новое имя выдали? {inviter} ждёт объяснений. Покажись в семье — вернувшимся полагается куш, тебе и {inviter}.',
    '🐟 В семье молчат только двое: мёртвые и стукачи. Ты вроде живой. {inviter} волнуется. Зайди — и вам обоим прилетит куш.',
  ],
  en: [
    '🐟 Nobody has seen you for a day. {inviter} says you were spotted outside the federal building. Come back and prove you are no rat. Show up and you and {inviter} both get a cut.',
    '🐟 A man who vanishes for a day is either in the hospital or talking to the feds. You are not in the hospital. {inviter} vouched for you — do not make them look bad. Come back and you both get a cut.',
    '🐟 Did the feds give you a new name already? {inviter} wants an explanation. Show your face — the ones who come back get a cut, you and {inviter}.',
    '🐟 Only two kinds keep quiet in this family: the dead and the snitches. You look alive. {inviter} is worried. Come back and you both get a cut.',
  ],
};

/** Сообщение пригласившему, когда кент вернулся. */
export const COMEBACK_TO_INVITER: Record<Lang, string> = {
  ru: '🤝 {friend} вернулся — не стукач, свой. За то, что поручился, тебе куш: +{amount} DONC.',
  en: '🤝 {friend} came back — no rat, one of ours. For vouching, here is your cut: +{amount} DONC.',
};
