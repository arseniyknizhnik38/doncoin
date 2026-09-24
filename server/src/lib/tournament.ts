import { weekNumber } from '../config/wars.js';
import { actorName, recordFeed } from './feed.js';
import { prisma } from './prisma.js';
import { grantTickets } from './raffle.js';

/**
 * Недельный турнир кентов: кто привёл больше живых игроков — тот забирает
 * билеты розыгрыша.
 *
 * Считаются только засчитанные кенты (прошедшие порог тапов) — та же
 * анти-накрутка, что и у самой рефералки: место в турнире стоит столько же,
 * сколько стоят живые люди, и ботофермой его не взять.
 *
 * Приз — билеты, а не монеты: монеты инфлируют, а билеты втягивают
 * победителей в ближайший тираж и связывают две петли роста в одну.
 */

/** Билетов за место, с первого по десятое. */
export const TOURNAMENT_TICKETS = [10, 7, 5, 3, 3, 2, 2, 2, 2, 2] as const;

/** Понедельник 00:00 UTC недели, в которую попадает дата. */
export function weekStartUtc(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - dayNumber);

  return start;
}

export interface TournamentRow {
  userId: string;
  name: string;
  qualified: number;
}

/** Топ пригласивших за окно [from, to). */
async function topInviters(from: Date, to: Date, take: number): Promise<TournamentRow[]> {
  const grouped = await prisma.user.groupBy({
    by: ['referredById'],
    where: {
      referredById: { not: null },
      referralQualifiedAt: { gte: from, lt: to },
    },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take,
  });

  const ids = grouped.map((row) => row.referredById).filter(Boolean) as string[];

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, username: true },
  });

  const nameById = new Map(users.map((user) => [user.id, actorName(user)]));

  return grouped
    .filter((row) => row.referredById !== null)
    .map((row) => ({
      userId: row.referredById as string,
      name: nameById.get(row.referredById as string) ?? 'Аноним',
      qualified: row._count._all,
    }));
}

export interface TournamentView {
  /** Когда неделя кончится и билеты разойдутся. */
  endsAt: Date;
  prizes: number[];
  top: { name: string; qualified: number; isMe: boolean }[];
  my: { qualified: number; place: number | null };
  /** Итоги прошлой недели — доказательство, что билеты действительно дают. */
  last: { place: number; name: string; tickets: number }[];
}

/** Турнирная таблица недели глазами одного игрока. */
export async function tournamentView(userId: string, now: Date): Promise<TournamentView> {
  const from = weekStartUtc(now);
  const to = new Date(from.getTime() + 7 * 86_400_000);

  const [top, myQualified, lastResults] = await Promise.all([
    topInviters(from, to, TOURNAMENT_TICKETS.length),
    prisma.user.count({
      where: { referredById: userId, referralQualifiedAt: { gte: from, lt: to } },
    }),
    prisma.referralTournamentResult.findMany({
      where: { weekNumber: weekNumber(new Date(from.getTime() - 86_400_000)) },
      orderBy: { place: 'asc' },
      take: 3,
      include: { user: { select: { firstName: true, username: true } } },
    }),
  ]);

  const place = top.findIndex((row) => row.userId === userId);

  return {
    endsAt: to,
    prizes: [...TOURNAMENT_TICKETS],
    top: top.map((row) => ({
      name: row.name,
      qualified: row.qualified,
      isMe: row.userId === userId,
    })),
    my: { qualified: myQualified, place: place >= 0 ? place + 1 : null },
    last: lastResults.map((row) => ({
      place: row.place,
      name: actorName(row.user),
      tickets: row.tickets,
    })),
  };
}

/**
 * Подводит итоги прошлой недели и раздаёт билеты.
 *
 * Идемпотентно: неделя, по которой уже есть строки итогов, не считается
 * заново, а гонку двух одновременных запусков решает уникальность
 * (weekNumber, place) — проигравший запуск откатывается целиком.
 */
export async function settleTournament(now: Date): Promise<number> {
  const thisWeekStart = weekStartUtc(now);
  const prevStart = new Date(thisWeekStart.getTime() - 7 * 86_400_000);
  const prevWeek = weekNumber(prevStart);

  const already = await prisma.referralTournamentResult.findFirst({
    where: { weekNumber: prevWeek },
  });

  if (already) {
    return 0;
  }

  const winners = await topInviters(prevStart, thisWeekStart, TOURNAMENT_TICKETS.length);

  if (winners.length === 0) {
    return 0;
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const [index, winner] of winners.entries()) {
        await tx.referralTournamentResult.create({
          data: {
            weekNumber: prevWeek,
            place: index + 1,
            userId: winner.userId,
            qualified: winner.qualified,
            tickets: TOURNAMENT_TICKETS[index] ?? 0,
          },
        });
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      // Параллельный запуск успел первым — итоги уже подведены.
      return 0;
    }

    throw error;
  }

  // Билеты — после фиксации итогов: даже если выдача оборвётся, таблица
  // победителей уже правдива, а билеты доедут со следующего запуска вручную.
  for (const [index, winner] of winners.entries()) {
    await grantTickets(winner.userId, 'tournament', TOURNAMENT_TICKETS[index] ?? 0);
  }

  const first = winners[0];

  if (first) {
    await recordFeed({
      kind: 'tournament_won',
      actor: first.name,
      amount: BigInt(first.qualified),
    });
  }

  return winners.length;
}
