import { levelCost, levelIncome } from '../config/businesses.js';
import type { Business, User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type BusinessErrorCode =
  | 'BUSINESS_NOT_FOUND'
  | 'NOT_ENOUGH_COINS'
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
 * и пока игрок в приложении. Потолка нет — владелец заплатил за них полную
 * цену, и «сгорающий» доход только раздражал бы.
 */
export function pendingBusinessIncome(
  collectedAt: Date,
  perHour: bigint,
  now: Date,
): bigint {
  const hours = Math.max(0, (now.getTime() - collectedAt.getTime()) / 3_600_000);

  return BigInt(Math.floor(Number(perHour) * hours));
}

export interface BusinessCollection {
  earned: bigint;
  perHour: bigint;
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
  const perHour = totalIncomePerHour(rows);
  const earned = pendingBusinessIncome(user.businessCollectedAt, perHour, now);

  if (earned > 0n) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: earned },
        totalEarned: { increment: earned },
        businessCollectedAt: now,
      },
    });
  }

  return { earned, perHour };
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
}

export function describeBusinesses(rows: BusinessRow[], balance: bigint): BusinessView[] {
  return rows.map(({ business, level }) => {
    const nextCost = levelCost(business, level);

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
      affordable: balance >= nextCost,
      owned: level > 0,
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
): Promise<{ level: number; cost: bigint }> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });

  if (!business) {
    throw new BusinessError('BUSINESS_NOT_FOUND', 'Такого бизнеса нет', 404);
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
