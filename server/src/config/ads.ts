import type { Favor, User } from '../generated/prisma/client.js';
import { activeIncomePerHour } from './rewards.js';

/**
 * Рекламные кампании — то, на чём игра зарабатывает.
 *
 * Рекламодатель покупает подписчиков: задаёт канал, награду игроку и, если
 * нужно, лимит подписок и срок. Всё остальное — дело игры.
 *
 * Раньше это были «поручения недели» из кода: каталог лежал в config, срок
 * задавался номером ISO-недели, а завести клиента можно было только
 * коммитом с деплоем. Продавать так нельзя.
 */

/** Кампания видна игроку, если идёт по сроку и не выбрала лимит. */
export function isRunning(favor: Favor, now: Date): boolean {
  if (!favor.active) {
    return false;
  }

  if (favor.startsAt && favor.startsAt > now) {
    return false;
  }

  if (favor.endsAt && favor.endsAt <= now) {
    return false;
  }

  return favor.slots === null || favor.completedCount < favor.slots;
}

/**
 * Награда конкретному игроку.
 *
 * Если задан rewardHours, платим долю его собственного часового дохода:
 * фиксированная сумма, щедрая для новичка, к «Капо» перестаёт быть поводом
 * подписываться, и кампания теряет смысл именно на тех, кто играет дольше
 * всех.
 */
export function adReward(favor: Favor, user: Pick<User, 'coinsPerTap' | 'energyPerSecond'>): bigint {
  if (favor.rewardHours === null) {
    return favor.rewardDonc;
  }

  const scaled = BigInt(Math.floor(activeIncomePerHour(user) * favor.rewardHours));

  // rewardDonc работает нижней границей: у новичка час дохода — копейки,
  // и без неё первая же кампания выглядела бы издевательством.
  return scaled > favor.rewardDonc ? scaled : favor.rewardDonc;
}

/** Сколько подписок ещё можно выдать, null — без ограничения. */
export function slotsLeft(favor: Favor): number | null {
  return favor.slots === null ? null : Math.max(0, favor.slots - favor.completedCount);
}

export type AdStatus = 'running' | 'scheduled' | 'finished' | 'sold_out' | 'stopped';

/** Состояние кампании для админки. */
export function adStatus(favor: Favor, now: Date): AdStatus {
  if (!favor.active) {
    return 'stopped';
  }

  if (favor.startsAt && favor.startsAt > now) {
    return 'scheduled';
  }

  if (favor.endsAt && favor.endsAt <= now) {
    return 'finished';
  }

  if (favor.slots !== null && favor.completedCount >= favor.slots) {
    return 'sold_out';
  }

  return 'running';
}

export const AD_STATUS_TITLES: Readonly<Record<AdStatus, string>> = {
  running: 'Идёт',
  scheduled: 'Запланирована',
  finished: 'Срок вышел',
  sold_out: 'Лимит выбран',
  stopped: 'Остановлена',
};

/** Ссылка на канал должна вести в Telegram, а не куда угодно. */
export function isTelegramUrl(url: string): boolean {
  return /^https:\/\/t\.me\/[A-Za-z0-9_+/-]{1,64}$/.test(url);
}

/**
 * Идентификатор канала для getChatMember: либо @username, либо числовой id
 * вида -100…
 */
export function isChatId(value: string): boolean {
  return /^@[A-Za-z][A-Za-z0-9_]{3,63}$/.test(value) || /^-?\d{5,20}$/.test(value);
}
