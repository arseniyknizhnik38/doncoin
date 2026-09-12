import { randomInt } from 'node:crypto';
import {
  ENVELOPE_FROM_STEP,
  ENVELOPE_TIERS,
  type EnvelopeTier,
  envelopeReward,
  pickTier,
} from '../config/envelope.js';
import { rankStep, RANKS } from '../config/ranks.js';
import { utcDayNumber } from '../config/rewards.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type EnvelopeErrorCode = 'TOO_EARLY' | 'ALREADY_TAKEN' | 'CONFLICT';

export class EnvelopeError extends Error {
  constructor(
    readonly code: EnvelopeErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'EnvelopeError';
  }
}

export interface EnvelopeState {
  /** Ранг дорос — конверты заносят. */
  unlocked: boolean;
  /** Подпись ранга, с которого начинают заносить. */
  unlocksAt: string;
  /** Сегодня ещё не брали. */
  available: boolean;
  /** Что было в сегодняшнем конверте, если его уже открыли. */
  opened: { tier: string; title: string; amount: string } | null;
  /** Сколько секунд до следующего. */
  nextInSeconds: number;
}

function tierTitle(id: string | null): string {
  return ENVELOPE_TIERS.find((tier) => tier.id === id)?.title ?? 'Конверт';
}

function secondsToMidnight(now: Date): number {
  const nextDay = (utcDayNumber(now) + 1) * 86_400_000;

  return Math.max(0, Math.round((nextDay - now.getTime()) / 1000));
}

export function envelopeState(user: User, now: Date): EnvelopeState {
  const today = utcDayNumber(now);
  const unlocked = rankStep(user.totalEarned) >= ENVELOPE_FROM_STEP;
  const takenToday = user.envelopeDay === today;
  const rank = RANKS[ENVELOPE_FROM_STEP]!;

  return {
    unlocked,
    unlocksAt: `${rank.title} ${'★'.repeat(rank.star)}`,
    available: unlocked && !takenToday,
    opened: takenToday
      ? {
          tier: user.envelopeTier ?? '',
          title: tierTitle(user.envelopeTier),
          amount: user.envelopeAmount.toString(),
        }
      : null,
    nextInSeconds: secondsToMidnight(now),
  };
}

export interface OpenedEnvelope {
  tier: EnvelopeTier;
  amount: bigint;
}

/**
 * Открывает конверт.
 *
 * Бросок делает сервер и только сервер: случайность на клиенте означала бы,
 * что игрок сам себе назначает награду. Отметка о выдаче ставится условием
 * в UPDATE, поэтому два одновременных нажатия не откроют два конверта.
 */
export async function openEnvelope(user: User, now: Date): Promise<OpenedEnvelope> {
  const today = utcDayNumber(now);

  if (rankStep(user.totalEarned) < ENVELOPE_FROM_STEP) {
    const rank = RANKS[ENVELOPE_FROM_STEP]!;

    throw new EnvelopeError(
      'TOO_EARLY',
      `Заносить начнут с ранга «${rank.title} ${'★'.repeat(rank.star)}»`,
    );
  }

  if (user.envelopeDay === today) {
    throw new EnvelopeError('ALREADY_TAKEN', 'Сегодняшний конверт уже у вас');
  }

  // randomInt из node:crypto, а не Math.random: предсказуемый генератор в
  // механике, которая раздаёт деньги, — это приглашение его вычислить.
  const tier = pickTier(randomInt(0, 1_000_000) / 1_000_000);
  const amount = envelopeReward(tier, user);

  const taken = await prisma.user.updateMany({
    where: { id: user.id, envelopeDay: user.envelopeDay },
    data: {
      envelopeDay: today,
      envelopeTier: tier.id,
      envelopeAmount: amount,
      balance: { increment: amount },
      totalEarned: { increment: amount },
      lifetimeEarned: { increment: amount },
    },
  });

  if (taken.count === 0) {
    throw new EnvelopeError('CONFLICT', 'Не получилось, попробуйте ещё раз');
  }

  return { tier, amount };
}
