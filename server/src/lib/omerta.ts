import {
  OMERTA_ATTEMPTS_PER_DAY,
  OMERTA_ITEMS,
  OMERTA_LENGTH,
  countInPlace,
  omertaCombination,
  omertaReward,
  omertaSecret,
} from '../config/omerta.js';
import { pickLangStored } from '../config/i18n.js';
import { utcDayNumber } from '../config/rewards.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type OmertaErrorCode = 'ALREADY_SOLVED' | 'NO_ATTEMPTS' | 'CONFLICT';

export class OmertaError extends Error {
  constructor(
    readonly code: OmertaErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'OmertaError';
  }
}

export interface OmertaState {
  items: { id: string; emoji: string; title: string }[];
  length: number;
  solved: boolean;
  /** Разгадавшему показываем ответ — им и делятся. До разгадки его нет. */
  answer: string[] | null;
  attemptsLeft: number;
  /** Сколько стояло на местах в последней попытке сегодня. */
  lastHits: number | null;
  rewardCoins: string;
  nextInSeconds: number;
}

function attemptsUsed(user: Pick<User, 'omertaDay' | 'omertaAttempts'>, today: number): number {
  return user.omertaDay === today ? user.omertaAttempts : 0;
}

export function omertaState(user: User, now: Date): OmertaState {
  const today = utcDayNumber(now);
  const lang = pickLangStored(user.language);
  const solved = user.omertaSolvedDay === today;

  return {
    items: OMERTA_ITEMS.map((item) => ({
      id: item.id,
      emoji: item.emoji,
      title: item.title[lang],
    })),
    length: OMERTA_LENGTH,
    solved,
    answer: solved ? omertaCombination(today, omertaSecret()) : null,
    attemptsLeft: Math.max(0, OMERTA_ATTEMPTS_PER_DAY - attemptsUsed(user, today)),
    lastHits: user.omertaDay === today ? user.omertaLastHits : null,
    rewardCoins: omertaReward(user).toString(),
    nextInSeconds: Math.max(0, Math.round(((today + 1) * 86_400_000 - now.getTime()) / 1000)),
  };
}

/**
 * Проверяет раскладку.
 *
 * Попытка списывается условным UPDATE до сравнения: иначе параллельные
 * запросы перебирали бы комбинации сверх лимита.
 */
export async function guessOmerta(
  user: User,
  guess: string[],
  now: Date,
): Promise<{ hits: number; reward: bigint }> {
  const today = utcDayNumber(now);

  if (user.omertaSolvedDay === today) {
    throw new OmertaError('ALREADY_SOLVED', 'Шифр Омерты сегодня уже разгадан');
  }

  const used = attemptsUsed(user, today);

  if (used >= OMERTA_ATTEMPTS_PER_DAY) {
    throw new OmertaError('NO_ATTEMPTS', 'Попытки на сегодня кончились');
  }

  const hits = countInPlace(guess, omertaCombination(today, omertaSecret()));
  const solved = hits === OMERTA_LENGTH;
  const reward = solved ? omertaReward(user) : 0n;

  const taken = await prisma.user.updateMany({
    where: {
      id: user.id,
      omertaDay: user.omertaDay,
      omertaAttempts: user.omertaAttempts,
      omertaSolvedDay: user.omertaSolvedDay,
    },
    data: {
      omertaDay: today,
      omertaAttempts: used + 1,
      omertaLastHits: hits,
      ...(solved
        ? {
            omertaSolvedDay: today,
            balance: { increment: reward },
            totalEarned: { increment: reward },
            lifetimeEarned: { increment: reward },
          }
        : {}),
    },
  });

  if (taken.count === 0) {
    throw new OmertaError('CONFLICT', 'Не получилось, попробуйте ещё раз');
  }

  return { hits, reward };
}

/** Ответы на сегодня и завтра — владельцу, чтобы готовить посты заранее. */
export async function omertaForOwner(now: Date) {
  const today = utcDayNumber(now);
  const secret = omertaSecret();
  const byId = new Map(OMERTA_ITEMS.map((item) => [item.id, item]));
  const describe = (day: number) =>
    omertaCombination(day, secret).map((id) => {
      const item = byId.get(id)!;

      return { id, emoji: item.emoji, title: item.title.ru };
    });

  const solvedToday = await prisma.user.count({ where: { omertaSolvedDay: today } });

  return {
    today: { combination: describe(today), solved: solvedToday },
    tomorrow: { combination: describe(today + 1) },
  };
}
