import { describe, expect, it } from 'vitest';
import {
  OMERTA_ITEMS,
  OMERTA_LENGTH,
  OMERTA_REWARD_MIN,
  countInPlace,
  isValidGuess,
  omertaCombination,
  omertaReward,
} from './omerta.js';

describe('Шифр Омерты', () => {
  it('двенадцать предметов с уникальными id', () => {
    expect(OMERTA_ITEMS).toHaveLength(12);
    expect(new Set(OMERTA_ITEMS.map((item) => item.id)).size).toBe(12);
  });

  it('комбинация одна на день у всех и без повторов', () => {
    const a = omertaCombination(20_000, 'secret');

    expect(a).toEqual(omertaCombination(20_000, 'secret'));
    expect(a).toHaveLength(OMERTA_LENGTH);
    expect(new Set(a).size).toBe(OMERTA_LENGTH);
    expect(isValidGuess(a)).toBe(true);
  });

  it('меняется день ото дня и зависит от секрета', () => {
    const days = new Set(
      Array.from({ length: 30 }, (_, i) => omertaCombination(20_000 + i, 'secret').join()),
    );

    expect(days.size).toBeGreaterThan(25);
    expect(omertaCombination(20_000, 'other').join()).not.toBe(
      omertaCombination(20_000, 'secret').join(),
    );
  });

  it('первым предметом за месяц встают разные предметы, а не один любимый', () => {
    const firsts = new Set(
      Array.from({ length: 60 }, (_, i) => omertaCombination(i, 'secret')[0]),
    );

    expect(firsts.size).toBeGreaterThan(6);
  });

  it('ответ проверяется строго', () => {
    expect(isValidGuess(['cigar', 'ring', 'duck'])).toBe(false);
    expect(isValidGuess(['cigar', 'cigar', 'duck', 'dice'])).toBe(false);
    expect(isValidGuess(['cigar', 'ring', 'duck', 'nope'])).toBe(false);
    expect(isValidGuess('cigar')).toBe(false);
  });

  it('считает только стоящие на своих местах', () => {
    const answer = ['cigar', 'ring', 'duck', 'dice'];

    expect(countInPlace(answer, answer)).toBe(4);
    expect(countInPlace(['ring', 'cigar', 'duck', 'dice'], answer)).toBe(2);
    expect(countInPlace(['steak', 'bourbon', 'shades', 'payphone'], answer)).toBe(0);
  });

  it('награда не меньше нижней границы', () => {
    expect(omertaReward({ coinsPerTap: 1, energyPerSecond: 1 })).toBe(OMERTA_REWARD_MIN);
  });
});
