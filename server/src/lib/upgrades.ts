import type { User } from '../generated/prisma/client.js';
import { ENERGY_PER_TAP } from './energy.js';

export type UpgradeId = 'tap' | 'energy' | 'regen';

/** Поля пользователя, которые меняет покупка уровня. */
export interface UpgradeEffect {
  coinsPerTap?: number;
  energyMax?: number;
  energyPerSecond?: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  title: string;
  description: string;
  levelField: 'tapLevel' | 'energyLevel' | 'regenLevel';
  maxLevel: number;
  /** Цена перехода с уровня `level` на `level + 1`. */
  price: (level: number) => bigint;
  /** Значения рабочих полей для уровня `level`. */
  valueAt: (level: number) => UpgradeEffect;
  /** Человеческое описание эффекта уровня. */
  describe: (level: number) => string;
}

/**
 * Кривые подобраны симуляцией прогресса, а не на глаз. Правило простое:
 * во что бы игрок ни вкладывался, доход должен расти примерно одинаково —
 * иначе жадный игрок находит одну выгодную ветку, а остальные превращаются
 * в украшение.
 *
 * Прошлая версия ломалась дважды. Во-первых, «Хватка» давала +1 монету за
 * уровень: прибавка линейная, цена экспоненциальная — к десятому уровню
 * ветка обесценивалась, и всё уходило в бизнесы, а тапы переставали влиять
 * на доход вообще. Теперь «Хватка» умножает: +18% за уровень при цене ×1.4.
 * Во-вторых, у веток был потолок в 20 уровней, и вся игра заканчивалась
 * через полторы недели. Потолки подняты так высоко, что упереться в них
 * нельзя — ограничителем работает цена, а не число.
 */

/** Цена уровня: base × growth^level. */
const priceCurve = (base: number, growth: number) => (level: number) =>
  BigInt(Math.round(base * growth ** level));

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'tap',
    title: 'Хватка',
    description: 'Больше монет за один тап',
    levelField: 'tapLevel',
    maxLevel: 60,
    price: priceCurve(1_000, 1.4),
    // Умножение, а не прибавка: только так тап остаётся заметной долей
    // дохода к концу игры, а не превращается в ритуал ради ритуала.
    valueAt: (level) => ({ coinsPerTap: Math.round(10 * 1.18 ** level) }),
    describe: (level) =>
      `${Math.round(10 * 1.18 ** level).toLocaleString('ru-RU')} за тап`,
  },
  {
    id: 'energy',
    title: 'Выносливость',
    description: 'Больше запас — больше можно забрать за один заход',
    levelField: 'energyLevel',
    maxLevel: 60,
    price: priceCurve(1_200, 1.35),
    valueAt: (level) => ({ energyMax: (600 + 100 * level) * ENERGY_PER_TAP }),
    describe: (level) => `${(600 + 100 * level).toLocaleString('ru-RU')} тапов в обойме`,
  },
  {
    id: 'regen',
    title: 'Связи',
    description: 'Обойма восстанавливается быстрее',
    levelField: 'regenLevel',
    maxLevel: 40,
    price: priceCurve(6_000, 1.55),
    valueAt: (level) => ({ energyPerSecond: 1 + level }),
    describe: (level) =>
      `+${((1 + level) * 60) / ENERGY_PER_TAP} тапов в минуту`,
  },
];

/**
 * Стартовые значения — это нулевые уровни всех веток. Держим их здесь, а не
 * в @default схемы: иначе правка баланса требовала бы миграции, и старт
 * новичка расходился бы с каталогом улучшений.
 */
export const START_STATE = {
  coinsPerTap: UPGRADES[0]!.valueAt(0).coinsPerTap!,
  energyMax: UPGRADES[1]!.valueAt(0).energyMax!,
  energy: UPGRADES[1]!.valueAt(0).energyMax!,
  energyPerSecond: UPGRADES[2]!.valueAt(0).energyPerSecond!,
};

export function findUpgrade(id: string): UpgradeDefinition | undefined {
  return UPGRADES.find((upgrade) => upgrade.id === id);
}

export interface UpgradeView {
  id: UpgradeId;
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  /** Что даёт сейчас. */
  current: string;
  /** Что даст после покупки, null — если максимум. */
  next: string | null;
  /** Цена следующего уровня строкой, null — если максимум. */
  price: string | null;
  affordable: boolean;
}

export function describeUpgrades(user: User): UpgradeView[] {
  return UPGRADES.map((upgrade) => {
    const level = user[upgrade.levelField];
    const isMax = level >= upgrade.maxLevel;
    const price = isMax ? null : upgrade.price(level);

    return {
      id: upgrade.id,
      title: upgrade.title,
      description: upgrade.description,
      level,
      maxLevel: upgrade.maxLevel,
      current: upgrade.describe(level),
      next: isMax ? null : upgrade.describe(level + 1),
      price: price === null ? null : price.toString(),
      affordable: price !== null && user.balance >= price,
    };
  });
}
