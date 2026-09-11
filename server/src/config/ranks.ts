/**
 * Ранги игроков и их пороги.
 *
 * Ранг НЕ хранится в базе — он всегда вычисляется из накопленного дохода
 * (totalEarned) функцией resolveRank. Именно из накопленного, а не из текущего
 * баланса: иначе покупка апгрейда или взнос в клан понижали бы ранг, и игрок
 * мог бы потерять доступ к кланам, пожертвовав в общак. Поэтому изменение
 * порогов здесь мгновенно пересчитывает ранги всем игрокам, без миграций и
 * фоновых задач.
 *
 * Рангов шесть, но у каждого три звезды — итого 18 ступеней. Так художник
 * рисует по-прежнему шесть персонажей, а игрок получает повышение каждые
 * один-три дня вместо пустых недель между рангами.
 *
 * Пороги растут ровно втрое. Множитель подобран симуляцией: при нём средний
 * игрок (пять заходов в день) доходит до «Дона ★★★» примерно за 60 дней,
 * казуальный — за 85, самый активный — за 50. Меньший шаг сжимал игру в
 * три недели, больший растягивал сверх полугода.
 */

export type RankId =
  | 'outsider'
  | 'associate'
  | 'soldier'
  | 'capo'
  | 'consigliere'
  | 'don';

/** Сколько звёзд у каждого ранга. */
export const STARS_PER_RANK = 3;

export interface RankDefinition {
  id: RankId;
  /** Латиницей — используется в подписи прогресса. */
  code: string;
  /** Как называется ранг в интерфейсе. */
  title: string;
  /** Звезда внутри ранга: 1..3. */
  star: number;
  /** Сколько DONC нужно заработать за всё время для этой ступени. */
  minBalance: bigint;
  /** Что открывает ступень (показывается в интерфейсе). */
  unlocks?: string;
  /** Доступ к кланам — открывается с «солдата». */
  canJoinClan: boolean;
}

/** Обязательно по возрастанию порога: resolveRank ищет с конца. */
export const RANKS: readonly RankDefinition[] = [
  // ——— Аутсайдер: первый вечер в игре
  { id: 'outsider', code: 'OUTSIDER', title: 'Аутсайдер', star: 1, minBalance: 0n, canJoinClan: false },
  { id: 'outsider', code: 'OUTSIDER', title: 'Аутсайдер', star: 2, minBalance: 8_000n, canJoinClan: false },
  {
    id: 'outsider', code: 'OUTSIDER', title: 'Аутсайдер', star: 3,
    minBalance: 25_000n, unlocks: 'Открыта пиццерия', canJoinClan: false,
  },

  // ——— Приближённый: первая неделя
  {
    id: 'associate', code: 'ASSOCIATE', title: 'Приближённый', star: 1,
    minBalance: 75_000n, unlocks: 'Открыта автомойка', canJoinClan: false,
  },
  {
    id: 'associate', code: 'ASSOCIATE', title: 'Приближённый', star: 2,
    minBalance: 220_000n, unlocks: 'Открыт ломбард', canJoinClan: false,
  },
  {
    id: 'associate', code: 'ASSOCIATE', title: 'Приближённый', star: 3,
    minBalance: 650_000n, unlocks: 'Открыт ресторан', canJoinClan: false,
  },

  // ——— Солдат: здесь открываются кланы и начинается социальная игра
  {
    id: 'soldier', code: 'SOLDIER', title: 'Солдат', star: 1,
    minBalance: 1_950_000n, unlocks: 'Кланы и ночной клуб', canJoinClan: true,
  },
  {
    id: 'soldier', code: 'SOLDIER', title: 'Солдат', star: 2,
    minBalance: 5_800_000n, unlocks: 'Открыто казино', canJoinClan: true,
  },
  {
    id: 'soldier', code: 'SOLDIER', title: 'Солдат', star: 3,
    minBalance: 17_500_000n, unlocks: 'Открыта стройка', canJoinClan: true,
  },

  // ——— Капо
  {
    id: 'capo', code: 'CAPO', title: 'Капо', star: 1,
    minBalance: 52_000_000n, unlocks: 'Открыт профсоюз', canJoinClan: true,
  },
  {
    id: 'capo', code: 'CAPO', title: 'Капо', star: 2,
    minBalance: 157_000_000n, unlocks: 'Открыт закрытый клуб', canJoinClan: true,
  },
  {
    id: 'capo', code: 'CAPO', title: 'Капо', star: 3,
    minBalance: 470_000_000n, unlocks: 'Открыт порт', canJoinClan: true,
  },

  // ——— Консильери
  { id: 'consigliere', code: 'CONSIGLIERE', title: 'Консильери', star: 1, minBalance: 1_400_000_000n, canJoinClan: true },
  {
    id: 'consigliere', code: 'CONSIGLIERE', title: 'Консильери', star: 2,
    minBalance: 4_200_000_000n, unlocks: 'Открыт оффшорный банк', canJoinClan: true,
  },
  { id: 'consigliere', code: 'CONSIGLIERE', title: 'Консильери', star: 3, minBalance: 12_700_000_000n, canJoinClan: true },

  // ——— Дон: последние три ступени — это отдельный месяц игры
  { id: 'don', code: 'DON', title: 'Дон', star: 1, minBalance: 38_000_000_000n, canJoinClan: true },
  { id: 'don', code: 'DON', title: 'Дон', star: 2, minBalance: 115_000_000_000n, canJoinClan: true },
  { id: 'don', code: 'DON', title: 'Дон', star: 3, minBalance: 345_000_000_000n, canJoinClan: true },
];

export interface RankView {
  id: RankId;
  code: string;
  title: string;
  /** Звезда внутри ранга: 1..3. */
  star: number;
  /** Всего звёзд у ранга — чтобы клиент рисовал и погашенные. */
  stars: number;
  /** Порядковый номер ступени, 0..17. Пригодится для разблокировок. */
  step: number;
  canJoinClan: boolean;
  unlocks: string | null;
  /** Порог текущей ступени. */
  minBalance: string;
  /** Следующая ступень или null, если достигнут максимум. */
  next: {
    id: RankId;
    code: string;
    title: string;
    star: number;
    /** Сколько DONC нужно накопить всего. */
    minBalance: string;
  } | null;
}

/** Первая ступень, с которой открываются кланы. */
export function clanRank(): RankDefinition {
  const rank = RANKS.find((item) => item.canJoinClan);

  if (!rank) {
    throw new Error('В конфиге нет ранга с доступом к кланам');
  }

  return rank;
}

/**
 * Номер ступени по накопленному доходу. Идём с конца — первый взятый порог
 * и есть текущая ступень.
 */
export function rankStep(balance: bigint): number {
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (balance >= RANKS[i]!.minBalance) {
      return i;
    }
  }

  return 0;
}

export function resolveRank(balance: bigint): RankView {
  const index = rankStep(balance);
  const current = RANKS[index]!;
  const next = RANKS[index + 1] ?? null;

  return {
    id: current.id,
    code: current.code,
    title: current.title,
    star: current.star,
    stars: STARS_PER_RANK,
    step: index,
    canJoinClan: current.canJoinClan,
    unlocks: current.unlocks ?? null,
    minBalance: current.minBalance.toString(),
    next: next
      ? {
          id: next.id,
          code: next.code,
          title: next.title,
          star: next.star,
          minBalance: next.minBalance.toString(),
        }
      : null,
  };
}

/** Подпись ступени для интерфейса: «Солдат ★★». */
export function rankLabel(step: number): string {
  const rank = RANKS[Math.max(0, Math.min(step, RANKS.length - 1))]!;

  return `${rank.title} ${'★'.repeat(rank.star)}`;
}
