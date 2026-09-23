/**
 * Генезис-коллекция «вещей семьи».
 *
 * Первая и единственная серия предметов, которые не продаются в игре —
 * только разыгрываются. Ценность вещи — редкость и место в истории семьи:
 * серийный номер фиксируется навсегда, тираж после запуска не допечатывается.
 * Никакой доходности вещи не обещают — и в текстах её обещать нельзя.
 *
 * Иконки — уже нарисованные пиксельные предметы из client/public/icons:
 * коллекция выглядит как сама игра, а не как приклеенный сбоку арт.
 */

export type NftRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface NftCatalogItem {
  id: string;
  name: string;
  description: string;
  /** Идентификатор рисунка PixelIcon. */
  icon: string;
  rarity: NftRarity;
  /** Полный тираж серии. */
  supply: number;
}

export const NFT_CATALOG: NftCatalogItem[] = [
  {
    id: 'cigar',
    name: 'Сигара с виллы',
    description: 'Из личного хьюмидора. Таких сто на всю игру — и больше не будет.',
    icon: 'cigar',
    rarity: 'common',
    supply: 100,
  },
  {
    id: 'dice',
    name: 'Кости квартала',
    description: 'Слегка тяжелее с одной стороны. Все знают, никто не докажет.',
    icon: 'dice',
    rarity: 'common',
    supply: 100,
  },
  {
    id: 'shades',
    name: 'Очки смотрящего',
    description: 'В них не видно глаз. Это и есть их работа.',
    icon: 'shades',
    rarity: 'rare',
    supply: 40,
  },
  {
    id: 'car_keys',
    name: 'Ключи от чёрного седана',
    description: 'Машину не дадут. Но ключи — уже разговор.',
    icon: 'car_keys',
    rarity: 'rare',
    supply: 25,
  },
  {
    id: 'revolver',
    name: 'Револьвер солдата',
    description: 'Ни разу не стрелял. Хватало того, что он есть.',
    icon: 'revolver',
    rarity: 'epic',
    supply: 10,
  },
  {
    id: 'ring',
    name: 'Перстень дона',
    description: 'Один. На всю игру, на всю её историю. Второго не выпустят.',
    icon: 'ring',
    rarity: 'legendary',
    supply: 1,
  },
];
