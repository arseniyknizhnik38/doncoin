import { utcDayNumber } from '../config/rewards.js';
import { prisma } from './prisma.js';

/**
 * Удержание и приток — две цифры, по которым видно, жива ли игра.
 *
 * DAU и WAU показывают, сколько людей сегодня в игре, но не отвечают на
 * главный вопрос: возвращаются ли те, кто пришёл. Игра, где удержание
 * второго дня ниже трети, не лечится рекламой — в неё просто доливают воду.
 */

/** На каких днях после регистрации меряем возврат. */
export const RETENTION_DAYS = [1, 3, 7, 30] as const;

export interface RetentionPoint {
  /** День после регистрации. */
  day: number;
  /** Сколько игроков успели дожить до этого дня. */
  eligible: number;
  /** Сколько из них в этот день заходили. */
  returned: number;
  /** Доля в процентах, null — если считать ещё не на ком. */
  percent: number | null;
}

interface CountRow {
  eligible: bigint;
  returned: bigint;
}

/**
 * Удержание N-го дня по всем когортам сразу.
 *
 * Считаем не «заходил ли хоть раз после регистрации», а «заходил ли именно
 * в этот день»: первое растёт само собой со временем и выглядит красиво,
 * ничего при этом не измеряя.
 *
 * В знаменателе только те, кто успел дожить до нужного дня — иначе
 * вчерашние новички занижали бы недельное удержание до нуля.
 */
export async function retention(now: Date): Promise<RetentionPoint[]> {
  const today = utcDayNumber(now);

  return Promise.all(
    RETENTION_DAYS.map(async (day) => {
      const rows = await prisma.$queryRaw<CountRow[]>`
        WITH cohort AS (
          SELECT
            u.id,
            FLOOR(EXTRACT(EPOCH FROM u."createdAt") / 86400)::int AS joined
          FROM "User" u
        )
        SELECT
          COUNT(*) AS eligible,
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM "DailyActive" a
              WHERE a."userId" = c.id AND a."dayNumber" = c.joined + ${day}::int
            )
          ) AS returned
        FROM cohort c
        WHERE c.joined + ${day}::int <= ${today}::int
      `;

      const eligible = Number(rows[0]?.eligible ?? 0);
      const returned = Number(rows[0]?.returned ?? 0);

      return {
        day,
        eligible,
        returned,
        percent: eligible > 0 ? Math.round((returned / eligible) * 100) : null,
      };
    }),
  );
}

export interface DayCount {
  /** Номер суток UTC. */
  day: number;
  /** Сколько дней назад: 0 — сегодня. */
  ago: number;
  newPlayers: number;
  activePlayers: number;
}

interface DayRow {
  day: number;
  count: bigint;
}

/**
 * Приток и активность по дням за последние две недели.
 *
 * Две недели, а не месяц: столбик с нулём за позапрошлый вторник ничего не
 * объясняет, а список становится нечитаемым на телефоне.
 */
export async function dailyCounts(now: Date, days = 14): Promise<DayCount[]> {
  const today = utcDayNumber(now);
  const from = today - days + 1;

  const [signups, actives] = await Promise.all([
    prisma.$queryRaw<DayRow[]>`
      SELECT
        FLOOR(EXTRACT(EPOCH FROM u."createdAt") / 86400)::int AS day,
        COUNT(*) AS count
      FROM "User" u
      WHERE FLOOR(EXTRACT(EPOCH FROM u."createdAt") / 86400)::int >= ${from}::int
      GROUP BY 1
    `,
    prisma.$queryRaw<DayRow[]>`
      SELECT a."dayNumber" AS day, COUNT(*) AS count
      FROM "DailyActive" a
      WHERE a."dayNumber" >= ${from}::int
      GROUP BY 1
    `,
  ]);

  const newByDay = new Map(signups.map((row) => [Number(row.day), Number(row.count)]));
  const activeByDay = new Map(actives.map((row) => [Number(row.day), Number(row.count)]));

  const result: DayCount[] = [];

  for (let day = from; day <= today; day += 1) {
    result.push({
      day,
      ago: today - day,
      newPlayers: newByDay.get(day) ?? 0,
      activePlayers: activeByDay.get(day) ?? 0,
    });
  }

  return result;
}

export interface SourceRow {
  /** Сеть: adsgram, telega… «organic» — пришли сами. */
  source: string;
  /** Площадка внутри сети, null — сеть её не передала. */
  placement: string | null;
  /** Сколько игроков пришло. */
  players: number;
  /** Сколько дошло до конверсии. */
  converted: number;
  /** Сколько вернулось на 1-й, 3-й и 7-й день. */
  d1: number;
  d3: number;
  d7: number;
  /** Знаменатель для D3: сколько успело дожить до третьего дня. */
  eligibleD3: number;
}

interface SourceSqlRow {
  source: string | null;
  placement: string | null;
  players: bigint;
  converted: bigint;
  d1: bigint;
  d3: bigint;
  d7: bigint;
  eligible_d3: bigint;
}

/**
 * Что принесла каждая площадка.
 *
 * Три числа в одной строке отвечают на весь вопрос закупки: сколько людей
 * пришло, сколько из них начало играть и сколько вернулось через два дня.
 * Площадка с тысячей приходов и нулём на третий день дороже пустой: за неё
 * заплачено, а играть там некому.
 *
 * Возвраты считаются по тем же суткам UTC, что и удержание в остальной
 * сводке, а в знаменателе D3 только те, кто успел дожить до третьего дня, —
 * иначе вчерашняя закупка выглядела бы провальной просто потому, что третий
 * день для неё ещё не наступил.
 */
export async function sourceBreakdown(now: Date, days = 30): Promise<SourceRow[]> {
  const today = utcDayNumber(now);
  const from = today - days + 1;

  const rows = await prisma.$queryRaw<SourceSqlRow[]>`
    WITH cohort AS (
      SELECT
        u.id,
        COALESCE(u."adSource", 'organic') AS source,
        u."adPlacement" AS placement,
        u."adConvertedAt" IS NOT NULL AS converted,
        FLOOR(EXTRACT(EPOCH FROM u."createdAt") / 86400)::int AS joined
      FROM "User" u
    ),
    marked AS (
      SELECT
        c.*,
        EXISTS (SELECT 1 FROM "DailyActive" a WHERE a."userId" = c.id AND a."dayNumber" = c.joined + 1) AS back1,
        EXISTS (SELECT 1 FROM "DailyActive" a WHERE a."userId" = c.id AND a."dayNumber" = c.joined + 3) AS back3,
        EXISTS (SELECT 1 FROM "DailyActive" a WHERE a."userId" = c.id AND a."dayNumber" = c.joined + 7) AS back7
      FROM cohort c
      WHERE c.joined >= ${from}::int
    )
    SELECT
      source,
      placement,
      COUNT(*) AS players,
      COUNT(*) FILTER (WHERE converted) AS converted,
      COUNT(*) FILTER (WHERE back1) AS d1,
      COUNT(*) FILTER (WHERE back3) AS d3,
      COUNT(*) FILTER (WHERE back7) AS d7,
      COUNT(*) FILTER (WHERE joined + 3 <= ${today}::int) AS eligible_d3
    FROM marked
    GROUP BY source, placement
    ORDER BY players DESC
  `;

  return rows.map((row) => ({
    source: row.source ?? 'organic',
    placement: row.placement,
    players: Number(row.players),
    converted: Number(row.converted),
    d1: Number(row.d1),
    d3: Number(row.d3),
    d7: Number(row.d7),
    eligibleD3: Number(row.eligible_d3),
  }));
}

export interface RejectionRow {
  reason: string;
  status: string;
  count: number;
}

/**
 * Почему конверсии не ушли.
 *
 * Без этой таблицы отчёт сети и наш отчёт расходятся молча: сеть показывает
 * тысячу кликов, у нас полсотни конверсий, и непонятно, кого винить. Здесь
 * видно сразу: «young-account 400» — площадка гонит свежие аккаунты,
 * «too-fast 300» — скрипты, «no-postback-url» — не настроен кабинет.
 */
export async function conversionRejections(now: Date, days = 30): Promise<RejectionRow[]> {
  const since = new Date(now.getTime() - days * 86_400_000);

  const rows = await prisma.adConversionLog.groupBy({
    by: ['status', 'reason'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  return rows
    .map((row) => ({
      reason: row.reason,
      status: row.status,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}
