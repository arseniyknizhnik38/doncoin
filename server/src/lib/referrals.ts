import { randomInt } from 'node:crypto';

/** Монет пригласившему за каждого приведённого игрока. */
export const INVITER_REWARD = 5_000n;
/** Стартовый бонус тому, кто пришёл по ссылке. */
export const INVITEE_REWARD = 1_000n;

/** Без 0/O/1/I — чтобы код нельзя было перепутать при переписывании руками. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

export function generateReferralCode(): string {
  let code = '';

  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return code;
}

/** Приводит код из ссылки к каноническому виду. */
export function normalizeReferralCode(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().toUpperCase();

  return /^[A-Z0-9]{4,32}$/.test(trimmed) ? trimmed : null;
}
