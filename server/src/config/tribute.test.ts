import { describe, expect, it } from 'vitest';
import { TRIBUTE_MAX_PERCENT, splitTribute } from './perks.js';

describe('отстёгивание наверх', () => {
  it('делит доход по ставке', () => {
    const { toTreasury, toPlayer } = splitTribute(1_000n, 10);

    expect(toTreasury).toBe(100n);
    expect(toPlayer).toBe(900n);
  });

  it('ничего не теряется при делении', () => {
    // Округление вниз в пользу игрока, но сумма частей всегда равна целому:
    // иначе монеты исчезали бы на каждом сборе дохода.
    for (const earned of [1n, 7n, 99n, 12_345n, 999_999_999n]) {
      for (const percent of [0, 1, 7, 10, 20]) {
        const { toTreasury, toPlayer } = splitTribute(earned, percent);

        expect(toTreasury + toPlayer).toBe(earned);
      }
    }
  });

  it('нулевая ставка ничего не снимает', () => {
    expect(splitTribute(1_000n, 0)).toEqual({ toTreasury: 0n, toPlayer: 1_000n });
  });

  it('ставку выше потолка обрезает', () => {
    // Защита на случай, если в базе окажется значение мимо проверки: глава,
    // поставивший девяносто процентов, разогнал бы семью за вечер.
    const capped = splitTribute(1_000n, 90);
    const atMax = splitTribute(1_000n, TRIBUTE_MAX_PERCENT);

    expect(capped).toEqual(atMax);
  });

  it('на копейках не отнимает больше, чем есть', () => {
    expect(splitTribute(1n, 20)).toEqual({ toTreasury: 0n, toPlayer: 1n });
    expect(splitTribute(0n, 20)).toEqual({ toTreasury: 0n, toPlayer: 0n });
  });
});
