import { RANKS } from '../config/ranks.js';
import { RETIREMENT_STEP } from '../config/retirement.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';
import { START_STATE } from './upgrades.js';

export type RetirementErrorCode = 'NOT_READY' | 'CONFLICT';

export class RetirementError extends Error {
  constructor(
    readonly code: RetirementErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'RetirementError';
  }
}

/**
 * Уводит игрока на покой: обнуляет нажитое и засчитывает круг.
 *
 * Всё одной транзакцией, причём обнуление идёт под условием «накопленного
 * заработка хватает и счётчик кругов не менялся». Иначе два одновременных
 * запроса засчитали бы два круга за один проход игры.
 */
export async function retire(user: User): Promise<User> {
  const required = RANKS[RETIREMENT_STEP]!.minBalance;

  if (user.totalEarned < required) {
    throw new RetirementError('NOT_READY', 'Сначала дойдите до последней ступени');
  }

  const reset = {
    balance: 0n,
    totalEarned: 0n,
    tapLevel: 0,
    energyLevel: 0,
    regenLevel: 0,
    ...START_STATE,
    energyUpdatedAt: new Date(),
    businessCollectedAt: new Date(),
    retirements: user.retirements + 1,
  };

  const done = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,
        retirements: user.retirements,
        totalEarned: { gte: required },
      },
      data: reset,
    });

    if (updated.count === 0) {
      return false;
    }

    // Бизнесы тоже с нуля: иначе круг начинался бы с готовым пассивным
    // доходом и не был бы кругом.
    await tx.userBusiness.deleteMany({ where: { userId: user.id } });

    return true;
  });

  if (!done) {
    throw new RetirementError('CONFLICT', 'Не получилось, попробуйте ещё раз');
  }

  return { ...user, ...reset };
}
