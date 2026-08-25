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

/**
 * Цена растёт в 1.6 раза за уровень.
 *
 * Было ×2, и это ломало прогрессию: польза от уровня растёт линейно, а цена
 * экспоненциально, поэтому окупаемость удваивалась с каждой покупкой и
 * примерно с восьмого уровня апгрейд переставал иметь смысл. Считаем в целых:
 * умножаем на 8 и делим на 5.
 */
const growth = (base: bigint) => (level: number) => {
  let price = base;

  for (let i = 0; i < level; i += 1) {
    price = (price * 8n) / 5n;
  }

  return price;
};

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'tap',
    title: 'Хватка',
    description: 'Больше монет за один тап',
    levelField: 'tapLevel',
    maxLevel: 20,
    price: growth(500n),
    valueAt: (level) => ({ coinsPerTap: 1 + level }),
    describe: (level) => `+${1 + level} за тап`,
  },
  {
    id: 'energy',
    title: 'Выносливость',
    description: 'Больше запас — больше можно забрать за один заход',
    levelField: 'energyLevel',
    maxLevel: 20,
    price: growth(500n),
    valueAt: (level) => ({ energyMax: 1_000 + 2_000 * level }),
    describe: (level) => `${(1_000 + 2_000 * level).toLocaleString('ru-RU')} энергии`,
  },
  {
    id: 'regen',
    title: 'Связи',
    description: 'Энергия восстанавливается быстрее',
    levelField: 'regenLevel',
    maxLevel: 20,
    price: growth(800n),
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
