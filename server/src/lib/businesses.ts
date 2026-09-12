import {
  COLLECT_CAP_HOURS,
  levelCost,
  levelIncome,
  requiredRankStep,
} from '../config/businesses.js';
 import { rankLabel } from '../config/ranks.js';
import { retirementBonus } from '../config/retirement.js';
import {
  PERK_BONUS_PER_LEVEL,
  applyBonus,
  clanBonusPercent,
  splitTribute,
} from '../config/perks.js';
import type { Business, User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type BusinessErrorCode =
  | 'BUSINESS_NOT_FOUND'
  | 'NOT_ENOUGH_COINS'
  | 'RANK_TOO_LOW'
  | 'CONFLICT';

export class BusinessError extends Error {
  constructor(
    readonly code: BusinessErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export interface BusinessRow {
  business: Business;
  level: number;
}

/** Каталог вместе с уровнями игрока. Некупленные идут с уровнем 0. */
export async function loadBusinesses(userId: string): Promise<BusinessRow[]> {
  const [catalog, owned] = await Promise.all([
    prisma.business.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.userBusiness.findMany({ where: { userId } }),
  ]);

  const levels = new Map(owned.map((row) => [row.businessId, row.level]));

  return catalog.map((business) => ({
    business,
    level: levels.get(business.id) ?? 0,
  }));
}

/** Суммарный доход всех бизнесов игрока в час. */
export function totalIncomePerHour(rows: BusinessRow[]): bigint {
  return rows.reduce(
    (sum, row) => sum + levelIncome(row.business, row.level),
    0n,
  );
}

/**
 * Сколько бизнесы принесли с последнего начисления.
 *
 * В отличие от оффлайн-дохода, у бизнесов свой отсчёт времени
 * (businessCollectedAt) и он не сбрасывается тапами: предприятия работают
 * и пока игрок в приложении.
 *
 * Накопление ограничено COLLECT_CAP_HOURS — «касса переполнена». Это не
 * жадность, а единственный рычаг, которым игра просит заходить: без потолка
 * доход капает круглосуточно, и заходить чаще раза в сутки незачем.
 */
export function pendingBusinessIncome(
  collectedAt: Date,
  perHour: bigint,
  now: Date,
): bigint {
  const elapsed = Math.max(0, (now.getTime() - collectedAt.getTime()) / 3_600_000);
  const hours = Math.min(elapsed, COLLECT_CAP_HOURS);

  return BigInt(Math.floor(Number(perHour) * hours));
}

/** Заполнена ли касса до отказа — это показываем игроку. */
export function isCollectionFull(collectedAt: Date, now: Date): boolean {
  return (now.getTime() - collectedAt.getTime()) / 3_600_000 >= COLLECT_CAP_HOURS;
}

/** Суммарная прибавка к доходу бизнесов: свой перк плюс уровень клана. */
export async function businessBonusPercent(user: User): Promise<number> {
  const clan = user.clanId
    ? await prisma.clan.findUnique({
        where: { id: user.clanId },
        select: { treasury: true, familyXp: true },
      })
    : null;

  return (
    user.respectBusinessLevel * PERK_BONUS_PER_LEVEL +
    clanBonusPercent(clan) +
    retirementBonus(user.retirements)
  );
}

export interface BusinessCollection {
  /** Сколько дошло до игрока — уже за вычетом доли семьи. */
  earned: bigint;
  perHour: bigint;
  /** Сколько ушло в кассу семьи. */
  tribute: bigint;
}

/**
 * Начисляет накопленный доход и сдвигает отсчёт. Вызывается при входе и
 * перед покупкой — то есть там, где запись в базу и так происходит.
 */
export async function collectBusinessIncome(
  user: User,
  now: Date,
): Promise<BusinessCollection> {
  const rows = await loadBusinesses(user.id);
  // «Деловая хватка» и уровень клана увеличивают доход бизнесов.
  const bonus = await businessBonusPercent(user);
  const perHour = applyBonus(totalIncomePerHour(rows), bonus);
  const earned = pendingBusinessIncome(user.businessCollectedAt, perHour, now);

  // Доля семьи снимается здесь и только здесь: сбор дохода — единственное
  // место, где деньги бизнесов приходят игроку, и других путей мимо кассы
  // у них нет.
  const clan = user.clanId
    ? await prisma.clan.findUnique({
        where: { id: user.clanId },
        select: { tributePercent: true },
      })
    : null;

  const { toTreasury, toPlayer } = splitTribute(earned, clan?.tributePercent ?? 0);

  if (earned > 0n) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: toPlayer },
        // В заработок идёт всё: отстёгнутое игрок заработал, просто отдал.
        // Иначе отстёгивание замедляло бы рост ранга, и платить за место в
        // семье приходилось бы ещё и рангом.
        totalEarned: { increment: earned },
        lifetimeEarned: { increment: earned },
        businessCollectedAt: now,
      },
    });
  }

  if (toTreasury > 0n && user.clanId) {
    await prisma.clan.update({
      where: { id: user.clanId },
      data: { treasury: { increment: toTreasury } },
    });
  }

  return { earned: toPlayer, perHour, tribute: toTreasury };
}

export interface BusinessView {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  level: number;
  /** Доход на текущем уровне. */
  incomePerHour: string;
  /** Прибавка дохода за следующий уровень. */
  nextIncomePerHour: string;
  /** Цена следующего уровня. */
  nextCost: string;
  affordable: boolean;
  owned: boolean;
  /** Ранг ещё не дорос — бизнес виден, но купить нельзя. */
  locked: boolean;
  /** Подпись ступени, с которой бизнес открывается. */
  requiredRank: string;
}

export function describeBusinesses(
  rows: BusinessRow[],
  balance: bigint,
  /** Ступень ранга игрока: ниже неё бизнес заблокирован. */
  step: number,
): BusinessView[] {
  return rows.map(({ business, level }) => {
    const nextCost = levelCost(business, level);
    const gate = requiredRankStep(business.slug);
    const locked = step < gate;

    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      description: business.description,
      category: business.category,
      level,
      incomePerHour: levelIncome(business, level).toString(),
      nextIncomePerHour: levelIncome(business, level + 1).toString(),
      nextCost: nextCost.toString(),
      affordable: !locked && balance >= nextCost,
      owned: level > 0,
      locked,
      requiredRank: rankLabel(gate),
    };
  });
}

/**
 * Покупка следующего уровня. Списание и повышение уровня идут одной
 * транзакцией: иначе при сбое между ними деньги списались бы впустую.
 */
export async function buyBusinessLevel(
  userId: string,
  businessId: string,
  /** Ступень ранга покупателя — проверяется здесь, а не только в интерфейсе. */
  step: number,
): Promise<{ level: number; cost: bigint }> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });

  if (!business) {
    throw new BusinessError('BUSINESS_NOT_FOUND', 'Такого бизнеса нет', 404);
  }

  const gate = requiredRankStep(business.slug);

  if (step < gate) {
    throw new BusinessError(
      'RANK_TOO_LOW',
      `Откроется на ранге «${rankLabel(gate)}»`,
    );
  }

  const existing = await prisma.userBusiness.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });

  const level = existing?.level ?? 0;
  const cost = levelCost(business, level);

  return prisma.$transaction(async (tx) => {
    // Условие «денег хватает» — в самом UPDATE, чтобы баланс не ушёл в минус
    // при двух одновременных покупках.
    const spent = await tx.user.updateMany({
      where: { id: userId, balance: { gte: cost } },
      data: { balance: { decrement: cost } },
    });

    if (spent.count === 0) {
      throw new BusinessError('NOT_ENOUGH_COINS', 'Недостаточно монет');
    }

    if (existing) {
      // Уровень тоже под условием: если его успели поднять, откатываемся.
      const raised = await tx.userBusiness.updateMany({
        where: { userId, businessId, level },
        data: { level: level + 1 },
      });

      if (raised.count === 0) {
        throw new BusinessError('CONFLICT', 'Уровень изменился, повторите');
      }
    } else {
      try {
        await tx.userBusiness.create({
          data: { userId, businessId, level: 1 },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new BusinessError('CONFLICT', 'Бизнес уже куплен, повторите');
        }

        throw error;
      }
    }

    return { level: level + 1, cost };
  });
}
