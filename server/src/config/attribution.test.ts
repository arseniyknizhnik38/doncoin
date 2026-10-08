import { describe, expect, it } from 'vitest';
import { estimateAccountAgeDays, parseAdTag } from './attribution.js';

const ANCHORS = '1000000000:2020-11-01,7000000000:2024-01-01';

describe('parseAdTag', () => {
  it('разбирает сеть, площадку и click id', () => {
    expect(parseAdTag('ad_adsgram_block7_abc123')).toEqual({
      source: 'adsgram',
      placement: 'block7',
      clickId: 'abc123',
    });
  });

  it('работает без площадки', () => {
    expect(parseAdTag('ad_adsgram_abc123')).toEqual({
      source: 'adsgram',
      placement: null,
      clickId: 'abc123',
    });
  });

  it('не теряет подчёркивания внутри click id', () => {
    expect(parseAdTag('ad_adsgram_block7_a_b_c')?.clickId).toBe('a_b_c');
  });

  it('код кента рекламной меткой не считает', () => {
    expect(parseAdTag('RANK777106')).toBeNull();
    expect(parseAdTag(null)).toBeNull();
    expect(parseAdTag('')).toBeNull();
  });

  it('отбрасывает мусор вместо имени сети', () => {
    expect(parseAdTag('ad__abc')).toBeNull();
    expect(parseAdTag('ad_adsgram')).toBeNull();
    expect(parseAdTag(`ad_${'x'.repeat(20)}_abc`)).toBeNull();
  });

  it('приводит сеть и площадку к нижнему регистру', () => {
    expect(parseAdTag('ad_AdsGram_Block7_Abc')).toEqual({
      source: 'adsgram',
      placement: 'block7',
      clickId: 'Abc',
    });
  });
});

describe('estimateAccountAgeDays', () => {
  const now = new Date('2026-10-08T00:00:00Z');

  it('у свежего идентификатора возраст меньше недели', () => {
    // Линейно продолжаем опоры до «сегодня» и берём ещё более высокий id.
    const perDay = (7_000_000_000 - 1_000_000_000) / ((new Date('2024-01-01').getTime() - new Date('2020-11-01').getTime()) / 86_400_000);
    const todayId = Math.round(7_000_000_000 + perDay * ((now.getTime() - new Date('2024-01-01').getTime()) / 86_400_000));

    const age = estimateAccountAgeDays(String(todayId), now, ANCHORS);

    expect(age).not.toBeNull();
    expect(age!).toBeLessThan(7);
  });

  it('старый идентификатор считает старым', () => {
    expect(estimateAccountAgeDays('123456', now, ANCHORS)!).toBeGreaterThan(365);
  });

  it('без опор проверку не применяет', () => {
    expect(estimateAccountAgeDays('8238072146', now, '')).toBeNull();
    expect(estimateAccountAgeDays('8238072146', now, '1000000000:2020-11-01')).toBeNull();
  });

  it('кривые опоры не роняют расчёт', () => {
    expect(estimateAccountAgeDays('8238072146', now, 'abc:def,1:2')).toBeNull();
    expect(estimateAccountAgeDays('не-число', now, ANCHORS)).toBeNull();
  });
});
