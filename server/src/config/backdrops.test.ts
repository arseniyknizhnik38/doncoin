import { describe, expect, it } from 'vitest';
import {
  BACKDROPS,
  backdropForStep,
  describeBackdrops,
  effectiveBackdrop,
  findBackdrop,
} from './backdrops.js';
import { RANKS } from './ranks.js';

describe('каталог фонов', () => {
  it('покрывает все шесть рангов и не пропускает ступеней', () => {
    // Фоны вне рангов в каталоге тоже лежат, поэтому сравниваем не весь
    // список, а только те, которые ранг действительно выдаёт.
    const steps = BACKDROPS.map((backdrop) => backdrop.freeFromStep).filter(
      (step) => step !== null,
    );

    expect(steps).toEqual([0, 3, 6, 9, 12, 15]);
    // Каждый порог — первая звезда своего ранга: фон меняется вместе с
    // персонажем, а не в середине ранга.
    steps.forEach((step) => expect(RANKS[step!]?.star).toBe(1));
  });

  it('ранговые фоны идут по возрастанию цены', () => {
    const prices = BACKDROPS.filter((backdrop) => backdrop.freeFromStep !== null).map(
      (backdrop) => backdrop.price,
    );

    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]!);
    }
  });

  it('фон вне рангов дороже рангового своего этапа — иначе он не сток', () => {
    // Ранговый фон всё равно достанется даром, поэтому платят за него из
    // нетерпения. За фон, которого не даёт никто, платят по-настоящему, и
    // стоить он должен заметно дороже — иначе деньги из игры не уходят.
    for (const backdrop of BACKDROPS) {
      if (backdrop.freeFromStep !== null) {
        continue;
      }

      const cheaperByRank = BACKDROPS.filter(
        (other) => other.freeFromStep !== null && other.price < backdrop.price,
      );

      expect(
        cheaperByRank.length,
        `«${backdrop.title}» дешевле всех ранговых — покупать его незачем`,
      ).toBeGreaterThan(0);
    }
  });

  it('первый фон бесплатен и купить его нельзя', () => {
    expect(BACKDROPS[0]!.freeFromStep).toBe(0);
    expect(BACKDROPS[0]!.price).toBe(0n);
  });

  it('цена ниже порога своего ранга — иначе купить нельзя в принципе', () => {
    // Баланс никогда не превышает пожизненный заработок, а ранг считается от
    // заработка. Значит цена выше порога недостижима по построению: набрав
    // её, игрок уже получил бы фон даром.
    //
    // Первая версия каталога была именно такой — все пять платных фонов
    // оказались мёртвым грузом, и заметно это стало только на глаз.
    for (const backdrop of BACKDROPS) {
      if (backdrop.price === 0n) {
        continue;
      }

      // Фон вне рангов сравнивать не с чем: его нельзя получить, переждав.
      if (backdrop.freeFromStep === null) {
        continue;
      }

      const threshold = RANKS[backdrop.freeFromStep]!.minBalance;

      expect(
        backdrop.price,
        `«${backdrop.title}» стоит дороже порога своего ранга — купить нельзя`,
      ).toBeLessThan(threshold);
    }
  });

  it('ранговый фон стоит около десятой доли порога', () => {
    // Верхняя граница — чтобы покупка была возможна (см. выше). Нижняя —
    // чтобы цена не выглядела случайной.
    //
    // Ровно десятая доля выбрана не из жадности: ранговый фон игрок всё
    // равно получит через день-другой, то есть платит он за «увидеть
    // раньше». За это не отдают день дохода — разумный игрок подождёт, и
    // витрина будет стоять пустой.
    for (const backdrop of BACKDROPS) {
      if (backdrop.price === 0n || backdrop.freeFromStep === null) {
        continue;
      }

      const threshold = RANKS[backdrop.freeFromStep]!.minBalance;

      expect(backdrop.price * 20n).toBeGreaterThan(threshold);
      expect(backdrop.price * 5n).toBeLessThan(threshold);
    }
  });
});

describe('что положено по рангу', () => {
  it('даёт самый поздний из открытых', () => {
    expect(backdropForStep(0)?.id).toBe('alley');
    expect(backdropForStep(2)?.id).toBe('alley');
    expect(backdropForStep(3)?.id).toBe('diner');
    expect(backdropForStep(8)?.id).toBe('pool_hall');
    expect(backdropForStep(17)?.id).toBe('marble_hall');
  });
});

describe('витрина', () => {
  it('свой фон отдаёт даром, чужой — за деньги', () => {
    const views = describeBackdrops(3, 1_000_000n, [], null);
    const diner = views.find((view) => view.id === 'diner')!;
    const hall = views.find((view) => view.id === 'marble_hall')!;

    expect(diner.owned).toBe(true);
    expect(diner.byRank).toBe(true);
    expect(diner.price).toBeNull();

    expect(hall.owned).toBe(false);
    expect(hall.price).not.toBeNull();
  });

  it('купленный засчитывается, но не выдаёт себя за ранговый', () => {
    const views = describeBackdrops(0, 0n, ['restaurant'], null);
    const restaurant = views.find((view) => view.id === 'restaurant')!;

    expect(restaurant.owned).toBe(true);
    // Важно для интерфейса: у купленного не должно быть подписи «достался
    // по рангу», иначе игрок решит, что заплатил зря.
    expect(restaurant.byRank).toBe(false);
    expect(restaurant.price).toBeNull();
  });

  it('без выбора показывает ранговый', () => {
    const views = describeBackdrops(6, 0n, [], null);

    expect(views.find((view) => view.equipped)?.id).toBe('pool_hall');
  });

  it('выбор игрока важнее ранга, пока ранг не вырос', () => {
    const views = describeBackdrops(6, 0n, [], 'pool_hall');

    expect(views.find((view) => view.equipped)?.id).toBe('pool_hall');
  });

  it('повышение переселяет из прежней комнаты', () => {
    // Без этого фоны переставали показывать рост: один раз выбранная
    // подворотня оставалась на экране и у Капо, и у Дона.
    expect(effectiveBackdrop(9, 'alley')?.id).toBe('restaurant');
    expect(effectiveBackdrop(17, 'diner')?.id).toBe('marble_hall');

    const views = describeBackdrops(9, 0n, [], 'alley');

    expect(views.find((view) => view.equipped)?.id).toBe('restaurant');
  });

  it('купленный фон повышение не снимает', () => {
    // За него заплачено, и ранг тут ни при чём — иначе покупка обнулялась бы
    // на следующем повышении.
    expect(effectiveBackdrop(17, 'pool')?.id).toBe('pool');
    expect(effectiveBackdrop(17, 'villa')?.id).toBe('villa');
  });

  it('по карману считает от баланса, а не от ранга', () => {
    const price = findBackdrop('pool_hall')!.price;
    const rich = describeBackdrops(0, price, [], null);
    const poor = describeBackdrops(0, price - 1n, [], null);

    expect(rich.find((view) => view.id === 'pool_hall')?.affordable).toBe(true);
    expect(poor.find((view) => view.id === 'pool_hall')?.affordable).toBe(false);
  });

  it('не предлагает купить то, что уже есть', () => {
    // На высшем ранге даром достались все ранговые фоны — но не те, которых
    // ранг не даёт: они и на вершине покупаются за деньги.
    const views = describeBackdrops(17, 0n, [], null).filter(
      (view) => findBackdrop(view.id)!.freeFromStep !== null,
    );

    expect(views.every((view) => view.owned && view.price === null)).toBe(true);
    expect(views.every((view) => !view.affordable)).toBe(true);
  });

  it('фон вне рангов даром не достаётся даже Дону', () => {
    const views = describeBackdrops(17, 0n, [], null);
    const pool = views.find((view) => view.id === 'pool')!;

    expect(pool.owned).toBe(false);
    expect(pool.byRank).toBe(false);
    expect(pool.freeAt).toBeNull();
    expect(pool.price).not.toBeNull();
  });
});
