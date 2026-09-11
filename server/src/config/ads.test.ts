import { describe, expect, it } from 'vitest';
import type { Favor } from '../generated/prisma/client.js';
import { START_STATE } from '../lib/upgrades.js';
import { adReward, adStatus, isChatId, isRunning, isTelegramUrl, slotsLeft } from './ads.js';

const now = new Date('2026-09-11T12:00:00Z');

const campaign = (over: Partial<Favor> = {}): Favor =>
  ({
    id: 'ad',
    weekNumber: 0,
    advertiser: null,
    title: 'Подпишись',
    channelName: 'Канал',
    channelUrl: 'https://t.me/channel',
    channelChatId: '@channel',
    rewardDonc: 50_000n,
    rewardHours: null,
    familyXpReward: 20,
    startsAt: null,
    endsAt: null,
    slots: null,
    completedCount: 0,
    sortOrder: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...over,
  }) as Favor;

/**
 * Здесь игра берёт деньги, поэтому проверки строже обычного: показать
 * кампанию, которая кончилась, или выдать больше подписок, чем оплачено, —
 * это не баг интерфейса, а невыполненное обязательство перед клиентом.
 */
describe('когда кампания идёт', () => {
  it('без срока и лимита — всегда', () => {
    expect(isRunning(campaign(), now)).toBe(true);
  });

  it('снятая с показа — никогда', () => {
    expect(isRunning(campaign({ active: false }), now)).toBe(false);
  });

  it('до начала размещения — нет', () => {
    expect(isRunning(campaign({ startsAt: new Date('2026-09-12T00:00:00Z') }), now)).toBe(
      false,
    );
  });

  it('после окончания — нет', () => {
    expect(isRunning(campaign({ endsAt: new Date('2026-09-11T00:00:00Z') }), now)).toBe(
      false,
    );
  });

  it('в последнюю секунду срока — ещё да', () => {
    expect(
      isRunning(campaign({ endsAt: new Date('2026-09-11T12:00:01Z') }), now),
    ).toBe(true);
  });

  it('когда лимит выбран — нет', () => {
    expect(isRunning(campaign({ slots: 100, completedCount: 100 }), now)).toBe(false);
    expect(isRunning(campaign({ slots: 100, completedCount: 99 }), now)).toBe(true);
  });
});

describe('остаток подписок', () => {
  it('без лимита не ограничен', () => {
    expect(slotsLeft(campaign())).toBeNull();
  });

  it('не уходит в минус, даже если счётчик обогнал лимит', () => {
    expect(slotsLeft(campaign({ slots: 10, completedCount: 12 }))).toBe(0);
  });
});

describe('награда игроку', () => {
  const player = {
    coinsPerTap: START_STATE.coinsPerTap,
    energyPerSecond: START_STATE.energyPerSecond,
  };

  it('без rewardHours — ровно оговорённая сумма', () => {
    expect(adReward(campaign(), player)).toBe(50_000n);
  });

  it('с rewardHours растёт вместе с игроком', () => {
    const ad = campaign({ rewardHours: 3, rewardDonc: 0n });
    const strong = { coinsPerTap: player.coinsPerTap * 100, energyPerSecond: 20 };

    expect(adReward(ad, strong)).toBeGreaterThan(adReward(ad, player));
  });

  it('не опускается ниже фиксированной суммы', () => {
    // У новичка час дохода — копейки, и без нижней границы первая же
    // кампания выглядела бы издевательством.
    const ad = campaign({ rewardHours: 0.001, rewardDonc: 50_000n });

    expect(adReward(ad, player)).toBe(50_000n);
  });
});

describe('статус для админки', () => {
  it.each([
    ['stopped', campaign({ active: false })],
    ['scheduled', campaign({ startsAt: new Date('2026-09-12T00:00:00Z') })],
    ['finished', campaign({ endsAt: new Date('2026-09-10T00:00:00Z') })],
    ['sold_out', campaign({ slots: 5, completedCount: 5 })],
    ['running', campaign()],
  ])('%s', (expected, ad) => {
    expect(adStatus(ad, now)).toBe(expected);
  });
});

describe('проверка полей кампании', () => {
  it('принимает только ссылки на Telegram', () => {
    expect(isTelegramUrl('https://t.me/channel')).toBe(true);
    expect(isTelegramUrl('https://t.me/+aBcD1234')).toBe(true);
    expect(isTelegramUrl('http://t.me/channel')).toBe(false);
    expect(isTelegramUrl('https://example.com/channel')).toBe(false);
    expect(isTelegramUrl('https://t.me.evil.com/channel')).toBe(false);
  });

  it('принимает @username и числовой id канала', () => {
    expect(isChatId('@matryoshkaexpress')).toBe(true);
    expect(isChatId('-1001234567890')).toBe(true);
    expect(isChatId('@ab')).toBe(false);
    expect(isChatId('просто текст')).toBe(false);
  });
});
