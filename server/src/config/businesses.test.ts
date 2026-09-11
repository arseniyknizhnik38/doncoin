import { describe, expect, it } from 'vitest';
import { RANKS } from './ranks.js';
import {
  BUSINESS_CATALOG,
  BUSINESS_RANK_GATE,
  COLLECT_CAP_HOURS,
  levelCost,
  levelIncome,
  requiredRankStep,
} from './businesses.js';

const payback = (business: (typeof BUSINESS_CATALOG)[number]) =>
  Number(business.baseCost) / Number(business.baseIncomePerHour);

describe('каталог бизнесов', () => {
  it('идёт по возрастанию цены', () => {
    for (let i = 1; i < BUSINESS_CATALOG.length; i += 1) {
      expect(BUSINESS_CATALOG[i]!.baseCost).toBeGreaterThan(BUSINESS_CATALOG[i - 1]!.baseCost);
    }
  });

  it('окупаемость растёт вместе с ценой', () => {
    // Дешёвые выгоднее по вложенному DONC, дорогие берут абсолютом. Если бы
    // дорогой оказался ещё и выгоднее, весь остальной каталог обесценился бы.
    for (let i = 1; i < BUSINESS_CATALOG.length; i += 1) {
      expect(payback(BUSINESS_CATALOG[i]!)).toBeGreaterThan(payback(BUSINESS_CATALOG[i - 1]!));
    }
  });

  it('окупается за разумный срок', () => {
    BUSINESS_CATALOG.forEach((business) => {
      expect(payback(business)).toBeGreaterThan(12);
      expect(payback(business)).toBeLessThan(120);
    });
  });

  it('у каждого бизнеса свой slug и своя ступень открытия', () => {
    const slugs = BUSINESS_CATALOG.map((business) => business.slug);

    expect(new Set(slugs).size).toBe(slugs.length);

    slugs.forEach((slug) => {
      expect(BUSINESS_RANK_GATE[slug], `${slug} не привязан к рангу`).toBeDefined();
    });
  });

  it('первый бизнес доступен сразу, остальные открываются по порядку', () => {
    expect(requiredRankStep(BUSINESS_CATALOG[0]!.slug)).toBe(0);

    for (let i = 1; i < BUSINESS_CATALOG.length; i += 1) {
      expect(requiredRankStep(BUSINESS_CATALOG[i]!.slug)).toBeGreaterThanOrEqual(
        requiredRankStep(BUSINESS_CATALOG[i - 1]!.slug),
      );
    }
  });

  it('ни один бизнес не заперт за несуществующей ступенью', () => {
    BUSINESS_CATALOG.forEach((business) => {
      expect(requiredRankStep(business.slug)).toBeLessThan(RANKS.length);
    });
  });

  it('первый бизнес по карману в первый вечер', () => {
    // Дороже второй звезды — и новичок не увидит пассивного дохода вовсе.
    expect(BUSINESS_CATALOG[0]!.baseCost).toBeLessThanOrEqual(RANKS[1]!.minBalance);
  });
});

describe('уровни бизнеса', () => {
  const business = BUSINESS_CATALOG[0]!;

  it('цена растёт, доход — линейно', () => {
    expect(levelCost(business, 1)).toBeGreaterThan(levelCost(business, 0));
    expect(levelIncome(business, 2) - levelIncome(business, 1)).toBe(
      levelIncome(business, 1) - levelIncome(business, 0),
    );
  });

  it('некупленный бизнес не приносит ничего', () => {
    expect(levelIncome(business, 0)).toBe(0n);
  });

  it('каждый следующий уровень окупается дольше предыдущего', () => {
    // Иначе качать один бизнес вглубь выгодно бесконечно, и остальной
    // каталог не нужен.
    const paybackAt = (level: number) =>
      Number(levelCost(business, level)) /
      Number(levelIncome(business, level + 1) - levelIncome(business, level));

    expect(paybackAt(5)).toBeGreaterThan(paybackAt(4));
  });
});

describe('потолок накопления', () => {
  it('покрывает рабочий день, но не сутки', () => {
    // Без потолка активность не значит ничего: заходящий раз в день идёт
    // вровень с тем, кто заходит пять раз.
    expect(COLLECT_CAP_HOURS).toBeGreaterThan(1);
    expect(COLLECT_CAP_HOURS).toBeLessThan(12);
  });
});
