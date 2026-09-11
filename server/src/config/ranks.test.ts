import { describe, expect, it } from 'vitest';
import { RANKS, STARS_PER_RANK, clanRank, rankLabel, rankStep, resolveRank } from './ranks.js';

/**
 * Пороги рангов — самое хрупкое место баланса: resolveRank ищет ступень
 * перебором с конца и молча вернёт ерунду, если порядок нарушен. Опечатка
 * в одном разряде не уронит сборку, но сломает прогресс всем игрокам.
 */
describe('лестница рангов', () => {
  it('идёт строго по возрастанию порога', () => {
    for (let i = 1; i < RANKS.length; i += 1) {
      expect(
        RANKS[i]!.minBalance,
        `${rankLabel(i)} не выше предыдущей ступени`,
      ).toBeGreaterThan(RANKS[i - 1]!.minBalance);
    }
  });

  it('состоит из целых рангов по три звезды', () => {
    expect(RANKS.length % STARS_PER_RANK).toBe(0);

    RANKS.forEach((rank, index) => {
      expect(rank.star).toBe((index % STARS_PER_RANK) + 1);
    });
  });

  it('начинается с нуля — иначе новичок остался бы без ранга', () => {
    expect(RANKS[0]!.minBalance).toBe(0n);
  });

  it('открывает кланы один раз и больше их не закрывает', () => {
    const first = RANKS.findIndex((rank) => rank.canJoinClan);

    expect(first).toBeGreaterThan(0);
    expect(RANKS.slice(first).every((rank) => rank.canJoinClan)).toBe(true);
    expect(clanRank().canJoinClan).toBe(true);
  });
});

describe('resolveRank', () => {
  it('на пороге даёт уже новую ступень, на копейку ниже — старую', () => {
    RANKS.forEach((rank, index) => {
      expect(rankStep(rank.minBalance)).toBe(index);

      if (index > 0) {
        expect(rankStep(rank.minBalance - 1n)).toBe(index - 1);
      }
    });
  });

  it('у последней ступени нет следующей', () => {
    const top = resolveRank(RANKS.at(-1)!.minBalance * 10n);

    expect(top.next).toBeNull();
    expect(top.star).toBe(STARS_PER_RANK);
  });

  it('у всех остальных следующая ступень дороже текущей', () => {
    RANKS.slice(0, -1).forEach((rank) => {
      const view = resolveRank(rank.minBalance);

      expect(view.next).not.toBeNull();
      expect(BigInt(view.next!.minBalance)).toBeGreaterThan(BigInt(view.minBalance));
    });
  });

  it('отрицательный баланс не роняет расчёт', () => {
    expect(resolveRank(-1n).step).toBe(0);
  });
});
