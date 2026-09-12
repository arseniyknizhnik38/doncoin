import { RANKS } from './ranks.js';

/**
 * Фоны — обстановка за спиной персонажа.
 *
 * Каждый ранг открывает свой бесплатно: это и есть сигнал роста, ради него
 * фоны и заводились. Остальные можно купить за монеты — и в этом вторая,
 * не менее важная причина.
 *
 * До сих пор в игре не было ни одной траты, которая не возвращает деньги:
 * улучшения, бизнесы и перки увеличивают доход, поэтому чем дальше, тем
 * быстрее баланс растёт и тем меньше находится, на что его деть. Фоны —
 * первый настоящий сток: монеты исчезают насовсем, доход не меняется, зато
 * остаётся то, что видно на экране каждый заход.
 *
 * Цена — примерно полтора порога того ранга, которому фон принадлежит.
 * Значит купить его раньше срока можно, но это осознанная жертва: те же
 * деньги, вложенные в бизнес, работали бы дальше.
 */

export interface BackdropDefinition {
  id: string;
  title: string;
  description: string;
  /** С какой ступени ранга (0..17) достаётся бесплатно. */
  freeFromStep: number;
  /** Сколько стоит до этого. 0 — нельзя купить, только дорасти. */
  price: bigint;
  /** Файл в client/public. */
  file: string;
}

export const BACKDROPS: readonly BackdropDefinition[] = [
  {
    id: 'alley',
    title: 'Подворотня',
    description: 'Где всё начиналось',
    freeFromStep: 0,
    price: 0n,
    file: '/bg-outsider.webp',
  },
  {
    id: 'diner',
    title: 'Закусочная',
    description: 'Столик у окна и свои люди за стойкой',
    freeFromStep: 3,
    price: 150_000n,
    file: '/bg-associate.webp',
  },
  {
    id: 'pool_hall',
    title: 'Бильярдная',
    description: 'Здесь решают, кому что достанется',
    freeFromStep: 6,
    price: 4_000_000n,
    file: '/bg-soldier.webp',
  },
  {
    id: 'restaurant',
    title: 'Ресторан',
    description: 'Стены умеют молчать',
    freeFromStep: 9,
    price: 120_000_000n,
    file: '/bg-capo.webp',
  },
  {
    id: 'office',
    title: 'Кабинет',
    description: 'Окно во весь город, и город внизу',
    freeFromStep: 12,
    price: 3_500_000_000n,
    file: '/bg-consigliere.webp',
  },
  {
    id: 'marble_hall',
    title: 'Мраморный зал',
    description: 'Сюда приходят просить',
    freeFromStep: 15,
    price: 100_000_000_000n,
    file: '/bg-don.webp',
  },
];

export function findBackdrop(id: string): BackdropDefinition | undefined {
  return BACKDROPS.find((backdrop) => backdrop.id === id);
}

/** Фон, положенный игроку по рангу: самый поздний из открытых. */
export function backdropForStep(step: number): BackdropDefinition | undefined {
  return [...BACKDROPS].reverse().find((backdrop) => step >= backdrop.freeFromStep);
}

export interface BackdropView {
  id: string;
  title: string;
  description: string;
  file: string;
  /** Достался по рангу или куплен. */
  owned: boolean;
  /** Открылся рангом, а не покупкой — это показываем отдельно. */
  byRank: boolean;
  /** Цена, null — если уже есть или купить нельзя. */
  price: string | null;
  affordable: boolean;
  equipped: boolean;
  /** Подпись ранга, на котором достанется бесплатно. */
  freeAt: string;
}

export function describeBackdrops(
  step: number,
  balance: bigint,
  purchased: readonly string[],
  equipped: string | null,
): BackdropView[] {
  const byRank = backdropForStep(step);

  return BACKDROPS.map((backdrop) => {
    const unlockedByRank = step >= backdrop.freeFromStep;
    const owned = unlockedByRank || purchased.includes(backdrop.id);
    const rank = RANKS[backdrop.freeFromStep];

    return {
      id: backdrop.id,
      title: backdrop.title,
      description: backdrop.description,
      file: backdrop.file,
      owned,
      byRank: unlockedByRank,
      price: owned || backdrop.price === 0n ? null : backdrop.price.toString(),
      affordable: !owned && backdrop.price > 0n && balance >= backdrop.price,
      // Ничего не выбрано — стоит тот, что положен по рангу.
      equipped: equipped === null ? backdrop.id === byRank?.id : equipped === backdrop.id,
      freeAt: rank ? `${rank.title} ${'★'.repeat(rank.star)}` : '',
    };
  });
}
