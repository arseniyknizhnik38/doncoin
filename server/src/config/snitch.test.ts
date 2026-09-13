import { describe, expect, it } from 'vitest';
import {
  KUSH_MIN,
  SNITCH_COOLDOWN_HOURS,
  SNITCH_IDLE_HOURS,
  SNITCH_QUOTES,
  canCallSnitch,
  kushFor,
} from './snitch.js';

const now = new Date('2026-09-13T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

const friend = {
  referredById: 'inviter',
  referralRewarded: true,
  lastSeenAt: hoursAgo(SNITCH_IDLE_HOURS + 1),
  snitchCalledAt: null as Date | null,
  snitchPending: false,
};

describe('кента подозревают', () => {
  it('после суток без захода', () => {
    expect(canCallSnitch(friend, now)).toBe(true);
  });

  it('не раньше суток', () => {
    expect(canCallSnitch({ ...friend, lastSeenAt: hoursAgo(SNITCH_IDLE_HOURS - 1) }, now)).toBe(false);
  });

  it('только пришедшего по ссылке', () => {
    expect(canCallSnitch({ ...friend, referredById: null }, now)).toBe(false);
  });

  it('только отыгравшего порог приглашения — иначе куш фармится пустыми аккаунтами', () => {
    expect(canCallSnitch({ ...friend, referralRewarded: false }, now)).toBe(false);
  });

  it('не дважды, пока прошлый куш не забран', () => {
    expect(canCallSnitch({ ...friend, snitchPending: true }, now)).toBe(false);
  });

  it('не чаще раза в неделю', () => {
    expect(canCallSnitch({ ...friend, snitchCalledAt: hoursAgo(SNITCH_COOLDOWN_HOURS - 1) }, now)).toBe(false);
    expect(canCallSnitch({ ...friend, snitchCalledAt: hoursAgo(SNITCH_COOLDOWN_HOURS + 1) }, now)).toBe(true);
  });
});

describe('куш', () => {
  it('у новичка не меньше нижней границы', () => {
    expect(kushFor({ coinsPerTap: 1, energyPerSecond: 1 })).toBe(KUSH_MIN);
  });

  it('растёт с доходом игрока', () => {
    expect(kushFor({ coinsPerTap: 10_000, energyPerSecond: 5 })).toBeGreaterThan(KUSH_MIN);
  });
});

describe('цитаты', () => {
  it('на обоих языках одинаковое число, с именем пригласившего и лещом', () => {
    expect(SNITCH_QUOTES.ru.length).toBe(SNITCH_QUOTES.en.length);

    for (const quote of [...SNITCH_QUOTES.ru, ...SNITCH_QUOTES.en]) {
      expect(quote).toContain('{inviter}');
      expect(quote.startsWith('🐟')).toBe(true);
    }
  });
});
