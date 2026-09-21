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
 * Цена — около десятой доли порога того ранга, которому фон принадлежит.
 *
 * Верхний предел жёсткий и считается, а не выбирается. Баланс никогда не
 * превышает пожизненный заработок (баланс = заработок минус траты), а ранг
 * считается от заработка. Значит цена выше порога недостижима по построению:
 * чтобы её набрать, надо заработать больше порога — а тогда фон уже выдан
 * даром. Первая версия каталога была именно такой, и купить в ней нельзя
 * было ни один фон.
 *
 * Но и подходить к этому пределу незачем, и вот почему. Ранговый фон игрок
 * всё равно получит через день-другой, когда возьмёт ранг. Значит покупка —
 * это плата за «увидеть раньше», а не за «получить». За такое не отдают день
 * дохода: разумный игрок просто подождёт, и витрина будет стоять пустой.
 * Десятая доля порога — цена импульса, а не расчёта.
 *
 * Настоящим стоком это не делает и делать не может: сток — это то, что
 * нельзя получить иначе. Для него нужны фоны, которые не даёт ни один ранг;
 * каталог такие поддерживает (freeFromStep: null), но картинок под них пока
 * нет.
 */

export interface BackdropDefinition {
  id: string;
  title: string;
  description: string;
  /**
   * С какой ступени ранга (0..17) достаётся бесплатно.
   *
   * null — не даёт ни один ранг, только покупка. Такие фоны и есть
   * настоящий сток: их нельзя получить, переждав.
   */
  freeFromStep: number | null;
  /** Сколько стоит до этого. 0 — нельзя купить, только дорасти. */
  price: bigint;
  /** Файл в client/public. */
  file: string;
}

export const BACKDROPS: readonly BackdropDefinition[] = [
  {
    id: 'alley',
    title: 'Свой квартал',
    description: 'Угол, где тебя знают',
    freeFromStep: 0,
    price: 0n,
    file: '/bg-outsider.webp',
  },
  {
    id: 'diner',
    title: 'Лавка',
    description: 'Колбасы на витрине, разговоры у стойки',
    freeFromStep: 3,
    price: 8_000n,
    file: '/bg-associate.webp',
  },
  {
    id: 'pool_hall',
    title: 'Задняя комната',
    description: 'Карты, эспрессо и разговоры не для всех',
    freeFromStep: 6,
    price: 250_000n,
    file: '/bg-soldier.webp',
  },
  {
    id: 'restaurant',
    title: 'Ресторан',
    description: 'Стены умеют молчать',
    freeFromStep: 9,
    price: 7_000_000n,
    file: '/bg-capo.webp',
  },
  {
    id: 'office',
    title: 'Кабинет',
    description: 'Окно во весь город, и город внизу',
    freeFromStep: 12,
    price: 220_000_000n,
    file: '/bg-consigliere.webp',
  },
  /*
   * Фоны вне рангов — единственный настоящий сток в игре.
   *
   * Ранговый фон покупают разве что из нетерпения: через день-другой он
   * достанется даром, и разумный игрок просто ждёт. Эти получить иначе
   * нельзя, поэтому деньги за них исчезают насовсем.
   *
   * Цена — примерно вдвое выше рангового фона того же этапа: заметная
   * трата, но не неделя игры.
   */
  {
    id: 'pool',
    title: 'Бассейн',
    description: 'Сосны, вода и утки, которых никто не звал',
    freeFromStep: null,
    price: 1_200_000n,
    file: '/bg-pool.webp',
  },
  {
    id: 'racetrack',
    title: 'Ложа на ипподроме',
    description: 'Отсюда смотрят, как бегут твои деньги',
    freeFromStep: null,
    price: 45_000_000n,
    file: '/bg-racetrack.webp',
  },
  {
    id: 'villa',
    title: 'Вилла в Италии',
    description: 'Море, лимоны и никакого Ньюарка',
    freeFromStep: null,
    price: 30_000_000_000n,
    file: '/bg-villa.webp',
  },
  {
    id: 'marble_hall',
    title: 'Особняк',
    description: 'Рояль, бар и сад за окном',
    freeFromStep: 15,
    price: 6_500_000_000n,
    file: '/bg-don.webp',
  },
];

export function findBackdrop(id: string): BackdropDefinition | undefined {
  return BACKDROPS.find((backdrop) => backdrop.id === id);
}

/** Фон, положенный игроку по рангу: самый поздний из открытых. */
export function backdropForStep(step: number): BackdropDefinition | undefined {
  return [...BACKDROPS]
    .reverse()
    .find((backdrop) => backdrop.freeFromStep !== null && step >= backdrop.freeFromStep);
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
  /** Подпись ранга, на котором достанется бесплатно, null — не достанется. */
  freeAt: string | null;
}

export function describeBackdrops(
  step: number,
  balance: bigint,
  purchased: readonly string[],
  equipped: string | null,
): BackdropView[] {
  const byRank = backdropForStep(step);

  return BACKDROPS.map((backdrop) => {
    const unlockedByRank =
      backdrop.freeFromStep !== null && step >= backdrop.freeFromStep;
    const owned = unlockedByRank || purchased.includes(backdrop.id);
    const rank = backdrop.freeFromStep === null ? null : RANKS[backdrop.freeFromStep];

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
      freeAt: rank ? `${rank.title} ${'★'.repeat(rank.star)}` : null,
    };
  });
}
