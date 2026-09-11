import type { User } from '../generated/prisma/client.js';
import { ENERGY_PER_TAP } from '../lib/energy.js';
import { applyBonus } from './perks.js';

/**
 * Награды за возвращение в игру. Вынесены отдельно, чтобы баланс правился
 * в одном месте — как и пороги рангов.
 */

/**
 * Доля активного дохода, которая капает оффлайн.
 *
 * Оффлайн-доход намеренно привязан к скорости восстановления энергии
 * («Связи»): без этого ветка была бесполезна при игре сессиями — энергия
 * всё равно упиралась в потолок, и скорость ничего не решала.
 */
export const OFFLINE_RATE = 0.15;

/**
 * Дольше этого срока копить нельзя.
 *
 * Восемь часов — это ровно ночь. Прошлые три часа означали, что за сон
 * игрок не получал почти ничего и утренний заход не имел смысла; сутки
 * означали бы, что заходить можно раз в день. Восемь превращают утро в
 * событие, но не отменяют вечерний заход.
 */
export const OFFLINE_MAX_HOURS = 8;

/** Награда N-го дня = доход за (DAILY_HOURS_PER_DAY × N) часов. */
const DAILY_HOURS_PER_DAY = 0.25;

/**
 * Серия перестаёт расти после этого дня и начинается заново.
 *
 * Тридцать вместо семи: недельная серия заканчивалась ровно тогда, когда
 * привычка только складывается, и дальше заходить было незачем.
 */
export const DAILY_STREAK_CAP = 30;

/**
 * Дни, за которые платят втройне. Расставлены так, чтобы до следующей
 * крупной награды всегда оставалось не больше недели.
 */
export const DAILY_MILESTONES: readonly number[] = [7, 14, 21, 30];

/** Множитель награды за день серии. */
export function dailyMultiplier(streak: number): number {
  return DAILY_MILESTONES.includes(streak) ? 3 : 1;
}

/**
 * Сколько монет игрок зарабатывает тапами за час, если тапает всё, что
 * восстановилось. Базовая величина для всех наград «за время».
 */
export function activeIncomePerHour(
  user: Pick<User, 'coinsPerTap' | 'energyPerSecond'>,
): number {
  return (user.coinsPerTap * user.energyPerSecond * 3600) / ENERGY_PER_TAP;
}

/** Монет в час, пока игрок оффлайн. */
export function offlinePerHour(
  user: Pick<User, 'coinsPerTap' | 'energyPerSecond'>,
): bigint {
  return BigInt(Math.floor(activeIncomePerHour(user) * OFFLINE_RATE));
}

export interface OfflineEarnings {
  earned: bigint;
  /** Сколько времени зачтено (с учётом потолка). */
  hours: number;
  /** Упёрлись ли в потолок — это показываем игроку. */
  capped: boolean;
}

export function computeOfflineEarnings(
  user: Pick<User, 'coinsPerTap' | 'energyPerSecond' | 'lastSeenAt'>,
  now: Date,
  /** Прибавка в процентах: «Связи в семье» плюс уровень клана. */
  bonusPercent = 0,
): OfflineEarnings {
  const elapsedHours = Math.max(0, (now.getTime() - user.lastSeenAt.getTime()) / 3_600_000);
  const hours = Math.min(elapsedHours, OFFLINE_MAX_HOURS);
  const base = BigInt(Math.floor(Number(offlinePerHour(user)) * hours));

  return {
    earned: applyBonus(base, bonusPercent),
    hours,
    capped: elapsedHours > OFFLINE_MAX_HOURS,
  };
}

/**
 * Награда за N-й день серии — привязана к текущей силе игрока, поэтому не
 * обесценивается к середине игры.
 */
export function dailyReward(
  user: Pick<User, 'coinsPerTap' | 'energyPerSecond'>,
  streak: number,
): bigint {
  const capped = Math.min(Math.max(streak, 1), DAILY_STREAK_CAP);
  const hours = DAILY_HOURS_PER_DAY * capped * dailyMultiplier(capped);

  return BigInt(Math.floor(activeIncomePerHour(user) * hours));
}

/** Границы суток считаем по UTC — предсказуемо и без часовых поясов. */
export function utcDayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

export interface DailyStatus {
  available: boolean;
  /** Какой день серии будет засчитан при получении. */
  nextStreak: number;
  /** Награда за этот день. */
  reward: string;
  /** Текущая серия. */
  streak: number;
  /** Сколько дней до следующей тройной награды, null — если сегодня она. */
  daysToMilestone: number | null;
  /** Сегодняшний день — с тройной наградой. */
  milestone: boolean;
}

export function dailyStatus(
  user: Pick<User, 'coinsPerTap' | 'energyPerSecond' | 'dailyStreak' | 'lastDailyAt'>,
  now: Date,
): DailyStatus {
  const today = utcDayNumber(now);
  const lastDay = user.lastDailyAt ? utcDayNumber(user.lastDailyAt) : null;
  const available = lastDay === null || lastDay < today;

  // Серия продолжается, только если получали вчера; иначе начинается заново.
  // После DAILY_STREAK_CAP цикл идёт по новому кругу — иначе награда росла бы
  // бесконечно и обесценила бы всё остальное.
  const raw = lastDay !== null && lastDay === today - 1 ? user.dailyStreak + 1 : 1;
  const nextStreak = raw > DAILY_STREAK_CAP ? 1 : raw;
  const day = available ? nextStreak : user.dailyStreak;
  const upcoming = DAILY_MILESTONES.find((mark) => mark >= day) ?? null;

  return {
    available,
    nextStreak,
    reward: dailyReward(user, day).toString(),
    streak: user.dailyStreak,
    daysToMilestone: upcoming === null || upcoming === day ? null : upcoming - day,
    milestone: DAILY_MILESTONES.includes(day),
  };
}
