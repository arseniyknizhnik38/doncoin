import { FEED_LIMIT, FEED_RANK_FROM_STEP, type FeedKind, feedText, isClanEvent } from '../config/feed.js';
import { RANKS, rankStep } from '../config/ranks.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

interface RecordInput {
  kind: FeedKind;
  actor: string;
  rival?: string | null;
  amount?: bigint | null;
  rank?: string | null;
}

/**
 * Записывает событие в ленту.
 *
 * Ошибку глотаем намеренно: лента — украшение. Игрок не должен получить
 * отказ в повышении ранга или в открытии конверта из-за того, что не
 * записалась новость об этом.
 */
export async function recordFeed(input: RecordInput): Promise<void> {
  try {
    await prisma.feedEvent.create({
      data: {
        kind: input.kind,
        actor: input.actor,
        rival: input.rival ?? null,
        amount: input.amount ?? null,
        rank: input.rank ?? null,
      },
    });
  } catch (error) {
    console.warn('[feed] не записали событие', error);
  }
}

/** Как подписывать игрока в ленте: тем же именем, что и в лидерборде. */
export function actorName(user: Pick<User, 'firstName' | 'username'>): string {
  return user.firstName ?? (user.username ? `@${user.username}` : 'Аноним');
}

export interface FeedView {
  id: string;
  kind: string;
  text: string;
  /** Про семью или про человека — клиент разводит их по оформлению. */
  aboutClan: boolean;
  createdAt: Date;
}

export async function loadFeed(limit = FEED_LIMIT): Promise<FeedView[]> {
  const events = await prisma.feedEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    text: feedText(event),
    aboutClan: isClanEvent(event.kind),
    createdAt: event.createdAt,
  }));
}

/**
 * Объявляет повышение ранга, если игрок поднялся выше, чем объявляли раньше.
 *
 * Ранг нигде не хранится — он считается от заработка, и «момента повышения»
 * в базе нет. Поэтому сверяемся при входе: один раз за сессию, а не на
 * каждом тапе.
 *
 * В ленту идут только высокие ступени. Ниже повышения случаются каждые
 * несколько часов у каждого игрока, и лента превратилась бы в бегущую
 * строку, в которой ничего не разглядеть.
 */
export async function announceRankIfRisen(user: User): Promise<void> {
  const step = rankStep(user.totalEarned);

  if (step <= user.feedRankStep) {
    return;
  }

  // Отметку двигаем в любом случае, даже когда объявлять нечего: иначе при
  // переходе через порог мы объявили бы разом весь путь снизу.
  await prisma.user
    .update({ where: { id: user.id }, data: { feedRankStep: step } })
    .catch(() => undefined);

  if (step < FEED_RANK_FROM_STEP) {
    return;
  }

  const rank = RANKS[step];

  if (!rank) {
    return;
  }

  await recordFeed({
    kind: 'rank_up',
    actor: actorName(user),
    rank: `${rank.title} ${'★'.repeat(rank.star)}`,
  });
}
