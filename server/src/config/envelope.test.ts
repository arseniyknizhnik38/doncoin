import { describe, expect, it } from 'vitest';
import {
  ENVELOPE_FROM_STEP,
  ENVELOPE_TIERS,
  averageHours,
  envelopeReward,
  pickTier,
} from './envelope.js';
import { RANKS } from './ranks.js';
import { START_STATE } from '../lib/upgrades.js';

describe('раскладка конверта', () => {
  it('доли складываются в единицу', () => {
    const sum = ENVELOPE_TIERS.reduce((total, tier) => total + tier.chance, 0);

    // Без этого часть бросков не попадёт никуда или попадёт дважды.
    expect(sum).toBeCloseTo(1, 10);
  });

  it('ступени идут от частой и дешёвой к редкой и дорогой', () => {
    for (let i = 1; i < ENVELOPE_TIERS.length; i += 1) {
      expect(ENVELOPE_TIERS[i]!.chance).toBeLessThan(ENVELOPE_TIERS[i - 1]!.chance);
      expect(ENVELOPE_TIERS[i]!.hours).toBeGreaterThan(ENVELOPE_TIERS[i - 1]!.hours);
    }
  });

  it('попадает в нужную ступень на границах', () => {
    // Границы — то место, где ошибка на единицу раздаёт верхнюю ступень
    // вдесятеро чаще задуманного и замечается только по балансу экономики.
    expect(pickTier(0).id).toBe('thin');
    expect(pickTier(0.5999).id).toBe('thin');
    expect(pickTier(0.6).id).toBe('usual');
    expect(pickTier(0.8499).id).toBe('usual');
    expect(pickTier(0.85).id).toBe('thick');
    expect(pickTier(0.9699).id).toBe('thick');
    expect(pickTier(0.97).id).toBe('fat');
    expect(pickTier(0.9999).id).toBe('fat');
  });

  it('не падает на краю диапазона', () => {
    expect(pickTier(1).id).toBe('fat');
    expect(pickTier(1.0000001).id).toBe('fat');
  });

  it('на большом числе бросков даёт заявленные частоты', () => {
    const counts = new Map<string, number>();
    const rolls = 200_000;

    for (let i = 0; i < rolls; i += 1) {
      const id = pickTier(i / rolls).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    for (const tier of ENVELOPE_TIERS) {
      const share = (counts.get(tier.id) ?? 0) / rolls;

      expect(share).toBeCloseTo(tier.chance, 3);
    }
  });
});

describe('баланс конверта', () => {
  it('в среднем не ломает экономику', () => {
    // Ориентир — остальные дневные награды: задания дают около шести часов
    // дохода, шифр шесть. Конверт должен добавлять азарт, а не заменять
    // собой заработок.
    expect(averageHours()).toBeGreaterThan(1);
    expect(averageHours()).toBeLessThan(4);
  });

  it('верхняя ступень заметна, но не чаще раза в месяц', () => {
    const fat = ENVELOPE_TIERS[ENVELOPE_TIERS.length - 1]!;
    const daysBetween = 1 / fat.chance;

    // Реже — о ней никто не узнает, а весь смысл крупного выигрыша в том,
    // что о нём рассказывают. Чаще — перестаёт быть событием.
    expect(daysBetween).toBeGreaterThan(14);
    expect(daysBetween).toBeLessThan(60);
  });

  it('награда растёт вместе с силой игрока', () => {
    const tier = ENVELOPE_TIERS[0]!;
    const novice = envelopeReward(tier, START_STATE);
    const veteran = envelopeReward(tier, { coinsPerTap: 500, energyPerSecond: 10 });

    expect(veteran).toBeGreaterThan(novice);
    // Фиксированная сумма к «Капо» превратилась бы в ничто, и конверт
    // перестал бы быть поводом заходить.
    expect(novice).toBeGreaterThan(0n);
  });
});

describe('когда начинают заносить', () => {
  it('с первой звезды «Солдата»', () => {
    const rank = RANKS[ENVELOPE_FROM_STEP]!;

    expect(rank.id).toBe('soldier');
    expect(rank.star).toBe(1);
  });

  it('не раньше, чем открываются кланы', () => {
    // Конверт — часть жизни семьи. Получать его, не имея права вступить
    // в клан, было бы странно.
    const clanStep = RANKS.findIndex((rank) => rank.canJoinClan);

    expect(ENVELOPE_FROM_STEP).toBeGreaterThanOrEqual(clanStep);
  });
});
