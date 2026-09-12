import { createHash } from 'node:crypto';
import type { User } from '../generated/prisma/client.js';
import { activeIncomePerHour } from './rewards.js';

/**
 * Задания дня: три штуки, новые каждые сутки.
 *
 * Это самая сильная механика возврата из всех — не потому, что награда
 * велика, а потому, что список обнуляется в полночь и вчерашний прогресс
 * не переносится. Одноразовые задания из config/tasks.ts заканчиваются за
 * вечер; эти не заканчиваются никогда.
 *
 * Прогресс нигде не копится по событиям. Он считается как разница между
 * текущими показателями игрока и слепком, снятым при выдаче заданий
 * (DailyQuestDay.base*). Иначе каждый тап пришлось бы писать ещё и в счётчик
 * заданий, а тап — это один UPDATE, и он должен таким остаться.
 */

/** Что измеряет задание. */
export type QuestMeasure =
  /** Разница со слепком. */
  | 'taps'
  | 'earned'
  | 'upgrades'
  | 'business'
  | 'donated'
  /** Счётчики, которые и так обнуляются за сутки, — слепок им не нужен. */
  | 'daily'
  | 'full_energy'
  | 'rush';

export interface QuestDefinition {
  id: string;
  title: string;
  measure: QuestMeasure;
  /**
   * Сколько нужно набрать. Для денежных заданий цель привязана к силе
   * игрока: фиксированная сумма к «Капо» превращается в ничто.
   */
  target: (user: User) => number;
  /** Награда — в часах активного дохода игрока. */
  rewardHours: number;
  rewardRespect: number;
  /** Как описать цель игроку. */
  describe: (target: number) => string;
}

const coins = (value: number) => Math.round(value).toLocaleString('ru-RU');

export const QUESTS: readonly QuestDefinition[] = [
  {
    id: 'taps_1500',
    title: 'Размяться',
    measure: 'taps',
    target: () => 1_500,
    rewardHours: 1,
    rewardRespect: 5,
    describe: (target) => `Сделать ${coins(target)} тапов`,
  },
  {
    id: 'taps_4000',
    title: 'Полный рабочий день',
    measure: 'taps',
    target: () => 4_000,
    rewardHours: 1.5,
    rewardRespect: 10,
    describe: (target) => `Сделать ${coins(target)} тапов`,
  },
  {
    id: 'earn_3h',
    title: 'Дневная выручка',
    measure: 'earned',
    target: (user) => activeIncomePerHour(user) * 3,
    rewardHours: 1,
    rewardRespect: 5,
    describe: (target) => `Заработать ${coins(target)} DONC`,
  },
  {
    id: 'upgrade_2',
    title: 'Вложиться в дело',
    measure: 'upgrades',
    target: () => 2,
    rewardHours: 1,
    rewardRespect: 5,
    describe: (target) => `Купить ${target} уровня улучшений`,
  },
  {
    id: 'business_1',
    title: 'Расширить владения',
    measure: 'business',
    target: () => 1,
    rewardHours: 1,
    rewardRespect: 5,
    describe: () => 'Поднять любой бизнес на уровень',
  },
  {
    id: 'donate_1h',
    title: 'Взнос в кассу',
    measure: 'donated',
    target: (user) => activeIncomePerHour(user),
    rewardHours: 1,
    rewardRespect: 10,
    describe: (target) => `Внести в кассу ${coins(target)} DONC`,
  },
  {
    id: 'daily_claim',
    title: 'Отметиться',
    measure: 'daily',
    target: () => 1,
    rewardHours: 0.5,
    rewardRespect: 5,
    describe: () => 'Забрать ежедневный бонус',
  },
  {
    id: 'full_energy_2',
    title: 'Не жалеть патронов',
    measure: 'full_energy',
    target: () => 2,
    rewardHours: 1,
    rewardRespect: 5,
    describe: (target) => `Использовать «Полную обойму» ${target} раза`,
  },
  {
    id: 'rush_3',
    title: 'На разгоне',
    measure: 'rush',
    target: () => 3,
    rewardHours: 1,
    rewardRespect: 5,
    describe: (target) => `Использовать «Разгон» ${target} раза`,
  },
];

/** Сколько заданий выдаётся за сутки. */
export const QUESTS_PER_DAY = 3;

/** Награда за выполнение всех трёх — в часах активного дохода. */
export const CHEST_HOURS = 3;

export const CHEST_RESPECT = 25;

export function findQuest(id: string): QuestDefinition | undefined {
  return QUESTS.find((quest) => quest.id === id);
}

/**
 * Какие задания выпадают игроку в эти сутки.
 *
 * Выбор детерминированный — хеш от пары (игрок, день). Это значит, что у
 * разных людей задания разные (иначе чат превращается в один общий список),
 * а пересчёт всегда даёт тот же результат, даже если строку в базе завести
 * не успели.
 */
export function pickQuests(userId: string, dayNumber: number): string[] {
  const pool = QUESTS.map((quest) => quest.id);
  const picked: string[] = [];

  for (let i = 0; picked.length < QUESTS_PER_DAY && pool.length > 0; i += 1) {
    const digest = createHash('sha256').update(`${userId}:${dayNumber}:${i}`).digest();
    const index = digest.readUInt32BE(0) % pool.length;

    picked.push(pool.splice(index, 1)[0]!);
  }

  return picked;
}

/** Текущие показатели игрока, из которых считается прогресс. */
export interface QuestCounters {
  taps: number;
  earned: bigint;
  upgrades: number;
  business: number;
  donated: bigint;
  dailyClaimed: boolean;
  fullEnergyUsed: number;
  rushUsed: number;
}

/** Слепок, снятый при выдаче заданий. */
export interface QuestBaseline {
  baseTaps: number;
  baseEarned: bigint;
  baseUpgrades: number;
  baseBusiness: number;
  baseDonated: bigint;
}

export function questProgress(
  quest: QuestDefinition,
  counters: QuestCounters,
  base: QuestBaseline,
): number {
  switch (quest.measure) {
    case 'taps':
      return Math.max(0, counters.taps - base.baseTaps);
    case 'earned':
      return Math.max(0, Number(counters.earned - base.baseEarned));
    case 'upgrades':
      return Math.max(0, counters.upgrades - base.baseUpgrades);
    case 'business':
      return Math.max(0, counters.business - base.baseBusiness);
    case 'donated':
      return Math.max(0, Number(counters.donated - base.baseDonated));
    case 'daily':
      return counters.dailyClaimed ? 1 : 0;
    case 'full_energy':
      return counters.fullEnergyUsed;
    case 'rush':
      return counters.rushUsed;
  }
}

/** Награда в монетах: доля часа активного дохода. */
export function questReward(quest: QuestDefinition, user: User): bigint {
  return BigInt(Math.floor(activeIncomePerHour(user) * quest.rewardHours));
}

export function chestReward(user: User): bigint {
  return BigInt(Math.floor(activeIncomePerHour(user) * CHEST_HOURS));
}

export interface QuestView {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  rewardCoins: string;
  rewardRespect: number;
}

export function describeQuests(
  ids: readonly string[],
  user: User,
  counters: QuestCounters,
  base: QuestBaseline,
  claimed: readonly string[],
): QuestView[] {
  return ids.flatMap((id) => {
    const quest = findQuest(id);

    // Задание убрали из каталога, пока сутки шли: молча пропускаем, иначе
    // у игрока сломался бы весь список.
    if (!quest) {
      return [];
    }

    const target = Math.max(1, Math.round(quest.target(user)));
    const progress = Math.min(questProgress(quest, counters, base), target);

    return [
      {
        id: quest.id,
        title: quest.title,
        description: quest.describe(target),
        progress,
        target,
        done: progress >= target,
        claimed: claimed.includes(quest.id),
        rewardCoins: questReward(quest, user).toString(),
        rewardRespect: quest.rewardRespect,
      },
    ];
  });
}
