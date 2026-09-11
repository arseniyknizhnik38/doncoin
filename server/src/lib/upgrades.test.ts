import { describe, expect, it } from 'vitest';
import { ENERGY_PER_TAP } from './energy.js';
import { START_STATE, UPGRADES, findUpgrade } from './upgrades.js';

const tap = findUpgrade('tap')!;
const energy = findUpgrade('energy')!;
const regen = findUpgrade('regen')!;

/**
 * Кривые улучшений задают темп всей игры. Прошлая версия упиралась в потолок
 * двадцатого уровня, и игра заканчивалась за полторы недели — проверяем не
 * конкретные числа (они меняются при ребалансе), а свойства, которые ломаться
 * не должны.
 */
describe('кривые улучшений', () => {
  it.each(UPGRADES.map((upgrade) => [upgrade.id, upgrade] as const))(
    '«%s»: цена растёт с каждым уровнем',
    (_id, upgrade) => {
      for (let level = 0; level < 30; level += 1) {
        expect(upgrade.price(level + 1)).toBeGreaterThan(upgrade.price(level));
      }
    },
  );

  it('потолок недостижимо высок — ограничивает цена, а не число уровней', () => {
    UPGRADES.forEach((upgrade) => {
      expect(upgrade.maxLevel).toBeGreaterThanOrEqual(40);
    });
  });

  it('«Хватка» умножает, а не прибавляет', () => {
    const at = (level: number) => tap.valueAt(level).coinsPerTap!;

    // Прибавка сама должна расти: линейный бонус против экспоненциальной
    // цены обесценивал ветку к десятому уровню.
    const early = at(5) - at(4);
    const late = at(25) - at(24);

    expect(late).toBeGreaterThan(early * 5);
  });

  it('запас и восстановление растут линейно', () => {
    const clip = (level: number) => energy.valueAt(level).energyMax!;
    const speed = (level: number) => regen.valueAt(level).energyPerSecond!;

    expect(clip(2) - clip(1)).toBe(clip(11) - clip(10));
    expect(speed(2) - speed(1)).toBe(speed(11) - speed(10));
  });
});

describe('стартовое состояние', () => {
  it('совпадает с нулевыми уровнями каталога', () => {
    expect(START_STATE.coinsPerTap).toBe(tap.valueAt(0).coinsPerTap);
    expect(START_STATE.energyMax).toBe(energy.valueAt(0).energyMax);
    expect(START_STATE.energyPerSecond).toBe(regen.valueAt(0).energyPerSecond);
  });

  it('даёт полную обойму — новичок не ждёт восстановления', () => {
    expect(START_STATE.energy).toBe(START_STATE.energyMax);
  });

  it('обойма кратна стоимости тапа, иначе остаток не потратить', () => {
    expect(START_STATE.energyMax % ENERGY_PER_TAP).toBe(0);
  });

  it('обойма копится около часа, а не минуты и не сутки', () => {
    const seconds = START_STATE.energyMax / START_STATE.energyPerSecond;
    const minutes = seconds / 60;

    // Пятнадцать минут — это «выжал и забыл», три часа — это «не дождусь».
    expect(minutes).toBeGreaterThan(45);
    expect(minutes).toBeLessThan(180);
  });
});

describe('описания для интерфейса', () => {
  it('есть у каждого уровня до потолка', () => {
    UPGRADES.forEach((upgrade) => {
      expect(upgrade.describe(0)).toBeTruthy();
      expect(upgrade.describe(upgrade.maxLevel)).toBeTruthy();
    });
  });
});
