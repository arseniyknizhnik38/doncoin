import type { User } from '../generated/prisma/client.js';

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

/** Цена растёт вдвое с каждым уровнем. */
const doubling = (base: bigint) => (level: number) => base * 2n ** BigInt(level);

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'tap',
    title: 'Хватка',
    description: 'Больше монет за один тап',
    levelField: 'tapLevel',
    maxLevel: 20,
    price: doubling(1_000n),
    valueAt: (level) => ({ coinsPerTap: 1 + level }),
    describe: (level) => `+${1 + level} за тап`,
  },
  {
    id: 'energy',
    title: 'Выносливость',
    description: 'Больше запас энергии',
    levelField: 'energyLevel',
    maxLevel: 20,
    price: doubling(800n),
    valueAt: (level) => ({ energyMax: 1_000 + 500 * level }),
    describe: (level) => `${1_000 + 500 * level} энергии`,
  },
  {
    id: 'regen',
    title: 'Связи',
    description: 'Энергия восстанавливается быстрее',
    levelField: 'regenLevel',
    maxLevel: 20,
    price: doubling(1_500n),
    valueAt: (level) => ({ energyPerSecond: 1 + level }),
    describe: (level) => `+${1 + level} энергии в секунду`,
  },
];

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
