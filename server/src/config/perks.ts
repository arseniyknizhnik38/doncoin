import type { User } from '../generated/prisma/client.js';

/**
 * Траты Respect и сила семьи — две системы, которые дают постоянные прибавки
 * к доходу. Собраны в одном файле, потому что вместе определяют потолок
 * прогресса и правятся тоже вместе.
 *
 * Respect сам по себе не тратится: он копится за тапы и отражает вложенный
 * труд. Расходуется «доступный остаток» — respect минус уже потраченное.
 */

export type PerkId = 'street' | 'business' | 'family';

export interface PerkDefinition {
  id: PerkId;
  title: string;
  description: string;
  levelField: 'respectStreetLevel' | 'respectBusinessLevel' | 'respectFamilyLevel';
  maxLevel: number;
  /** Прибавка к доходу за уровень, в процентах. */
  bonusPerLevel: number;
  /** Цена уровня в Respect. */
  cost: (level: number) => number;
}

/** Цена растёт в 1.6 раза — как и у обычных улучшений. */
const growth = (base: number) => (level: number) => Math.round(base * 1.6 ** level);

export const PERKS: readonly PerkDefinition[] = [
  {
    id: 'street',
    title: 'Слава на улице',
    description: 'Больше монет за каждый тап',
    levelField: 'respectStreetLevel',
    maxLevel: 10,
    bonusPerLevel: 5,
    cost: growth(10),
  },
  {
    id: 'business',
    title: 'Деловая хватка',
    description: 'Больше дохода с бизнесов',
    levelField: 'respectBusinessLevel',
    maxLevel: 10,
    bonusPerLevel: 5,
    cost: growth(12),
  },
  {
    id: 'family',
    title: 'Связи в семье',
    description: 'Больше дохода, пока вас нет',
    levelField: 'respectFamilyLevel',
    maxLevel: 10,
    bonusPerLevel: 5,
    cost: growth(8),
  },
];

export function findPerk(id: string): PerkDefinition | undefined {
  return PERKS.find((perk) => perk.id === id);
}

/** Сколько Respect ещё можно потратить. */
export function availableRespect(user: Pick<User, 'respect' | 'respectSpent'>): number {
  return Math.max(0, user.respect - user.respectSpent);
}

export interface PerkView {
  id: PerkId;
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  /** Текущая прибавка в процентах. */
  bonus: number;
  nextBonus: number | null;
  cost: number | null;
  affordable: boolean;
}

export function describePerks(user: User): PerkView[] {
  const available = availableRespect(user);

  return PERKS.map((perk) => {
    const level = user[perk.levelField];
    const isMax = level >= perk.maxLevel;
    const cost = isMax ? null : perk.cost(level);

    return {
      id: perk.id,
      title: perk.title,
      description: perk.description,
      level,
      maxLevel: perk.maxLevel,
      bonus: level * perk.bonusPerLevel,
      nextBonus: isMax ? null : (level + 1) * perk.bonusPerLevel,
      cost,
      affordable: cost !== null && available >= cost,
    };
  });
}

/**
 * Сила семьи: деньги в общаке плюс выполненные поручения. Услуги считаются
 * дороже своей номинальной цены — иначе клан прокачивался бы только взносами
 * богатых, а вклад обычных игроков ничего не значил бы.
 */
export const FAMILY_XP_WEIGHT = 5_000n;

/** Пороги силы для уровней клана. */
export const CLAN_LEVEL_THRESHOLDS: readonly bigint[] = [
  100_000n,
  500_000n,
  2_000_000n,
  10_000_000n,
  50_000_000n,
];

/** Прибавка к пассивному доходу участников за каждый уровень клана. */
export const CLAN_BONUS_PER_LEVEL = 3;

export function clanPower(clan: { treasury: bigint; familyXp: number }): bigint {
  return clan.treasury + BigInt(clan.familyXp) * FAMILY_XP_WEIGHT;
}

export function clanLevel(clan: { treasury: bigint; familyXp: number }): number {
  const power = clanPower(clan);
  let level = 0;

  for (const threshold of CLAN_LEVEL_THRESHOLDS) {
    if (power >= threshold) {
      level += 1;
    }
  }

  return level;
}

/** Прибавка клана к пассивному доходу, в процентах. */
export function clanBonusPercent(
  clan: { treasury: bigint; familyXp: number } | null,
): number {
  return clan ? clanLevel(clan) * CLAN_BONUS_PER_LEVEL : 0;
}

/** Общий множитель дохода в процентах: 100 = без изменений. */
export function incomeMultiplier(base: number, ...bonuses: number[]): number {
  return base + bonuses.reduce((sum, bonus) => sum + bonus, 0);
}

/** Применяет процентную прибавку к сумме. */
export function applyBonus(amount: bigint, percent: number): bigint {
  return (amount * BigInt(100 + percent)) / 100n;
}
