import { weekNumber } from '../config/wars.js';
import type { User } from '../generated/prisma/client.js';
import { actorName } from './feed.js';
import { prisma } from './prisma.js';
import { weekStartUtc } from './tournament.js';

/**
 * Личные лиги: недельные группы до 50 игроков, счёт — заработок за неделю.
 *
 * Смысл — дать соперников по росту каждому, а не только вершине: в общем
 * топе новичок навсегда на дне, а в группе из полусотни таких же у него
 * есть место, за которое можно биться сегодня вечером.
 *
 * Устройство нарочно ленивое, без фоновой задачи: перекат недели происходит
 * при первом входе игрока в новую неделю. Итог прошлой недели можно судить
 * в любой момент, потому что счёт каждого члена группы восстановим: кто ещё
 * не перекатился — у того totalEarned не рос с конца недели, а кто
 * перекатился — заморозил свой итог в leagueLastScore.
 */

/** Лиги снизу вверх. Названия — язык этого мира, а не «бронза-серебро». */
export const LEAGUE_TIERS = [
  'Улица',
  'Квартал',
  'Район',
  'Город',
  'Синдикат',
  'Лига Дона',
] as const;

/** Максимум игроков в группе. */
export const LEAGUE_GROUP_SIZE = 50;

/** Доля группы, уходящая вверх и вниз (но не больше десяти человек). */
const PROMOTE_SHARE = 0.2;
const DEMOTE_SHARE = 0.2;
const MOVE_CAP = 10;

/** Сколько мест в группе размера n двигаются вверх или вниз. */
export function moveCount(size: number, share: number): number {
  return Math.min(MOVE_CAP, Math.max(1, Math.floor(size * share)));
}

/** Живой счёт недели: заработано с момента входа в группу. */
const liveScore = (member: Pick<User, 'totalEarned' | 'leagueStartEarned'>): bigint =>
  member.totalEarned - member.leagueStartEarned;

/**
 * Итоговый счёт участника завершённой недели.
 *
 * Кто уже перекатился в новую неделю — заморозил итог в leagueLastScore;
 * у остальных totalEarned не менялся с конца недели, и живой счёт равен
 * итоговому.
 */
const finalScore = (
  member: Pick<User, 'totalEarned' | 'leagueStartEarned' | 'leagueWeek' | 'leagueLastScore'>,
  currentWeek: number,
): bigint => (member.leagueWeek === currentWeek ? member.leagueLastScore : liveScore(member));

/** Куда игрок ушёл по итогам недели. */
export type LeagueOutcome = 'up' | 'stay' | 'down';

/**
 * Судит место игрока в его завершённой группе.
 *
 * Группа после конца недели заморожена по составу, поэтому решение
 * детерминировано и не зависит от того, кто из членов уже перекатился.
 */
async function judgeLastWeek(user: User, currentWeek: number): Promise<LeagueOutcome> {
  if (!user.leagueGroupId) {
    return 'stay';
  }

  // Кто уже перекатился — ушёл в новую группу, но оставил след в
  // leagueLastGroupId и итог в leagueLastScore. Собираем обе половины.
  const members = await prisma.user.findMany({
    where: {
      OR: [
        { leagueGroupId: user.leagueGroupId },
        { leagueLastGroupId: user.leagueGroupId },
      ],
    },
    select: {
      id: true,
      totalEarned: true,
      leagueStartEarned: true,
      leagueWeek: true,
      leagueLastScore: true,
    },
  });

  const mine = liveScore(user);
  const scores = members.map((member) =>
    member.id === user.id ? mine : finalScore(member as User, currentWeek),
  );

  // Место: сколько человек заработали строго больше. Ничьи делят место —
  // обе стороны получают лучший исход, спорить тут не о чем.
  const above = scores.filter((score) => score > mine).length;
  const place = above + 1;
  const size = members.length;

  if (mine > 0n && place <= moveCount(size, PROMOTE_SHARE)) {
    return user.leagueTier < LEAGUE_TIERS.length - 1 ? 'up' : 'stay';
  }

  if (user.leagueTier > 0 && place > size - moveCount(size, DEMOTE_SHARE)) {
    return 'down';
  }

  return 'stay';
}

/** Находит или создаёт группу недели для лиги с местом внутри. */
async function assignGroup(week: number, tier: number): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const open = await prisma.leagueGroup.findFirst({
      where: { weekNumber: week, tier, memberCount: { lt: LEAGUE_GROUP_SIZE } },
      orderBy: { createdAt: 'asc' },
    });

    if (open) {
      // Место занимается условием: две одновременные посадки не переполнят
      // группу, проигравший просто попробует следующую.
      const seated = await prisma.leagueGroup.updateMany({
        where: { id: open.id, memberCount: { lt: LEAGUE_GROUP_SIZE } },
        data: { memberCount: { increment: 1 } },
      });

      if (seated.count > 0) {
        return open.id;
      }

      continue;
    }

    const created = await prisma.leagueGroup.create({
      data: { weekNumber: week, tier, memberCount: 1 },
    });

    return created.id;
  }

  // Три гонки подряд — создаём свою группу и не спорим.
  const fallback = await prisma.leagueGroup.create({
    data: { weekNumber: week, tier, memberCount: 1 },
  });

  return fallback.id;
}

/**
 * Перекатывает игрока в текущую неделю лиги, если он ещё не там.
 *
 * Возвращает обновлённого игрока. Ошибки глотаются: лига — украшение
 * входа, а не его условие.
 */
export async function ensureLeague(user: User, now: Date): Promise<User> {
  const week = weekNumber(now);

  if (user.leagueWeek === week) {
    return user;
  }

  try {
    // Итог прошлой недели судится только если игрок в ней играл; после
    // перерыва в несколько недель лига просто сохраняется.
    const outcome =
      user.leagueGroupId && user.leagueWeek === weekNumber(new Date(weekStartUtc(now).getTime() - 86_400_000))
        ? await judgeLastWeek(user, week)
        : 'stay';

    const tier =
      outcome === 'up'
        ? Math.min(user.leagueTier + 1, LEAGUE_TIERS.length - 1)
        : outcome === 'down'
          ? Math.max(user.leagueTier - 1, 0)
          : user.leagueTier;

    const groupId = await assignGroup(week, tier);

    return await prisma.user.update({
      where: { id: user.id },
      data: {
        leagueWeek: week,
        leagueTier: tier,
        leagueGroupId: groupId,
        leagueLastGroupId: user.leagueGroupId,
        leagueStartEarned: user.totalEarned,
        leagueLastScore: liveScore(user),
        leagueLastOutcome: outcome,
      },
    });
  } catch (error) {
    console.warn('[league] перекат не удался', error);

    return user;
  }
}

export interface LeagueView {
  tier: number;
  tierTitle: string;
  tiersTotal: number;
  endsAt: Date;
  promoteCount: number;
  demoteCount: number;
  /** Итог прошлой недели — клиент показывает строку под заголовком. */
  lastOutcome: LeagueOutcome | null;
  myPlace: number;
  standings: { name: string; earned: string; isMe: boolean }[];
}

/** Таблица группы глазами игрока. Игрок уже перекатан в текущую неделю. */
export async function leagueView(user: User, now: Date): Promise<LeagueView | null> {
  if (!user.leagueGroupId) {
    return null;
  }

  const members = await prisma.user.findMany({
    where: { leagueGroupId: user.leagueGroupId },
    select: {
      id: true,
      firstName: true,
      username: true,
      totalEarned: true,
      leagueStartEarned: true,
    },
  });

  const rows = members
    .map((member) => ({
      name: actorName(member),
      earned: liveScore(member),
      isMe: member.id === user.id,
    }))
    .sort((a, b) => (a.earned === b.earned ? 0 : a.earned > b.earned ? -1 : 1));

  const size = rows.length;

  return {
    tier: user.leagueTier,
    tierTitle: LEAGUE_TIERS[user.leagueTier] ?? LEAGUE_TIERS[0],
    tiersTotal: LEAGUE_TIERS.length,
    endsAt: new Date(weekStartUtc(now).getTime() + 7 * 86_400_000),
    promoteCount: user.leagueTier < LEAGUE_TIERS.length - 1 ? moveCount(size, PROMOTE_SHARE) : 0,
    demoteCount: user.leagueTier > 0 ? moveCount(size, DEMOTE_SHARE) : 0,
    lastOutcome: (user.leagueLastOutcome as LeagueOutcome | null) ?? null,
    myPlace: rows.findIndex((row) => row.isMe) + 1,
    standings: rows.map((row) => ({
      name: row.name,
      earned: row.earned.toString(),
      isMe: row.isMe,
    })),
  };
}
