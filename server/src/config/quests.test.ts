import { describe, expect, it } from 'vitest';
import type { User } from '../generated/prisma/client.js';
import { START_STATE } from '../lib/upgrades.js';
import {
  QUESTS,
  QUESTS_PER_DAY,
  type QuestBaseline,
  type QuestCounters,
  describeQuests,
  findQuest,
  pickQuests,
  questProgress,
} from './quests.js';

const user = {
  ...START_STATE,
  totalEarned: 100_000n,
} as unknown as User;

const baseline: QuestBaseline = {
  baseTaps: 1_000,
  baseEarned: 100_000n,
  baseUpgrades: 4,
  baseBusiness: 2,
  baseDonated: 0n,
};

const counters = (over: Partial<QuestCounters> = {}): QuestCounters => ({
  taps: 1_000,
  earned: 100_000n,
  upgrades: 4,
  business: 2,
  donated: 0n,
  dailyClaimed: false,
  fullEnergyUsed: 0,
  rushUsed: 0,
  ...over,
});

describe('выдача заданий на день', () => {
  it('даёт ровно столько, сколько положено', () => {
    expect(pickQuests('user-1', 20_000)).toHaveLength(QUESTS_PER_DAY);
  });

  it('не повторяет одно задание дважды за день', () => {
    const picked = pickQuests('user-1', 20_000);

    expect(new Set(picked).size).toBe(picked.length);
  });

  it('выдаёт только существующие задания', () => {
    pickQuests('user-1', 20_000).forEach((id) => {
      expect(findQuest(id)).toBeDefined();
    });
  });

  it('детерминирована: тот же игрок в тот же день — те же задания', () => {
    expect(pickQuests('user-1', 20_000)).toEqual(pickQuests('user-1', 20_000));
  });

  it('у разных игроков разные наборы', () => {
    // Иначе чат превращается в один общий список на всех.
    const different = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
      pickQuests(id, 20_000).join(','),
    );

    expect(new Set(different).size).toBeGreaterThan(1);
  });

  it('меняется на следующий день', () => {
    const days = Array.from({ length: 10 }, (_, i) => pickQuests('user-1', 20_000 + i).join(','));

    expect(new Set(days).size).toBeGreaterThan(1);
  });
});

describe('прогресс по слепку', () => {
  it('считает только то, что сделано после выдачи заданий', () => {
    const quest = findQuest('taps_1500')!;

    expect(questProgress(quest, counters(), baseline)).toBe(0);
    expect(questProgress(quest, counters({ taps: 2_500 }), baseline)).toBe(1_500);
  });

  it('не уходит в минус, если показатель почему-то упал', () => {
    const quest = findQuest('upgrade_2')!;

    expect(questProgress(quest, counters({ upgrades: 1 }), baseline)).toBe(0);
  });

  it('счётчики бустеров берёт как есть — они и так обнуляются за сутки', () => {
    const quest = findQuest('rush_3')!;

    expect(questProgress(quest, counters({ rushUsed: 2 }), baseline)).toBe(2);
  });

  it('ежедневный бонус — да или нет', () => {
    const quest = findQuest('daily_claim')!;

    expect(questProgress(quest, counters({ dailyClaimed: true }), baseline)).toBe(1);
    expect(questProgress(quest, counters(), baseline)).toBe(0);
  });
});

describe('описание заданий', () => {
  it('цель всегда больше нуля — иначе задание выполнено при выдаче', () => {
    const views = describeQuests(
      QUESTS.map((quest) => quest.id),
      user,
      counters(),
      baseline,
      [],
    );

    views.forEach((view) => {
      expect(view.target).toBeGreaterThan(0);
      expect(view.description).toBeTruthy();
    });
  });

  it('прогресс не превышает цель', () => {
    const views = describeQuests(
      ['taps_1500'],
      user,
      counters({ taps: 999_999 }),
      baseline,
      [],
    );

    expect(views[0]!.progress).toBe(views[0]!.target);
    expect(views[0]!.done).toBe(true);
  });

  it('молча пропускает задание, убранное из каталога среди дня', () => {
    const views = describeQuests(['taps_1500', 'нет-такого'], user, counters(), baseline, []);

    expect(views).toHaveLength(1);
  });

  it('помечает уже полученные награды', () => {
    const views = describeQuests(['taps_1500'], user, counters(), baseline, ['taps_1500']);

    expect(views[0]!.claimed).toBe(true);
  });

  it('награда каждого задания больше нуля', () => {
    const views = describeQuests(
      QUESTS.map((quest) => quest.id),
      user,
      counters(),
      baseline,
      [],
    );

    views.forEach((view) => {
      expect(BigInt(view.rewardCoins)).toBeGreaterThan(0n);
    });
  });
});
