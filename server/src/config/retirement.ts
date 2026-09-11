import { RANKS } from './ranks.js';

/**
 * Уход на покой — ответ на вопрос «а что дальше».
 *
 * Дойдя до последней ступени, игрок упирается в стену: качать больше нечего,
 * ранга выше нет, и через день-два он уходит навсегда. Уход на покой
 * обнуляет нажитое и возвращает в начало, но даёт постоянную прибавку к
 * доходу — то есть второй круг короче первого, третий короче второго.
 *
 * Что остаётся при уходе: Respect и купленные за него перки, клан, друзья,
 * пожизненный заработок (по нему считается лидерборд) и, разумеется, сам
 * счётчик уходов. Обнуляется то, что можно нажить заново: баланс, накопленный
 * заработок, уровни улучшений и бизнесы.
 */

/** Прибавка к доходу за каждый уход, в процентах. */
export const RETIREMENT_BONUS_PERCENT = 10;

/** Со скольких уходов прибавка перестаёт расти. */
export const MAX_RETIREMENTS = 10;

/** Ступень, с которой открывается уход. */
export const RETIREMENT_STEP = RANKS.length - 1;

export function retirementBonus(retirements: number): number {
  return Math.min(retirements, MAX_RETIREMENTS) * RETIREMENT_BONUS_PERCENT;
}

/** Титул, который остаётся с игроком после ухода. */
export function retirementTitle(retirements: number): string | null {
  if (retirements <= 0) {
    return null;
  }

  return retirements === 1 ? 'Дон в отставке' : `Дон в отставке ×${retirements}`;
}

export interface RetirementView {
  /** Сколько кругов уже пройдено. */
  count: number;
  /** Текущая постоянная прибавка к доходу, в процентах. */
  bonus: number;
  /** Какой она станет после следующего ухода. */
  nextBonus: number;
  /** Можно уйти прямо сейчас. */
  available: boolean;
  /** Сколько ещё нужно заработать до возможности уйти. */
  remaining: string;
  title: string | null;
}

export function describeRetirement(
  retirements: number,
  totalEarned: bigint,
): RetirementView {
  const required = RANKS[RETIREMENT_STEP]!.minBalance;

  return {
    count: retirements,
    bonus: retirementBonus(retirements),
    nextBonus: retirementBonus(retirements + 1),
    available: totalEarned >= required,
    remaining: (required > totalEarned ? required - totalEarned : 0n).toString(),
    title: retirementTitle(retirements),
  };
}
