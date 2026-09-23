import { randomInt } from 'node:crypto';
import { prisma } from './prisma.js';
import { REFERRAL_TICKETS, grantTickets } from './raffle.js';

/** Монет пригласившему за каждого приведённого игрока. */
export const INVITER_REWARD = 25_000n;
/** Стартовый бонус тому, кто пришёл по ссылке. */
export const INVITEE_REWARD = 10_000n;

/**
 * Сколько тапов должен сделать приглашённый, чтобы пригласивший получил
 * награду.
 *
 * Раньше награда выдавалась в момент регистрации — то есть чеканилась
 * скриптом: заведи аккаунт, открой приложение по чужой ссылке, повтори.
 * Заодно и реферальный топ показывал не тех, кто привёл живых людей, а тех,
 * у кого больше аккаунтов.
 *
 * Порог именно в тапах, а не в заработке: заработок можно набрать заданиями
 * и бонусами почти мгновенно, а тапы упираются в энергию — две тысячи тапов
 * это несколько заходов и часы восстановления. Накрутка возможна и тут, но
 * перестаёт быть бесплатной.
 */
export const REFERRAL_QUALIFY_TAPS = 2_000;

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

/**
 * Платит пригласившему, если приглашённый наконец наиграл свой порог.
 *
 * Вызывается после каждой пачки тапов, но до базы доходит ровно один раз за
 * всю жизнь игрока: пока порог не взят или награда уже выдана, функция
 * выходит сразу, без единого запроса.
 *
 * Отметка ставится условием в UPDATE, а не проверкой перед ним: две пачки
 * тапов могут прийти одновременно, и без условия обе увидели бы «ещё не
 * заплачено».
 */
export async function payReferralIfQualified(referral: {
  userId: string;
  referredById: string | null;
  rewarded: boolean;
  taps: number;
}): Promise<bigint> {
  if (
    referral.referredById === null ||
    referral.rewarded ||
    referral.taps < REFERRAL_QUALIFY_TAPS
  ) {
    return 0n;
  }

  const marked = await prisma.user.updateMany({
    where: { id: referral.userId, referralRewarded: false },
    data: { referralRewarded: true },
  });

  if (marked.count === 0) {
    return 0n;
  }

  await prisma.user.update({
    where: { id: referral.referredById },
    data: {
      balance: { increment: INVITER_REWARD },
      totalEarned: { increment: INVITER_REWARD },
      lifetimeEarned: { increment: INVITER_REWARD },
      referralEarned: { increment: INVITER_REWARD },
    },
  });

  // Билеты розыгрыша — за живого кента, а не за регистрацию: порог тапов
  // уже отсёк накрутку, дальше билетам можно доверять.
  await grantTickets(referral.referredById, 'referral', REFERRAL_TICKETS);

  return INVITER_REWARD;
}
