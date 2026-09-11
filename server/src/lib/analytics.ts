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
