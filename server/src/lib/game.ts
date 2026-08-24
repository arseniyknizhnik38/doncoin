import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

/** Максимум тапов в одном запросе — клиент шлёт их пачками. */
export const MAX_TAPS_PER_REQUEST = 50;

export interface GameState {
  balance: string;
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
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
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
}): GameState {
  return {
    // BigInt не сериализуется в JSON — отдаём строкой.
    balance: user.balance.toString(),
    energy: user.energy,
    energyMax: user.energyMax,
    energyPerSecond: user.energyPerSecond,
    coinsPerTap: user.coinsPerTap,
  };
}

export interface TapResult {
  state: GameState;
  /** Сколько тапов реально засчитано (могло упереться в энергию). */
  accepted: number;
  awarded: number;
}

interface TapRow {
  balance: bigint;
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
  accepted: number;
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
        LEAST(u."energyMax", u.energy + t.n * u."energyPerSecond") AS regen_energy
      FROM ticks t
      JOIN "User" u ON u.id = t.id
    )
    UPDATE "User" u
    SET
      energy = c.regen_energy - LEAST(${requestedTaps}::int, c.regen_energy),
      balance = u.balance + LEAST(${requestedTaps}::int, c.regen_energy)::bigint * u."coinsPerTap",
      "energyUpdatedAt" = CASE
        WHEN c.regen_energy >= u."energyMax" THEN now()
        ELSE u."energyUpdatedAt" + make_interval(secs => c.n)
      END,
      "updatedAt" = now()
    FROM calc c
    WHERE u.id = c.id
    RETURNING
      u.balance,
      u.energy,
      u."energyMax" AS "energyMax",
      u."energyPerSecond" AS "energyPerSecond",
      u."coinsPerTap" AS "coinsPerTap",
      LEAST(${requestedTaps}::int, c.regen_energy) AS accepted
  `;

  const row = rows[0];

  if (!row) {
    // Пользователя ещё нет — клиент должен сначала пройти /api/auth/telegram.
    return null;
  }

  const accepted = Number(row.accepted);

  return {
    accepted,
    awarded: accepted * Number(row.coinsPerTap),
    state: {
      balance: BigInt(row.balance).toString(),
      energy: Number(row.energy),
      energyMax: Number(row.energyMax),
      energyPerSecond: Number(row.energyPerSecond),
      coinsPerTap: Number(row.coinsPerTap),
    },
  };
}
