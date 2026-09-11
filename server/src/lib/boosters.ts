import {
  type BoosterId,
  RUSH_SECONDS,
  findBooster,
  usedToday,
} from '../config/boosters.js';
import { utcDayNumber } from '../config/rewards.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type BoosterErrorCode = 'BOOSTER_NOT_FOUND' | 'NO_CHARGES' | 'CONFLICT';

export class BoosterError extends Error {
  constructor(
    readonly code: BoosterErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'BoosterError';
  }
}

/**
 * Тратит заряд бустера.
 *
 * Счётчики за сутки не сбрасываются фоновой задачей — они «протухают»
 * вместе с boostDay и обнуляются здесь, при первой же трате в новые сутки.
 * Поэтому одна запись делает всё сразу: переводит день, ставит счётчики
 * и применяет эффект.
 *
 * Условия в WHERE — защита от двух одновременных нажатий: проигравший
 * получит count = 0 и увидит «повторите», а не лишний заряд.
 */
export async function useBooster(
  user: User,
  id: string,
  now: Date,
): Promise<User> {
  const booster = findBooster(id);

  if (!booster) {
    throw new BoosterError('BOOSTER_NOT_FOUND', 'Такого бустера нет', 404);
  }

  const today = utcDayNumber(now);
  const used = usedToday(user, today);

  if (used[booster.id] >= booster.perDay) {
    throw new BoosterError('NO_CHARGES', 'Заряды кончились, будут завтра');
  }

  const next: Record<BoosterId, number> = { ...used };
  next[booster.id] += 1;

  const effect =
    booster.id === 'full_energy'
      ? { energy: user.energyMax, energyUpdatedAt: now }
      : { rushEndsAt: new Date(now.getTime() + RUSH_SECONDS * 1000) };

  const updated = await prisma.user.updateMany({
    where: {
      id: user.id,
      boostDay: user.boostDay,
      fullEnergyUsed: user.fullEnergyUsed,
      rushUsed: user.rushUsed,
    },
    data: {
      boostDay: today,
      fullEnergyUsed: next.full_energy,
      rushUsed: next.rush,
      lastSeenAt: now,
      ...effect,
    },
  });

  if (updated.count === 0) {
    throw new BoosterError('CONFLICT', 'Не получилось, попробуйте ещё раз');
  }

  // Перечитывать строку незачем: UPDATE прошёл ровно с теми условиями,
  // которые мы проверяли, значит результат известен точно.
  return {
    ...user,
    boostDay: today,
    fullEnergyUsed: next.full_energy,
    rushUsed: next.rush,
    lastSeenAt: now,
    ...effect,
  };
}
