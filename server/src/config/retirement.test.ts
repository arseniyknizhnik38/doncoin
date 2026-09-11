import { describe, expect, it } from 'vitest';
import { RANKS } from './ranks.js';
import {
  MAX_RETIREMENTS,
  RETIREMENT_STEP,
  describeRetirement,
  retirementBonus,
  retirementTitle,
} from './retirement.js';

describe('прибавка за круги', () => {
  it('растёт с каждым уходом', () => {
    expect(retirementBonus(1)).toBeGreaterThan(retirementBonus(0));
    expect(retirementBonus(3)).toBeGreaterThan(retirementBonus(2));
  });

  it('у новичка её нет', () => {
    expect(retirementBonus(0)).toBe(0);
  });

  it('упирается в потолок — иначе десятый круг ломает экономику', () => {
    expect(retirementBonus(MAX_RETIREMENTS + 5)).toBe(retirementBonus(MAX_RETIREMENTS));
  });
});

describe('титул', () => {
  it('появляется только после первого круга', () => {
    expect(retirementTitle(0)).toBeNull();
    expect(retirementTitle(1)).toBeTruthy();
  });

  it('считает круги, начиная со второго', () => {
    expect(retirementTitle(3)).toContain('3');
  });
});

describe('право уйти на покой', () => {
  const required = RANKS[RETIREMENT_STEP]!.minBalance;

  it('открывается ровно на последней ступени', () => {
    expect(RETIREMENT_STEP).toBe(RANKS.length - 1);
    expect(describeRetirement(0, required).available).toBe(true);
    expect(describeRetirement(0, required - 1n).available).toBe(false);
  });

  it('показывает, сколько осталось', () => {
    expect(describeRetirement(0, required - 1_000n).remaining).toBe('1000');
  });

  it('на последней ступени не просит ничего доработать', () => {
    expect(describeRetirement(0, required * 2n).remaining).toBe('0');
  });

  it('обещает прибавку больше текущей', () => {
    const view = describeRetirement(2, required);

    expect(view.nextBonus).toBeGreaterThan(view.bonus);
  });
});
