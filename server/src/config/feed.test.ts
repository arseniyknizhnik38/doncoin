import { describe, expect, it } from 'vitest';
import { FEED_RANK_FROM_STEP, feedText, isClanEvent } from './feed.js';
import { RANKS } from './ranks.js';

const event = (over: Partial<Parameters<typeof feedText>[0]> = {}) => ({
  kind: 'clan_created',
  actor: 'Корлеоне',
  rival: null,
  amount: null,
  rank: null,
  ...over,
});

describe('тексты ленты', () => {
  it('семья заявила о себе', () => {
    expect(feedText(event())).toBe('Семья «Корлеоне» заявила о себе');
  });

  it('война с добычей и без', () => {
    const withLoot = feedText(
      event({ kind: 'war_won', rival: 'Траттория', amount: 1_200_000n }),
    );
    const without = feedText(event({ kind: 'war_won', rival: 'Траттория', amount: 0n }));

    expect(withLoot).toContain('взяли с «Траттория»');
    // Ноль добычи — отдельная формулировка: «взяли 0» читается как насмешка.
    expect(without).toBe('«Корлеоне» разобрались с «Траттория»');
  });

  it('повышение подписывается рангом, а не именем ступени', () => {
    expect(feedText(event({ kind: 'rank_up', actor: 'Вито', rank: 'Капо ★' })))
      .toBe('Вито теперь Капо ★');
  });

  it('неизвестный вид не роняет ленту', () => {
    // Событие могло быть записано старой версией кода и остаться в базе.
    expect(feedText(event({ kind: 'что-то новое' }))).toBe('Корлеоне');
  });
});

describe('разделение на семьи и людей', () => {
  it('клановые события помечаются', () => {
    expect(isClanEvent('clan_created')).toBe(true);
    expect(isClanEvent('clan_level')).toBe(true);
    expect(isClanEvent('war_started')).toBe(true);
    expect(isClanEvent('war_won')).toBe(true);
  });

  it('личные — нет', () => {
    expect(isClanEvent('rank_up')).toBe(false);
    expect(isClanEvent('retired')).toBe(false);
    expect(isClanEvent('fat_envelope')).toBe(false);
  });
});

describe('порог попадания ранга в ленту', () => {
  it('начинается с «Капо» и не ниже', () => {
    const rank = RANKS[FEED_RANK_FROM_STEP]!;

    expect(rank.id).toBe('capo');
    expect(rank.star).toBe(1);
  });

  it('отсекает больше половины ступеней', () => {
    // Ниже повышения идут каждые несколько часов у каждого игрока: без
    // отсечки лента превратилась бы в бегущую строку, где не видно войн.
    expect(FEED_RANK_FROM_STEP).toBeGreaterThan(RANKS.length / 2 - 1);
  });
});
