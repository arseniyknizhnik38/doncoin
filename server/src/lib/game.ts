import type { User } from '../generated/prisma/client.js';
import { type RankView, resolveRank } from '../config/ranks.js';
import { prisma } from './prisma.js';

/** Максимум тапов в одном запросе — клиент шлёт их пачками. */
export const MAX_TAPS_PER_REQUEST = 50;

/**
 * Сколько тапов даёт одну единицу Respect.
 *
 * Начисление детерминированное, а не «шанс с каждого тапа»: тапы приходят
 * пачками до 50 штук, и случайный бросок на пачку давал бы другое
 * распределение, чем бросок на каждый тап. Остаток хранится в
 * respectProgress, поэтому результат не зависит от размера пачки и от того,
 * закрыл ли игрок приложение посреди серии.
 *
 * Respect намеренно не зависит от апгрейдов: DONC растёт от прокачки,
 * а Respect измеряет только вложенный труд.
 */
export const TAPS_PER_RESPECT = 50;

export interface GameState {
  balance: string;
  /** Заработано за всё время — на этом строится ранг. */
  totalEarned: string;
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
  respect: number;
  /** Тапов накоплено в счёт следующей единицы Respect. */
  respectProgress: number;
  /** Сколько тапов нужно на одну единицу Respect. */
  tapsPerRespect: number;
  /** Ранг вычисляется из баланса, в базе не хранится. */
  rank: RankView;
}

interface EnergySnapshot {
  energy: number;
  /** Новое значение energyUpdatedAt с сохранением незавершённой секунды. */
  energyUpdatedAt: Date;
}

/**
 * Пересчитывает энергию на момент `now`. Остаток неполной секунды не теряется:
 * energyUpdatedAt сдвигается ровно на количество начисленных секунд.
 */
export function regenerateEnergy(user: User, now: Date): EnergySnapshot {
  const elapsedMs = now.getTime() - user.energyUpdatedAt.getTime();

  if (elapsedMs <= 0) {
    return { energy: user.energy, energyUpdatedAt: user.energyUpdatedAt };
  }

  const ticks = Math.floor(elapsedMs / 1000);
  const energy = Math.min(user.energyMax, user.energy + ticks * user.energyPerSecond);

  return {
    energy,
    energyUpdatedAt:
      energy >= user.energyMax
        ? now
        : new Date(user.energyUpdatedAt.getTime() + ticks * 1000),
  };
}

export function toGameState(user: {
  balance: bigint;
  totalEarned: bigint;
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
  respect: number;
  respectProgress: number;
}): GameState {
  return {
    // BigInt не сериализуется в JSON — отдаём строкой.
    balance: user.balance.toString(),
    totalEarned: user.totalEarned.toString(),
    energy: user.energy,
    energyMax: user.energyMax,
    energyPerSecond: user.energyPerSecond,
    coinsPerTap: user.coinsPerTap,
    respect: user.respect,
    respectProgress: user.respectProgress,
    tapsPerRespect: TAPS_PER_RESPECT,
    rank: resolveRank(user.totalEarned),
  };
}

export interface TapResult {
  state: GameState;
  /** Сколько тапов реально засчитано (могло упереться в энергию). */
  accepted: number;
  awarded: number;
  /** Сколько единиц Respect начислено этим запросом. */
  respectAwarded: number;
}

interface TapRow {
  balance: bigint;
  respectStreetLevel: number;
  totalEarned: bigint;
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
  respect: number;
  respectProgress: number;
  accepted: number;
  respectAwarded: number;
}

/**
 * Начисляет монеты за тапы. Источник правды — сервер: клиент не может
 * ни задать награду, ни потратить больше энергии, чем у него есть.
 *
 * Всё считается одним UPDATE ... RETURNING:
 *  - атомарно, поэтому параллельные тапы не теряются и не задваиваются
 *    (строка блокируется самим UPDATE);
 *  - одно обращение к базе вместо пяти у транзакции — критично, потому что
 *    каждый round-trip до Neon стоит сотни миллисекунд;
 *  - время берётся из now() самой базы, а не из часов сервера.
 *
 * Часы восстановления двигает только само восстановление: трата энергии их
 * не сбрасывает, иначе при частых тапах остаток секунды терялся бы
 * и энергия не росла вовсе.
 */
export async function applyTaps(
  telegramId: string,
  requestedTaps: number,
): Promise<TapResult | null> {
  const rows = await prisma.$queryRaw<TapRow[]>`
    WITH ticks AS (
      SELECT
        u.id,
        GREATEST(FLOOR(EXTRACT(EPOCH FROM (now() - u."energyUpdatedAt")))::int, 0) AS n
      FROM "User" u
      WHERE u."telegramId" = ${telegramId}
    ),
    calc AS (
      SELECT
        t.id,
        t.n,
        r.regen_energy,
        LEAST(${requestedTaps}::int, r.regen_energy) AS accepted,
        u."respectProgress" + LEAST(${requestedTaps}::int, r.regen_energy) AS respect_pool
      FROM ticks t
      JOIN "User" u ON u.id = t.id
      CROSS JOIN LATERAL (
        SELECT LEAST(u."energyMax", u.energy + t.n * u."energyPerSecond") AS regen_energy
      ) r
    )
    UPDATE "User" u
    SET
      energy = c.regen_energy - c.accepted,
      -- Прибавка за «Славу на улице»: 5% за уровень. Целочисленное деление
      -- округляет вниз — игрок не получит долей монеты, но и не потеряет
      -- заметного дохода.
      balance = u.balance + c.accepted::bigint * u."coinsPerTap"
        * (100 + u."respectStreetLevel" * 5) / 100,
      "totalEarned" = u."totalEarned" + c.accepted::bigint * u."coinsPerTap"
        * (100 + u."respectStreetLevel" * 5) / 100,
      -- Respect: одна единица за каждые TAPS_PER_RESPECT тапов,
      -- незавершённый остаток переносится в respectProgress.
      respect = u.respect + c.respect_pool / ${TAPS_PER_RESPECT}::int,
      "respectProgress" = c.respect_pool % ${TAPS_PER_RESPECT}::int,
      "energyUpdatedAt" = CASE
        WHEN c.regen_energy >= u."energyMax" THEN now()
        ELSE u."energyUpdatedAt" + make_interval(secs => c.n)
      END,
      "lastSeenAt" = now(),
      "updatedAt" = now()
    FROM calc c
    WHERE u.id = c.id
    RETURNING
      u.balance,
      u."respectStreetLevel" AS "respectStreetLevel",
      u."totalEarned" AS "totalEarned",
      u.energy,
      u."energyMax" AS "energyMax",
      u."energyPerSecond" AS "energyPerSecond",
      u."coinsPerTap" AS "coinsPerTap",
      u.respect,
      u."respectProgress" AS "respectProgress",
      c.accepted,
      c.respect_pool / ${TAPS_PER_RESPECT}::int AS "respectAwarded"
  `;

  const row = rows[0];

  if (!row) {
    // Пользователя ещё нет — клиент должен сначала пройти /api/auth/telegram.
    return null;
  }

  const accepted = Number(row.accepted);
  const balance = BigInt(row.balance);
  const totalEarned = BigInt(row.totalEarned);

  const tapBonus = Number(row.respectStreetLevel) * 5;

  return {
    accepted,
    awarded: Math.floor((accepted * Number(row.coinsPerTap) * (100 + tapBonus)) / 100),
    respectAwarded: Number(row.respectAwarded),
    state: {
      balance: balance.toString(),
      totalEarned: totalEarned.toString(),
      energy: Number(row.energy),
      energyMax: Number(row.energyMax),
      energyPerSecond: Number(row.energyPerSecond),
      coinsPerTap: Number(row.coinsPerTap),
      respect: Number(row.respect),
      respectProgress: Number(row.respectProgress),
      tapsPerRespect: TAPS_PER_RESPECT,
      rank: resolveRank(totalEarned),
    },
  };
}
