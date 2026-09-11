import {
  CIPHER_ATTEMPTS_PER_DAY,
  CIPHER_REWARD_HOURS,
  attemptsLeft,
  attemptsUsed,
  normalizeCipher,
} from '../config/cipher.js';
import { activeIncomePerHour, utcDayNumber } from '../config/rewards.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type CipherErrorCode =
  | 'NO_CIPHER'
  | 'WRONG_CODE'
  | 'ALREADY_SOLVED'
  | 'NO_ATTEMPTS'
  | 'CONFLICT';

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
  /** Сколько попыток осталось сегодня. */
  attemptsLeft: number;
}

export function cipherReward(user: User): bigint {
  return BigInt(Math.floor(activeIncomePerHour(user) * CIPHER_REWARD_HOURS));
}

export async function cipherState(user: User, now: Date): Promise<CipherState> {
  const today = utcDayNumber(now);
  const left = attemptsLeft(user, today);

  const cipher = await prisma.dailyCipher.findUnique({
    where: { dayNumber: today },
  });

  if (!cipher) {
    return {
      available: false,
      hint: null,
      solved: false,
      rewardCoins: '0',
      attemptsLeft: left,
    };
  }

  const solve = await prisma.cipherSolve.findUnique({
    where: { userId_cipherId: { userId: user.id, cipherId: cipher.id } },
  });

  return {
    available: true,
    hint: cipher.hint,
    solved: solve !== null,
    rewardCoins: cipherReward(user).toString(),
    attemptsLeft: left,
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
  const today = utcDayNumber(now);

  const cipher = await prisma.dailyCipher.findUnique({
    where: { dayNumber: today },
  });

  if (!cipher) {
    throw new CipherError('NO_CIPHER', 'Сегодня шифра нет', 404);
  }

  const used = attemptsUsed(user, today);

  if (used >= CIPHER_ATTEMPTS_PER_DAY) {
    throw new CipherError('NO_ATTEMPTS', 'Попытки на сегодня кончились');
  }

  // Попытка списывается ДО сравнения кода. Иначе перебор ничего не стоит:
  // шестибуквенный код подбирается за вечер, и смысл шифра — привести
  // человека в канал — пропадает.
  //
  // Условия в WHERE отсекают гонку: два одновременных запроса не спишут
  // одну и ту же попытку дважды.
  const consumed = await prisma.user.updateMany({
    where: {
      id: user.id,
      cipherDay: user.cipherDay,
      cipherAttempts: user.cipherAttempts,
    },
    data: { cipherDay: today, cipherAttempts: used + 1 },
  });

  if (consumed.count === 0) {
    throw new CipherError('CONFLICT', 'Не получилось, попробуйте ещё раз');
  }

  if (normalizeCipher(rawCode) !== cipher.code) {
    throw new CipherError(
      'WRONG_CODE',
      `Код не подошёл. Осталось попыток: ${CIPHER_ATTEMPTS_PER_DAY - used - 1}`,
    );
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
