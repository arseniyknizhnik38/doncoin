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
    name: 'Сигара с особняка дона',
    description: 'Из хьюмидора самого. Такие не покупают — такие заслуживают. Сто на всю игру, больше не будет.',
    icon: 'cigar',
    rarity: 'common',
    supply: 100,
  },
  {
    id: 'dice',
    name: 'Кости из задней комнаты',
    description: 'Тридцать лет катали в подсобке клуба. Чуть тяжелее с одной стороны — все знают, никто не докажет.',
    icon: 'dice',
    rarity: 'common',
    supply: 100,
  },
  {
    id: 'shades',
    name: 'Очки с похорон',
    description: 'Их надевают на похороны и на допросы. Не видно глаз — это и есть их работа.',
    icon: 'shades',
    rarity: 'rare',
    supply: 40,
  },
  {
    id: 'car_keys',
    name: 'Ключи от седана с тонировкой',
    description: 'Салон пахнет кожей и чужими секретами. Номера лучше не пробивать.',
    icon: 'car_keys',
    rarity: 'rare',
    supply: 25,
  },
  {
    id: 'revolver',
    name: 'Револьвер с посвящения',
    description: 'Лежал на столе, когда давали клятву. Ни разу не стрелял — хватало того, что он есть.',
    icon: 'revolver',
    rarity: 'epic',
    supply: 10,
  },
  {
    id: 'ring',
    name: 'Перстень дона',
    description: 'Его целуют, когда просят. Один на всю историю — второго не выпустят.',
    icon: 'ring',
    rarity: 'legendary',
    supply: 1,
  },
];
