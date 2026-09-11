/**
 * Клановые войны. Все числа, определяющие ставки войны, собраны здесь.
 *
 * Счёт войны — это сумма DONC, заработанных участниками за неделю: тапами,
 * бизнесами, бонусами, поручениями. Считается вычитанием слепка totalEarned,
 * снятого на старте, поэтому не требует записи при каждом тапе.
 */

/**
 * Номер недели: ГОД*100 + номер недели по ISO.
 *
 * Просто «номер недели в году» повторялся бы каждый год и однажды поднял бы
 * прошлогодние поручения, поэтому в число зашит и год.
 */
export function weekNumber(date: Date): number {
  // ISO-неделя: четверг той же недели определяет год.
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));

  return target.getUTCFullYear() * 100 + week;
}

/** Доля казны проигравшего, которая уходит победителю, в процентах. */
export const WAR_LOOT_PERCENT = 10;

/** Опыт семьи победителю — примерно как за одно выполненное поручение. */
export const WAR_WIN_XP = 25;

/**
 * Личная награда участнику победившего клана — доля от того, что он сам
 * заработал за войну. Пропорция, а не фиксированная сумма: иначе выгоднее
 * было бы вступить в сильный клан и не тапать.
 */
export const WAR_MEMBER_REWARD_PERCENT = 10;

/** Меньше двух кланов — воевать не с кем. */
export const MIN_CLANS_FOR_WAR = 2;

export interface WarWindow {
  weekNumber: number;
  startedAt: Date;
  endsAt: Date;
}

/** Понедельник 00:00 UTC той недели, в которую попадает дата. */
export function startOfWarWeek(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay(): воскресенье 0, понедельник 1. Приводим к «сколько дней
  // прошло с понедельника».
  const sinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - sinceMonday);

  return start;
}

/**
 * Окно текущей войны. Война всегда заканчивается в ближайший понедельник,
 * даже если создана в середине недели — так все войны идут в одном ритме.
 */
export function warWindow(now: Date, weekNumber: number): WarWindow {
  const startedAt = startOfWarWeek(now);
  const endsAt = new Date(startedAt.getTime() + 7 * 86_400_000);

  return { weekNumber, startedAt, endsAt };
}

export function lootAmount(treasury: bigint): bigint {
  if (treasury <= 0n) {
    return 0n;
  }

  return (treasury * BigInt(WAR_LOOT_PERCENT)) / 100n;
}

export function memberReward(contribution: bigint): bigint {
  if (contribution <= 0n) {
    return 0n;
  }

  return (contribution * BigInt(WAR_MEMBER_REWARD_PERCENT)) / 100n;
}
