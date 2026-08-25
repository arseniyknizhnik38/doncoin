/**
 * Каталог бизнесов. Отсюда его забирает seed-скрипт, поэтому баланс правится
 * в одном файле, а не в базе руками.
 *
 * Логика баланса — окупаемость:
 *
 *   окупаемость (часы) = baseCost / baseIncomePerHour
 *
 * Она растёт по лестнице: 20 часов у пиццерии и 37 у порта. То есть дешёвые
 * бизнесы выгоднее по вложенному DONC, а дорогие берут абсолютом — иначе
 * первый же доступный бизнес обесценивал бы всё остальное.
 *
 * Каждая следующая ступень стоит примерно в 5 раз дороже предыдущей. Это
 * привязывает каталог к росту игрока: пиццерия по карману в первый час,
 * порт — уже ближе к рангу «Дон».
 *
 * Внутри одного бизнеса цена уровня растёт как baseCost × 1.15^level, а доход
 * — линейно (baseIncomePerHour × level). Значит каждый следующий уровень
 * окупается на 15% дольше предыдущего: качать вглубь можно долго, но
 * бесконечно выгодным это не станет.
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
    slug: 'pizzeria',
    name: 'Пиццерия',
    description: 'Маленькая точка на углу. С неё начинают все',
    category: 'Общепит',
    baseCost: 2_000n,
    baseIncomePerHour: 100n,
    costMultiplier: 1.15,
    sortOrder: 1,
  },
  {
    slug: 'car_wash',
    name: 'Автомойка',
    description: 'Наличные каждый день и никаких вопросов',
    category: 'Услуги',
    baseCost: 10_000n,
    baseIncomePerHour: 450n,
    costMultiplier: 1.15,
    sortOrder: 2,
  },
  {
    slug: 'restaurant',
    name: 'Ресторан',
    description: 'Место для встреч, где стены умеют молчать',
    category: 'Общепит',
    baseCost: 50_000n,
    baseIncomePerHour: 2_000n,
    costMultiplier: 1.15,
    sortOrder: 3,
  },
  {
    slug: 'night_club',
    name: 'Ночной клуб',
    description: 'Музыка громкая, выручка ещё громче',
    category: 'Развлечения',
    baseCost: 250_000n,
    baseIncomePerHour: 9_000n,
    costMultiplier: 1.15,
    sortOrder: 4,
  },
  {
    slug: 'construction',
    name: 'Строительная компания',
    description: 'Городские подряды и очень длинные сметы',
    category: 'Промышленность',
    baseCost: 1_200_000n,
    baseIncomePerHour: 40_000n,
    costMultiplier: 1.15,
    sortOrder: 5,
  },
  {
    slug: 'private_club',
    name: 'Закрытый клуб',
    description: 'Вход по знакомству. Здесь решают, а не отдыхают',
    category: 'Влияние',
    baseCost: 6_000_000n,
    baseIncomePerHour: 180_000n,
    costMultiplier: 1.15,
    sortOrder: 6,
  },
  {
    slug: 'port',
    name: 'Портовый бизнес',
    description: 'Контейнеры приходят и уходят. Вопросов никто не задаёт',
    category: 'Логистика',
    baseCost: 30_000_000n,
    baseIncomePerHour: 800_000n,
    costMultiplier: 1.15,
    sortOrder: 7,
  },
];

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
