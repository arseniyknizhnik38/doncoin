/**
 * Каталог бизнесов. Отсюда его забирает seed-скрипт, поэтому баланс правится
 * в одном файле, а не в базе руками.
 *
 * Логика баланса — окупаемость:
 *
 *   окупаемость (часы) = baseCost / baseIncomePerHour
 *
 * Она растёт по лестнице с 28 часов у ларька до 65 у оффшора: дешёвые
 * бизнесы выгоднее по вложенному DONC, дорогие берут абсолютом — иначе
 * первый же доступный бизнес обесценивал бы весь остальной каталог.
 *
 * Числа подобраны симуляцией. Прежние 20–37 часов делали пассивный доход
 * настолько выгодным, что тапы переставали влиять на прогресс вовсе: у
 * казуального и у самого активного игрока разница выходила в два дня.
 *
 * Каждая следующая ступень стоит вчетверо дороже предыдущей и открывается
 * своей ступенью ранга (BUSINESS_RANK_GATE): повышение перестаёт быть
 * надписью и становится ключом от новой строчки в каталоге.
 *
 * Внутри одного бизнеса цена уровня растёт как baseCost × 1.4^level, а доход
 * — линейно. Значит каждый следующий уровень окупается на 40% дольше:
 * качать вглубь можно бесконечно, но выгодным это быть перестаёт, и деньги
 * приходится нести в следующий бизнес.
 */

export interface BusinessSeed {
  slug: string;
  name: string;
  description: string;
  category: string;
  baseCost: bigint;
  baseIncomePerHour: bigint;
  costMultiplier: number;
  sortOrder: number;
}

export const BUSINESS_CATALOG: readonly BusinessSeed[] = [
  {
    slug: 'street_food',
    name: 'Ларёк с шаурмой',
    description: 'Три квадратных метра и очередь до ночи',
    category: 'Общепит',
    baseCost: 5_000n,
    baseIncomePerHour: 180n,
    costMultiplier: 1.4,
    sortOrder: 1,
  },
  {
    slug: 'pizzeria',
    name: 'Пиццерия',
    description: 'Маленькая точка на углу. С неё начинают все',
    category: 'Общепит',
    baseCost: 20_000n,
    baseIncomePerHour: 640n,
    costMultiplier: 1.4,
    sortOrder: 2,
  },
  {
    slug: 'car_wash',
    name: 'Автомойка',
    description: 'Наличные каждый день и никаких вопросов',
    category: 'Услуги',
    baseCost: 80_000n,
    baseIncomePerHour: 2_300n,
    costMultiplier: 1.4,
    sortOrder: 3,
  },
  {
    slug: 'pawnshop',
    name: 'Ломбард',
    description: 'Люди приносят последнее. Мы даём половину',
    category: 'Финансы',
    baseCost: 320_000n,
    baseIncomePerHour: 8_400n,
    costMultiplier: 1.4,
    sortOrder: 4,
  },
  {
    slug: 'restaurant',
    name: 'Ресторан',
    description: 'Место для встреч, где стены умеют молчать',
    category: 'Общепит',
    baseCost: 1_300_000n,
    baseIncomePerHour: 31_000n,
    costMultiplier: 1.4,
    sortOrder: 5,
  },
  {
    slug: 'night_club',
    name: 'Ночной клуб',
    description: 'Музыка громкая, выручка ещё громче',
    category: 'Развлечения',
    baseCost: 5_000_000n,
    baseIncomePerHour: 112_000n,
    costMultiplier: 1.4,
    sortOrder: 6,
  },
  {
    slug: 'casino',
    name: 'Казино',
    description: 'Единственный игрок, который здесь не проигрывает, — хозяин',
    category: 'Развлечения',
    baseCost: 20_000_000n,
    baseIncomePerHour: 415_000n,
    costMultiplier: 1.4,
    sortOrder: 7,
  },
  {
    slug: 'construction',
    name: 'Строительная компания',
    description: 'Городские подряды и очень длинные сметы',
    category: 'Промышленность',
    baseCost: 80_000_000n,
    baseIncomePerHour: 1_550_000n,
    costMultiplier: 1.4,
    sortOrder: 8,
  },
  {
    slug: 'union',
    name: 'Профсоюз докеров',
    description: 'Кто держит профсоюз, тот держит город',
    category: 'Влияние',
    baseCost: 320_000_000n,
    baseIncomePerHour: 5_800_000n,
    costMultiplier: 1.4,
    sortOrder: 9,
  },
  {
    slug: 'private_club',
    name: 'Закрытый клуб',
    description: 'Вход по знакомству. Здесь решают, а не отдыхают',
    category: 'Влияние',
    baseCost: 1_300_000_000n,
    baseIncomePerHour: 22_300_000n,
    costMultiplier: 1.4,
    sortOrder: 10,
  },
  {
    slug: 'port',
    name: 'Портовый бизнес',
    description: 'Контейнеры приходят и уходят. Вопросов никто не задаёт',
    category: 'Логистика',
    baseCost: 5_000_000_000n,
    baseIncomePerHour: 81_000_000n,
    costMultiplier: 1.4,
    sortOrder: 11,
  },
  {
    slug: 'offshore',
    name: 'Оффшорный банк',
    description: 'Остров, флаг и счета, которых не существует',
    category: 'Финансы',
    baseCost: 20_000_000_000n,
    baseIncomePerHour: 308_000_000n,
    costMultiplier: 1.4,
    sortOrder: 12,
  },
];

/**
 * С какой ступени ранга (0..17, см. config/ranks.ts) открывается бизнес.
 *
 * Гейт живёт в коде, а не в колонке таблицы: пороги — часть баланса, и
 * менять их правкой конфига без миграции удобнее, чем через базу.
 */
export const BUSINESS_RANK_GATE: Readonly<Record<string, number>> = {
  street_food: 0,
  pizzeria: 2,
  car_wash: 3,
  pawnshop: 4,
  restaurant: 5,
  night_club: 6,
  casino: 7,
  construction: 8,
  union: 9,
  private_club: 10,
  port: 11,
  offshore: 13,
};

export function requiredRankStep(slug: string): number {
  return BUSINESS_RANK_GATE[slug] ?? 0;
}

/**
 * Сколько часов бизнесы копят доход, пока игрок не зашёл.
 *
 * Потолок — единственное, что делает активность осмысленной. Без него
 * доход капает круглосуточно, и человек, заходящий раз в сутки, идёт вровень
 * с тем, кто заходит пять раз; симуляция давала разницу в два дня на всю
 * игру. С потолком в четыре часа заходить несколько раз в день выгодно
 * ровно настолько, чтобы это стало привычкой, но пропущенный день не
 * обнуляет накопленное.
 */
export const COLLECT_CAP_HOURS = 4;

/** Цена перехода с уровня `level` на `level + 1`. */
export function levelCost(
  business: { baseCost: bigint; costMultiplier: number },
  level: number,
): bigint {
  const multiplier = business.costMultiplier ** level;

  return BigInt(Math.round(Number(business.baseCost) * multiplier));
}

/** Доход бизнеса в час на уровне `level`. */
export function levelIncome(
  business: { baseIncomePerHour: bigint },
  level: number,
): bigint {
  return business.baseIncomePerHour * BigInt(level);
}
