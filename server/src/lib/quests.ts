import { usedToday } from '../config/boosters.js';
import {
  CHEST_RESPECT,
  type QuestBaseline,
  type QuestCounters,
  type QuestView,
  chestReward,
  describeQuests,
  findQuest,
  pickQuests,
  questProgress,
  questReward,
} from '../config/quests.js';
import { utcDayNumber } from '../config/rewards.js';
import type { DailyQuestDay, User } from '../generated/prisma/client.js';
import { TAPS_PER_RESPECT } from './game.js';
import { prisma } from './prisma.js';

export type QuestErrorCode = 'QUEST_NOT_FOUND' | 'NOT_DONE' | 'ALREADY_CLAIMED';

export class QuestError extends Error {
  constructor(
    readonly code: QuestErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'QuestError';
  }
}

/** Суммарный уровень всех бизнесов игрока — по нему видно покупку. */
async function businessLevels(userId: string): Promise<number> {
  const result = await prisma.userBusiness.aggregate({
    where: { userId },
    _sum: { level: true },
  });

  return result._sum.level ?? 0;
}

async function collectCounters(user: User, today: number): Promise<QuestCounters> {
  const used = usedToday(user, today);

  return {
    // Тапы не хранятся отдельным полем: Respect выдаётся ровно за каждые
    // TAPS_PER_RESPECT тапов, а остаток лежит в respectProgress.
    taps: user.respect * TAPS_PER_RESPECT + user.respectProgress,
    earned: user.totalEarned,
    upgrades: user.tapLevel + user.energyLevel + user.regenLevel,
    business: await businessLevels(user.id),
    donated: user.clanContributed,
    dailyClaimed: user.lastDailyAt !== null && utcDayNumber(user.lastDailyAt) === today,
    fullEnergyUsed: used.full_energy,
    rushUsed: used.rush,
  };
}

/**
 * Строка заданий на сегодня. Создаётся при первом обращении — вместе со
 * слепком показателей, от которого считается прогресс.
 *
 * Гонку двух одновременных заходов разбирает уникальный индекс: проигравший
 * просто перечитывает чужую строку, и слепок остаётся один.
 */
export async function loadQuestDay(user: User, today: number): Promise<DailyQuestDay> {
  const existing = await prisma.dailyQuestDay.findUnique({
    where: { userId_dayNumber: { userId: user.id, dayNumber: today } },
  });

  if (existing) {
    return existing;
  }

  const counters = await collectCounters(user, today);

  try {
    return await prisma.dailyQuestDay.create({
      data: {
        userId: user.id,
        dayNumber: today,
        quests: pickQuests(user.id, today),
        baseTaps: counters.taps,
        baseEarned: counters.earned,
        baseUpgrades: counters.upgrades,
        baseBusiness: counters.business,
        baseDonated: counters.donated,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') {
      throw error;
    }

    return prisma.dailyQuestDay.findUniqueOrThrow({
      where: { userId_dayNumber: { userId: user.id, dayNumber: today } },
    });
  }
}

export interface QuestsState {
  quests: QuestView[];
  chest: {
    /** Все три выполнены — сундук можно забрать. */
    ready: boolean;
    claimed: boolean;
    rewardCoins: string;
    rewardRespect: number;
  };
  /** Сколько секунд до смены заданий. */
  resetInSeconds: number;
}

function secondsToMidnight(now: Date): number {
  const nextDay = (utcDayNumber(now) + 1) * 86_400_000;

  return Math.max(0, Math.round((nextDay - now.getTime()) / 1000));
}

export async function questsState(user: User, now: Date): Promise<QuestsState> {
  const today = utcDayNumber(now);
  const day = await loadQuestDay(user, today);
  const counters = await collectCounters(user, today);
  const quests = describeQuests(day.quests, user, counters, day, day.claimed);
  const allDone = quests.length > 0 && quests.every((quest) => quest.done);

  return {
    quests,
    chest: {
      ready: allDone && !day.chestClaimed,
      claimed: day.chestClaimed,
      rewardCoins: chestReward(user).toString(),
      rewardRespect: CHEST_RESPECT,
    },
    resetInSeconds: secondsToMidnight(now),
  };
}

export interface QuestClaim {
  coins: bigint;
  respect: number;
}

/**
 * Выдаёт награду за задание. Отметка о получении ставится тем же UPDATE,
 * что и начисление, и под условием «в списке полученных этого задания нет» —
 * иначе два одновременных запроса заплатили бы дважды.
 */
export async function claimQuest(
  user: User,
  questId: string,
  now: Date,
): Promise<QuestClaim> {
  const quest = findQuest(questId);
  const today = utcDayNumber(now);
  const day = await loadQuestDay(user, today);

  if (!quest || !day.quests.includes(questId)) {
    throw new QuestError('QUEST_NOT_FOUND', 'Такого задания сегодня нет', 404);
  }

  if (day.claimed.includes(questId)) {
    throw new QuestError('ALREADY_CLAIMED', 'Награда уже получена');
  }

  const counters = await collectCounters(user, today);
  const target = Math.max(1, Math.round(quest.target(user)));

  if (questProgress(quest, counters, day) < target) {
    throw new QuestError('NOT_DONE', 'Задание ещё не выполнено');
  }

  const coins = questReward(quest, user);

  const marked = await prisma.dailyQuestDay.updateMany({
    where: { id: day.id, NOT: { claimed: { has: questId } } },
    data: { claimed: { push: questId } },
  });

  if (marked.count === 0) {
    throw new QuestError('ALREADY_CLAIMED', 'Награда уже получена');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { increment: coins },
      totalEarned: { increment: coins },
      lifetimeEarned: { increment: coins },
      respect: { increment: quest.rewardRespect },
    },
  });

  return { coins, respect: quest.rewardRespect };
}

/** Сундук за все три задания. */
export async function claimChest(user: User, now: Date): Promise<QuestClaim> {
  const today = utcDayNumber(now);
  const day = await loadQuestDay(user, today);

  if (day.chestClaimed) {
    throw new QuestError('ALREADY_CLAIMED', 'Сундук уже получен');
  }

  const counters = await collectCounters(user, today);
  const quests = describeQuests(day.quests, user, counters, day, day.claimed);

  if (quests.length === 0 || !quests.every((quest) => quest.done)) {
    throw new QuestError('NOT_DONE', 'Сначала выполните все три задания');
  }

  const coins = chestReward(user);

  const marked = await prisma.dailyQuestDay.updateMany({
    where: { id: day.id, chestClaimed: false },
    data: { chestClaimed: true },
  });

  if (marked.count === 0) {
    throw new QuestError('ALREADY_CLAIMED', 'Сундук уже получен');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { increment: coins },
      totalEarned: { increment: coins },
      lifetimeEarned: { increment: coins },
      respect: { increment: CHEST_RESPECT },
    },
  });

  return { coins, respect: CHEST_RESPECT };
}

/** Прогресс по слепку требует и полей base*, поэтому тип сходится с моделью. */
export type { QuestBaseline };
