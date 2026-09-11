import { describe, expect, it } from 'vitest';
import { START_STATE } from '../lib/upgrades.js';
import {
  DAILY_MILESTONES,
  DAILY_STREAK_CAP,
  OFFLINE_MAX_HOURS,
  computeOfflineEarnings,
  dailyReward,
  dailyStatus,
  utcDayNumber,
} from './rewards.js';

const player = {
  coinsPerTap: START_STATE.coinsPerTap,
  energyPerSecond: START_STATE.energyPerSecond,
  energyMax: START_STATE.energyMax,
};

const at = (iso: string) => new Date(iso);

describe('ежедневный бонус', () => {
  it('растёт от обычного дня к обычному', () => {
    // Строгий рост «каждый день больше предыдущего» здесь неверен: после
    // тройной награды седьмого дня восьмой закономерно платит меньше. Расти
    // должна база, то есть обычные дни между вехами.
    const plain = Array.from({ length: DAILY_STREAK_CAP }, (_, i) => i + 1).filter(
      (day) => !DAILY_MILESTONES.includes(day),
    );

    plain.forEach((day, index) => {
      if (index === 0) {
        return;
      }

      expect(dailyReward(player, day)).toBeGreaterThan(
        dailyReward(player, plain[index - 1]!),
      );
    });
  });

  it('после вехи платит больше, чем до неё — серию не обрывают на спаде', () => {
    DAILY_MILESTONES.filter((day) => day < DAILY_STREAK_CAP).forEach((day) => {
      expect(dailyReward(player, day + 1)).toBeGreaterThan(dailyReward(player, day - 1));
    });
  });

  it('на вехах платит втрое', () => {
    DAILY_MILESTONES.forEach((day) => {
      const plain = dailyReward(player, day - 1);
      const milestone = dailyReward(player, day);

      expect(milestone).toBeGreaterThan(plain * 2n);
    });
  });

  it('не растёт за потолком серии', () => {
    const capped = dailyReward(player, DAILY_STREAK_CAP);

    expect(dailyReward(player, DAILY_STREAK_CAP + 50)).toBe(capped);
  });

  it('нулевой и отрицательный день считаются первым', () => {
    expect(dailyReward(player, 0)).toBe(dailyReward(player, 1));
    expect(dailyReward(player, -5)).toBe(dailyReward(player, 1));
  });
});

describe('статус ежедневного бонуса', () => {
  const base = { ...player, dailyStreak: 3, lastDailyAt: at('2026-09-10T12:00:00Z') };

  it('на следующий день продолжает серию', () => {
    const status = dailyStatus(base, at('2026-09-11T05:00:00Z'));

    expect(status.available).toBe(true);
    expect(status.nextStreak).toBe(4);
  });

  it('в тот же день повторно не даёт', () => {
    expect(dailyStatus(base, at('2026-09-10T23:59:00Z')).available).toBe(false);
  });

  it('после пропуска начинает серию заново', () => {
    const status = dailyStatus(base, at('2026-09-12T05:00:00Z'));

    expect(status.available).toBe(true);
    expect(status.nextStreak).toBe(1);
  });

  it('за потолком серии идёт по новому кругу', () => {
    const status = dailyStatus(
      { ...base, dailyStreak: DAILY_STREAK_CAP },
      at('2026-09-11T05:00:00Z'),
    );

    expect(status.nextStreak).toBe(1);
  });

  it('новичок без истории получает первый день', () => {
    const status = dailyStatus(
      { ...player, dailyStreak: 0, lastDailyAt: null },
      at('2026-09-11T05:00:00Z'),
    );

    expect(status.available).toBe(true);
    expect(status.nextStreak).toBe(1);
  });

  it('обещает ближайшую тройную награду', () => {
    const status = dailyStatus(
      { ...player, dailyStreak: 4, lastDailyAt: at('2026-09-10T12:00:00Z') },
      at('2026-09-11T05:00:00Z'),
    );

    // Пятый день серии, ближайшая веха — седьмой.
    expect(status.daysToMilestone).toBe(2);
    expect(status.milestone).toBe(false);
  });
});

describe('оффлайн-доход', () => {
  const idle = { ...player, lastSeenAt: at('2026-09-10T00:00:00Z') };

  it('копится, пока игрока нет', () => {
    const hour = computeOfflineEarnings(idle, at('2026-09-10T01:00:00Z'));
    const two = computeOfflineEarnings(idle, at('2026-09-10T02:00:00Z'));

    expect(hour.earned).toBeGreaterThan(0n);
    expect(two.earned).toBeGreaterThan(hour.earned);
  });

  it('упирается в потолок — иначе заходить незачем', () => {
    const capped = computeOfflineEarnings(idle, at('2026-09-11T00:00:00Z'));
    const exact = computeOfflineEarnings(
      idle,
      new Date(idle.lastSeenAt.getTime() + OFFLINE_MAX_HOURS * 3_600_000),
    );

    expect(capped.capped).toBe(true);
    expect(capped.earned).toBe(exact.earned);
  });

  it('за ночь даёт меньше, чем игрок берёт тапами за то же время', () => {
    const night = computeOfflineEarnings(idle, at('2026-09-10T08:00:00Z'));
    const active = BigInt(
      Math.floor(((player.coinsPerTap * player.energyPerSecond * 3600) / 10) * 8),
    );

    expect(night.earned).toBeLessThan(active);
  });

  it('часы вперёд не начисляют долг', () => {
    const past = computeOfflineEarnings(idle, at('2026-09-09T00:00:00Z'));

    expect(past.earned).toBe(0n);
  });

  it('прибавка процентов увеличивает выплату', () => {
    const plain = computeOfflineEarnings(idle, at('2026-09-10T04:00:00Z'), 0);
    const boosted = computeOfflineEarnings(idle, at('2026-09-10T04:00:00Z'), 50);

    expect(boosted.earned).toBeGreaterThan(plain.earned);
  });
});

describe('номер суток', () => {
  it('меняется ровно в полночь UTC', () => {
    expect(utcDayNumber(at('2026-09-10T23:59:59Z'))).toBe(
      utcDayNumber(at('2026-09-10T00:00:00Z')),
    );
    expect(utcDayNumber(at('2026-09-11T00:00:00Z'))).toBe(
      utcDayNumber(at('2026-09-10T00:00:00Z')) + 1,
    );
  });
});
