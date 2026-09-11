import { CIPHER_REWARD_HOURS, normalizeCipher } from '../config/cipher.js';
import { activeIncomePerHour, utcDayNumber } from '../config/rewards.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type CipherErrorCode = 'NO_CIPHER' | 'WRONG_CODE' | 'ALREADY_SOLVED';

export class CipherError extends Error {
  constructor(
    readonly code: CipherErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'CipherError';
  }
}

export interface CipherState {
  /** Шифр на сегодня заведён. */
  available: boolean;
  /** Подсказка, где искать код. */
  hint: string | null;
  solved: boolean;
  /** Что дадут за разгадку. */
  rewardCoins: string;
}

export function cipherReward(user: User): bigint {
  return BigInt(Math.floor(activeIncomePerHour(user) * CIPHER_REWARD_HOURS));
}

export async function cipherState(user: User, now: Date): Promise<CipherState> {
  const cipher = await prisma.dailyCipher.findUnique({
    where: { dayNumber: utcDayNumber(now) },
  });

  if (!cipher) {
    return { available: false, hint: null, solved: false, rewardCoins: '0' };
  }

  const solve = await prisma.cipherSolve.findUnique({
    where: { userId_cipherId: { userId: user.id, cipherId: cipher.id } },
  });

  return {
    available: true,
    hint: cipher.hint,
    solved: solve !== null,
    rewardCoins: cipherReward(user).toString(),
  };
}

/**
 * Проверяет код и выдаёт награду.
 *
 * Отметка о разгадке создаётся раньше начисления и защищена уникальным
 * индексом: повторный запрос упирается в него и уходит с ошибкой, а не
 * платит второй раз.
 */
export async function solveCipher(
  user: User,
  rawCode: string,
  now: Date,
): Promise<{ reward: bigint }> {
  const cipher = await prisma.dailyCipher.findUnique({
    where: { dayNumber: utcDayNumber(now) },
  });

  if (!cipher) {
    throw new CipherError('NO_CIPHER', 'Сегодня шифра нет', 404);
  }

  if (normalizeCipher(rawCode) !== cipher.code) {
    throw new CipherError('WRONG_CODE', 'Код не подошёл');
  }

  const reward = cipherReward(user);

  try {
    await prisma.cipherSolve.create({
      data: { userId: user.id, cipherId: cipher.id, reward },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new CipherError('ALREADY_SOLVED', 'Шифр уже разгадан');
    }

    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { increment: reward },
      totalEarned: { increment: reward },
      lifetimeEarned: { increment: reward },
    },
  });

  return { reward };
}

/** Заводит или меняет шифр на сутки. Вызывается только владельцем. */
export async function setCipher(
  dayNumber: number,
  code: string,
  hint: string | null,
): Promise<{ dayNumber: number; code: string }> {
  const normalized = normalizeCipher(code);

  const saved = await prisma.dailyCipher.upsert({
    where: { dayNumber },
    update: { code: normalized, hint },
    create: { dayNumber, code: normalized, hint },
  });

  return { dayNumber: saved.dayNumber, code: saved.code };
}
