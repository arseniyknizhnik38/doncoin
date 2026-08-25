/**
 * Ранги игроков и их пороги.
 *
 * Ранг НЕ хранится в базе — он всегда вычисляется из текущего баланса
 * функцией resolveRank. Поэтому изменение порогов здесь мгновенно
 * пересчитывает ранги всем игрокам, без миграций и фоновых задач.
 */

export type RankId =
  | 'outsider'
  | 'associate'
  | 'soldier'
  | 'capo'
  | 'consigliere'
  | 'don';

export interface RankDefinition {
  id: RankId;
  /** Латиницей — используется в подписи прогресса. */
  code: string;
  /** Как называется ранг в интерфейсе. */
  title: string;
  /** Минимальный баланс DONC для этого ранга. */
  minBalance: bigint;
  /** Что открывает ранг (показывается в интерфейсе). */
  unlocks?: string;
  /** Доступ к кланам — открывается с «солдата». */
  canJoinClan: boolean;
}

/** Обязательно по возрастанию порога: resolveRank ищет с конца. */
export const RANKS: readonly RankDefinition[] = [
  {
    id: 'outsider',
    code: 'OUTSIDER',
    title: 'Аутсайдер',
    minBalance: 0n,
    canJoinClan: false,
  },
  {
    id: 'associate',
    code: 'ASSOCIATE',
    title: 'Приближённый',
    minBalance: 200_000n,
    canJoinClan: false,
  },
  {
    id: 'soldier',
    code: 'SOLDIER',
    title: 'Солдат',
    minBalance: 500_000n,
    unlocks: 'Можно вступать в кланы',
    canJoinClan: true,
  },
  {
    id: 'capo',
    code: 'CAPO',
    title: 'Капо',
    minBalance: 5_000_000n,
    canJoinClan: true,
  },
  {
    id: 'consigliere',
    code: 'CONSIGLIERE',
    title: 'Консильери',
    minBalance: 10_000_000n,
    canJoinClan: true,
  },
  {
    id: 'don',
    code: 'DON',
    title: 'Дон',
    minBalance: 16_000_000n,
    canJoinClan: true,
  },
];

export interface RankView {
  id: RankId;
  code: string;
  title: string;
  canJoinClan: boolean;
  unlocks: string | null;
  /** Порог текущего ранга. */
  minBalance: string;
  /** Следующий ранг или null, если достигнут максимум. */
  next: {
    id: RankId;
    code: string;
    title: string;
    /** Сколько DONC нужно накопить всего. */
    minBalance: string;
  } | null;
}

/** Первый ранг, с которого открываются кланы. */
export function clanRank(): RankDefinition {
  const rank = RANKS.find((item) => item.canJoinClan);

  if (!rank) {
    throw new Error('В конфиге нет ранга с доступом к кланам');
  }

  return rank;
}

/**
 * Определяет ранг по балансу. Идём с конца — первый порог, который взят,
 * и есть текущий ранг.
 */
export function resolveRank(balance: bigint): RankView {
  let index = 0;

  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (balance >= RANKS[i]!.minBalance) {
      index = i;
      break;
    }
  }

  const current = RANKS[index]!;
  const next = RANKS[index + 1] ?? null;

  return {
    id: current.id,
    code: current.code,
    title: current.title,
    canJoinClan: current.canJoinClan,
    unlocks: current.unlocks ?? null,
    minBalance: current.minBalance.toString(),
    next: next
      ? {
          id: next.id,
          code: next.code,
          title: next.title,
          minBalance: next.minBalance.toString(),
        }
      : null,
  };
}
