import { resolveRank } from '../config/ranks.js';
import type { User } from '../generated/prisma/client.js';

/** Ограничения на название клана. */
export const CLAN_NAME_MIN = 3;
export const CLAN_NAME_MAX = 24;

/** Сколько кланов показываем в списке. */
export const CLAN_LIST_LIMIT = 30;

export type ClanErrorCode =
  | 'RANK_TOO_LOW'
  | 'ALREADY_IN_CLAN'
  | 'NOT_IN_CLAN'
  | 'CLAN_NOT_FOUND'
  | 'BAD_NAME'
  | 'NAME_TAKEN'
  | 'OWNER_MUST_DISBAND'
  | 'BAD_AMOUNT'
  | 'NOT_ENOUGH_COINS'
  | 'WAR_IN_PROGRESS';

export class ClanError extends Error {
  constructor(
    readonly code: ClanErrorCode,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'ClanError';
  }
}

/** Кланы открываются с ранга «солдат» — порог задан в config/ranks.ts. */
export function assertCanJoinClans(user: User): void {
  if (!resolveRank(user.totalEarned).canJoinClan) {
    throw new ClanError(
      'RANK_TOO_LOW',
      'Кланы открываются с ранга «Солдат»',
      403,
    );
  }
}

/** Приводит название к каноническому виду и проверяет его. */
export function normalizeClanName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ClanError('BAD_NAME', 'Ожидалось название клана', 400);
  }

  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length < CLAN_NAME_MIN || name.length > CLAN_NAME_MAX) {
    throw new ClanError(
      'BAD_NAME',
      `Название должно быть от ${CLAN_NAME_MIN} до ${CLAN_NAME_MAX} символов`,
      400,
    );
  }

  return name;
}

export function parseDonation(raw: unknown, balance: bigint): bigint {
  const amount =
    typeof raw === 'number' && Number.isInteger(raw) && raw > 0
      ? BigInt(raw)
      : null;

  if (amount === null) {
    throw new ClanError('BAD_AMOUNT', 'Ожидалась сумма взноса (целое число > 0)', 400);
  }

  if (amount > balance) {
    throw new ClanError('NOT_ENOUGH_COINS', 'Недостаточно монет для взноса');
  }

  return amount;
}
