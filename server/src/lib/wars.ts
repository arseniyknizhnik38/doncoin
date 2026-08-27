import { weekNumber } from '../config/favors.js';
import { clanPower } from '../config/perks.js';
import {
  MIN_CLANS_FOR_WAR,
  WAR_MEMBER_REWARD_PERCENT,
  WAR_WIN_XP,
  lootAmount,
  warWindow,
} from '../config/wars.js';
import { prisma } from './prisma.js';
import type { ClanWar } from '../generated/prisma/client.js';

/**
 * Клановые войны.
 *
 * Ключевое решение: пока война идёт, её счёт нигде не хранится. На старте для
 * каждого участника пишется слепок его totalEarned, а текущий вклад — это
 * разница между сегодняшним totalEarned и слепком. Из этого следует три
 * приятных свойства:
 *
 *   1. тап остаётся одним UPDATE — война не добавляет ни одной записи;
 *   2. счёт физически не может разойтись с балансами игроков;
 *   3. вклад учитывает любой доход — тапы, бизнесы, бонусы, поручения.
 *
 * При выходе из клана и при закрытии войны вклад «замораживается» в
 * frozenEarned — дальше он уже не растёт.
 */

/** Незамороженный вклад считается на лету, замороженный берётся как есть. */
const CONTRIBUTION_SQL =
  'COALESCE(e."frozenEarned", GREATEST(u."totalEarned" - e."startTotal", 0))';

/** Клиент Prisma или транзакция — операции ниже работают и там, и там. */
type Db = Pick<typeof prisma, '$queryRawUnsafe' | '$executeRawUnsafe'>;

interface ScoreRow {
  clanId: string;
  score: string;
}

/** Текущий счёт войны по кланам. */
async function scoreByClan(db: Db, warId: string): Promise<Map<string, bigint>> {
  // SUM по bigint возвращается как numeric — приводим к тексту, чтобы не
  // потерять точность на большом счёте.
  const rows = await db.$queryRawUnsafe<ScoreRow[]>(
    `SELECT e."clanId" AS "clanId",
            COALESCE(SUM(${CONTRIBUTION_SQL}), 0)::text AS score
       FROM "ClanWarEntry" e
       JOIN "User" u ON u.id = e."userId"
      WHERE e."warId" = $1
      GROUP BY e."clanId"`,
    warId,
  );

  return new Map(rows.map((row) => [row.clanId, BigInt(row.score)]));
}

export interface WarFighter {
  firstName: string | null;
  username: string | null;
  earned: string;
  /** Игрок вышел из клана — его вклад заморожен. */
  left: boolean;
}

/** Вклад каждого участника одной из сторон, от большего к меньшему. */
async function fightersOf(db: Db, warId: string, clanId: string): Promise<WarFighter[]> {
  return db.$queryRawUnsafe<WarFighter[]>(
    `SELECT u."firstName" AS "firstName",
            u.username AS username,
            ${CONTRIBUTION_SQL}::text AS earned,
            (e."frozenEarned" IS NOT NULL) AS left
       FROM "ClanWarEntry" e
       JOIN "User" u ON u.id = e."userId"
      WHERE e."warId" = $1 AND e."clanId" = $2
      ORDER BY ${CONTRIBUTION_SQL} DESC
      LIMIT 30`,
    warId,
    clanId,
  );
}

/**
 * Замораживает вклад игрока: он выходит из клана, но заработанное за войну
 * остаётся стороне, за которую он воевал. Иначе выход в последний день
 * обнулял бы вклад и портил счёт соклановцам.
 */
export async function freezeWarEntries(db: Db, userId: string): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE "ClanWarEntry" e
        SET "frozenEarned" = GREATEST(u."totalEarned" - e."startTotal", 0)
       FROM "User" u, "ClanWar" w
      WHERE u.id = e."userId"
        AND w.id = e."warId"
        AND e."userId" = $1
        AND e."frozenEarned" IS NULL
        AND w.status = 'active'`,
    userId,
  );
}

/** Записывает игрока в идущую войну его нового клана — со слепком «с нуля». */
export async function enlistInActiveWar(
  clanId: string,
  userId: string,
  totalEarned: bigint,
): Promise<void> {
  const war = await prisma.clanWar.findFirst({
    where: { status: 'active', OR: [{ clanAId: clanId }, { clanBId: clanId }] },
    select: { id: true },
  });

  if (!war) {
    return;
  }

  // Пришедший в середине войны не приносит с собой прошлый заработок: слепок
  // снимается сейчас, поэтому в счёт идёт только то, что он заработает дальше.
  await prisma.clanWarEntry.upsert({
    where: { warId_userId: { warId: war.id, userId } },
    create: { warId: war.id, clanId, userId, startTotal: totalEarned },
    update: {},
  });
}

/**
 * Подводит итоги войны. Всё внутри одной транзакции: сначала война
 * «захватывается» переводом в finished (кто не успел — выходит ни с чем),
 * затем замораживаются вклады, и только потом считается счёт — так он
 * гарантированно не поедет посреди расчёта.
 */
async function settleWar(war: ClanWar, now: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.clanWar.updateMany({
      where: { id: war.id, status: 'active' },
      data: { status: 'finished', finishedAt: now },
    });

    if (claimed.count === 0) {
      // Другой запрос или крон закрыли войну раньше — здесь делать нечего.
      return false;
    }

    await tx.$executeRawUnsafe(
      `UPDATE "ClanWarEntry" e
          SET "frozenEarned" = GREATEST(u."totalEarned" - e."startTotal", 0)
         FROM "User" u
        WHERE u.id = e."userId"
          AND e."warId" = $1
          AND e."frozenEarned" IS NULL`,
      war.id,
    );

    const scores = await scoreByClan(tx, war.id);
    const scoreA = scores.get(war.clanAId) ?? 0n;
    const scoreB = scores.get(war.clanBId) ?? 0n;

    // Ничья (в том числе обоюдный ноль) — без победителя и без добычи.
    const winnerId =
      scoreA === scoreB ? null : scoreA > scoreB ? war.clanAId : war.clanBId;
    const loserId =
      winnerId === null ? null : winnerId === war.clanAId ? war.clanBId : war.clanAId;

    let paid = 0n;

    if (winnerId && loserId) {
      const loser = await tx.clan.findUnique({
        where: { id: loserId },
        select: { treasury: true },
      });

      paid = lootAmount(loser?.treasury ?? 0n);

      if (paid > 0n) {
        // decrement, а не запись готового числа: параллельный взнос в казну
        // от этого не потеряется.
        await tx.clan.update({
          where: { id: loserId },
          data: { treasury: { decrement: paid } },
        });
      }

      await tx.clan.update({
        where: { id: winnerId },
        data: { treasury: { increment: paid }, familyXp: { increment: WAR_WIN_XP } },
      });

      // Личные награды победителям — одним запросом на весь клан. Условие
      // u."clanId" = $2 отсекает ушедших: их вклад войне засчитан, но денег
      // семьи тот, кто из неё вышел, не получает.
      await tx.$executeRawUnsafe(
        `UPDATE "User" u
            SET balance = u.balance + e."frozenEarned" * $3::bigint / 100,
                "totalEarned" = u."totalEarned" + e."frozenEarned" * $3::bigint / 100,
                "updatedAt" = now()
           FROM "ClanWarEntry" e
          WHERE e."userId" = u.id
            AND e."warId" = $1
            AND e."clanId" = $2
            AND u."clanId" = $2
            AND e."frozenEarned" > 0`,
        war.id,
        winnerId,
        WAR_MEMBER_REWARD_PERCENT,
      );
    }

    await tx.clanWar.update({
      where: { id: war.id },
      data: { scoreA, scoreB, winnerId, potPaid: paid },
    });

    return true;
  });
}

/**
 * Закрывает войны, у которых вышел срок. Вызывается и по расписанию, и при
 * открытии экрана клана: планировщик на бесплатном тарифе ходит раз в сутки,
 * и без ленивого закрытия игрок увидел бы «идущую» войну, которая давно
 * кончилась.
 */
export async function settleDueWars(now: Date, clanId?: string): Promise<number> {
  const due = await prisma.clanWar.findMany({
    where: {
      status: 'active',
      endsAt: { lte: now },
      ...(clanId ? { OR: [{ clanAId: clanId }, { clanBId: clanId }] } : {}),
    },
    take: 20,
  });

  let settled = 0;

  for (const war of due) {
    if (await settleWar(war, now)) {
      settled += 1;
    }
  }

  return settled;
}

export interface StartReport {
  created: number;
  skipped: string | null;
  byeClan: string | null;
}

/**
 * Составляет пары на текущую неделю. Кланы сортируются по силе и бьются на
 * пары соседями — так сильный не встречается с только что созданным. При
 * нечётном числе кланов слабейший пропускает неделю.
 */
export async function startWarsForWeek(now: Date): Promise<StartReport> {
  const week = weekNumber(now);
  const window = warWindow(now, week);

  const clans = await prisma.clan.findMany({
    select: { id: true, name: true, treasury: true, familyXp: true },
  });

  if (clans.length < MIN_CLANS_FOR_WAR) {
    return { created: 0, skipped: 'not-enough-clans', byeClan: null };
  }

  // Кланы, уже расписанные на эту неделю, пропускаем: так функция безопасна
  // при повторном вызове и заодно подхватывает кланы, созданные позже.
  const scheduled = await prisma.clanWar.findMany({
    where: { weekNumber: week },
    select: { clanAId: true, clanBId: true },
  });

  const busy = new Set(scheduled.flatMap((war) => [war.clanAId, war.clanBId]));
  const pool = clans
    .filter((clan) => !busy.has(clan.id))
    .sort((a, b) => {
      const diff = clanPower(b) - clanPower(a);
      return diff > 0n ? 1 : diff < 0n ? -1 : a.id.localeCompare(b.id);
    });

  if (pool.length < MIN_CLANS_FOR_WAR) {
    return { created: 0, skipped: 'already-scheduled', byeClan: null };
  }

  const bye = pool.length % 2 === 1 ? pool[pool.length - 1] : null;
  const pairs: [string, string][] = [];

  for (let i = 0; i + 1 < pool.length; i += 2) {
    pairs.push([pool[i].id, pool[i + 1].id]);
  }

  const fighters = await prisma.user.findMany({
    where: { clanId: { in: pairs.flat() } },
    select: { id: true, clanId: true, totalEarned: true },
  });

  let created = 0;

  for (const [clanAId, clanBId] of pairs) {
    try {
      await prisma.$transaction(async (tx) => {
        const war = await tx.clanWar.create({
          data: {
            weekNumber: week,
            clanAId,
            clanBId,
            startedAt: window.startedAt,
            endsAt: window.endsAt,
          },
        });

        await tx.clanWarEntry.createMany({
          data: fighters
            .filter((user) => user.clanId === clanAId || user.clanId === clanBId)
            .map((user) => ({
              warId: war.id,
              clanId: user.clanId as string,
              userId: user.id,
              startTotal: user.totalEarned,
            })),
        });
      });

      created += 1;
    } catch (error) {
      // Уникальный индекс (неделя, клан) — значит пару успели создать
      // параллельно. Это не ошибка, просто пропускаем.
      if ((error as { code?: string }).code !== 'P2002') {
        throw error;
      }
    }
  }

  return { created, skipped: null, byeClan: bye?.name ?? null };
}

export interface WarSideView {
  id: string;
  name: string;
  score: string;
}

export interface CurrentWarView {
  id: string;
  endsAt: Date;
  me: WarSideView;
  rival: WarSideView;
  /** Мой личный вклад в счёт семьи. */
  myEarned: string;
  fighters: WarFighter[];
}

export interface WarResultView {
  id: string;
  finishedAt: Date | null;
  rivalName: string;
  myScore: string;
  rivalScore: string;
  outcome: 'win' | 'loss' | 'draw';
  /** Сколько монет перешло из казны в казну. */
  potPaid: string;
}

export interface WarView {
  current: CurrentWarView | null;
  last: WarResultView | null;
}

const warSides = {
  clanA: { select: { id: true, name: true } },
  clanB: { select: { id: true, name: true } },
} as const;

/** Что показать на экране клана: идущая война и итог прошлой. */
export async function describeWar(clanId: string, userId: string): Promise<WarView> {
  const [active, finished] = await Promise.all([
    prisma.clanWar.findFirst({
      where: { status: 'active', OR: [{ clanAId: clanId }, { clanBId: clanId }] },
      include: warSides,
    }),
    prisma.clanWar.findFirst({
      where: { status: 'finished', OR: [{ clanAId: clanId }, { clanBId: clanId }] },
      orderBy: { finishedAt: 'desc' },
      include: warSides,
    }),
  ]);

  let current: CurrentWarView | null = null;

  if (active) {
    const iAmA = active.clanAId === clanId;
    const myClan = iAmA ? active.clanA : active.clanB;
    const rivalClan = iAmA ? active.clanB : active.clanA;

    const [scores, myEntry, fighters] = await Promise.all([
      scoreByClan(prisma, active.id),
      prisma.$queryRawUnsafe<{ earned: string }[]>(
        `SELECT ${CONTRIBUTION_SQL}::text AS earned
           FROM "ClanWarEntry" e
           JOIN "User" u ON u.id = e."userId"
          WHERE e."warId" = $1 AND e."userId" = $2`,
        active.id,
        userId,
      ),
      fightersOf(prisma, active.id, clanId),
    ]);

    current = {
      id: active.id,
      endsAt: active.endsAt,
      me: {
        id: myClan.id,
        name: myClan.name,
        score: (scores.get(myClan.id) ?? 0n).toString(),
      },
      rival: {
        id: rivalClan.id,
        name: rivalClan.name,
        score: (scores.get(rivalClan.id) ?? 0n).toString(),
      },
      myEarned: myEntry[0]?.earned ?? '0',
      fighters,
    };
  }

  let last: WarResultView | null = null;

  if (finished) {
    const iAmA = finished.clanAId === clanId;
    const myScore = iAmA ? finished.scoreA : finished.scoreB;
    const rivalScore = iAmA ? finished.scoreB : finished.scoreA;
    const rivalClan = iAmA ? finished.clanB : finished.clanA;

    last = {
      id: finished.id,
      finishedAt: finished.finishedAt,
      rivalName: rivalClan.name,
      myScore: myScore.toString(),
      rivalScore: rivalScore.toString(),
      outcome:
        finished.winnerId === null
          ? 'draw'
          : finished.winnerId === clanId
            ? 'win'
            : 'loss',
      potPaid: finished.potPaid.toString(),
    };
  }

  return { current, last };
}

/** Идёт ли у клана война — нужно, чтобы не дать распустить клан посреди неё. */
export async function hasActiveWar(clanId: string): Promise<boolean> {
  const war = await prisma.clanWar.findFirst({
    where: { status: 'active', OR: [{ clanAId: clanId }, { clanBId: clanId }] },
    select: { id: true },
  });

  return war !== null;
}
