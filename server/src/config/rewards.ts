import type { User } from '../generated/prisma/client.js';

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
export const OFFLINE_RATE = 0.2;

/** Дольше этого срока копить нельзя — чтобы был смысл заходить чаще. */
export const OFFLINE_MAX_HOURS = 3;

/** Сколько «полных обойм» энергии даёт бонус на N-й день серии. */
const DAILY_BAR_FRACTION = 0.25;

/** Серия перестаёт расти после этого дня. */
export const DAILY_STREAK_CAP = 7;

/** Монет в час, пока игрок оффлайн. */
export function offlinePerHour(user: Pick<User, 'coinsPerTap' | 'energyPerSecond'>): bigint {
  const perHour = user.coinsPerTap * user.energyPerSecond * 3600 * OFFLINE_RATE;

  return BigInt(Math.floor(perHour));
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
): OfflineEarnings {
  const elapsedHours = Math.max(0, (now.getTime() - user.lastSeenAt.getTime()) / 3_600_000);
  const hours = Math.min(elapsedHours, OFFLINE_MAX_HOURS);
  const earned = BigInt(Math.floor(Number(offlinePerHour(user)) * hours));

  return { earned, hours, capped: elapsedHours > OFFLINE_MAX_HOURS };
}

/** Награда за N-й день серии — привязана к текущей силе игрока. */
export function dailyReward(
  user: Pick<User, 'coinsPerTap' | 'energyMax'>,
  streak: number,
): bigint {
  const capped = Math.min(Math.max(streak, 1), DAILY_STREAK_CAP);
  const value = user.coinsPerTap * user.energyMax * DAILY_BAR_FRACTION * capped;

  return BigInt(Math.floor(value));
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
}

export function dailyStatus(
  user: Pick<User, 'coinsPerTap' | 'energyMax' | 'dailyStreak' | 'lastDailyAt'>,
  now: Date,
): DailyStatus {
  const today = utcDayNumber(now);
  const lastDay = user.lastDailyAt ? utcDayNumber(user.lastDailyAt) : null;
  const available = lastDay === null || lastDay < today;

  // Серия продолжается, только если получали вчера; иначе начинается заново.
  const nextStreak = lastDay !== null && lastDay === today - 1 ? user.dailyStreak + 1 : 1;

  return {
    available,
    nextStreak,
    reward: dailyReward(user, available ? nextStreak : user.dailyStreak).toString(),
    streak: user.dailyStreak,
  };
}
