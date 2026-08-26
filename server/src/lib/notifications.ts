import { applyBonus, clanBonusPercent } from '../config/perks.js';
import { dailyStatus } from '../config/rewards.js';
import type { Business, User } from '../generated/prisma/client.js';
import { levelIncome } from '../config/businesses.js';
import { regenerateEnergy } from './game.js';
import { prisma } from './prisma.js';

export type NotificationKind = 'streak' | 'business' | 'energy';

export interface NotificationDraft {
  kind: NotificationKind;
  text: string;
}

/** Минимальный доход, ради которого стоит писать. */
const MIN_BUSINESS_INCOME = 1_000n;

const formatCoins = (value: bigint) => Number(value).toLocaleString('ru-RU');

/**
 * Данные, общие для всей рассылки.
 *
 * Раньше каждое сообщение тянуло каталог, бизнесы игрока и его клан —
 * три запроса на человека, 760 мс. На сотне кандидатов прогон не влезал
 * в лимит serverless-функции. Теперь всё нужное грузится тремя запросами
 * на весь пакет.
 */
export interface NotifyContext {
  catalog: Business[];
  levelsByUser: Map<string, Map<string, number>>;
  clanById: Map<string, { treasury: bigint; familyXp: number }>;
}

export async function buildNotifyContext(users: User[]): Promise<NotifyContext> {
  const userIds = users.map((user) => user.id);
  const clanIds = [...new Set(users.map((user) => user.clanId).filter(Boolean))] as string[];

  const [catalog, owned, clans] = await Promise.all([
    prisma.business.findMany(),
    userIds.length > 0
      ? prisma.userBusiness.findMany({ where: { userId: { in: userIds } } })
      : [],
    clanIds.length > 0
      ? prisma.clan.findMany({
          where: { id: { in: clanIds } },
          select: { id: true, treasury: true, familyXp: true },
        })
      : [],
  ]);

  const levelsByUser = new Map<string, Map<string, number>>();

  for (const row of owned) {
    const levels = levelsByUser.get(row.userId) ?? new Map<string, number>();
    levels.set(row.businessId, row.level);
    levelsByUser.set(row.userId, levels);
  }

  return {
    catalog,
    levelsByUser,
    clanById: new Map(clans.map((clan) => [clan.id, clan])),
  };
}

/** Доход бизнесов игрока в час, уже с прибавками. */
function businessIncomePerHour(user: User, context: NotifyContext): bigint {
  const levels = context.levelsByUser.get(user.id);

  if (!levels) {
    return 0n;
  }

  const base = context.catalog.reduce(
    (sum, business) => sum + levelIncome(business, levels.get(business.id) ?? 0),
    0n,
  );

  const clan = user.clanId ? (context.clanById.get(user.clanId) ?? null) : null;
  const bonus = user.respectBusinessLevel * 5 + clanBonusPercent(clan);

  return applyBonus(base, bonus);
}

/**
 * Выбирает одно сообщение — самое ценное для игрока прямо сейчас.
 *
 * Порядок неслучаен: сгорающий стрик это потеря, накопленный доход —
 * выгода, полная энергия — просто напоминание. Потери мотивируют сильнее,
 * поэтому идут первыми. Если повода нет, возвращаем null и молчим.
 */
export function draftNotification(
  user: User,
  now: Date,
  context: NotifyContext,
): NotificationDraft | null {
  // 1. Стрик сгорит: бонус за сегодня не забран, а серия уже набрана.
  const daily = dailyStatus(user, now);
  const mskHour = (now.getUTCHours() + 3) % 24;

  if (daily.available && user.dailyStreak > 0 && mskHour >= 17) {
    return {
      kind: 'streak',
      text:
        `Серия ${user.dailyStreak} ${plural(user.dailyStreak, 'день', 'дня', 'дней')} сгорит в полночь. ` +
        'Забери бонус, пока семья не решила, что ты остыл.',
    };
  }

  // 2. Бизнесы накопили заметную сумму.
  const perHour = businessIncomePerHour(user, context);

  if (perHour > 0n) {
    const hours = Math.max(
      0,
      (now.getTime() - user.businessCollectedAt.getTime()) / 3_600_000,
    );
    const pending = BigInt(Math.floor(Number(perHour) * hours));

    if (pending >= MIN_BUSINESS_INCOME) {
      return {
        kind: 'business',
        text: `Дела шли без тебя: накопилось ${formatCoins(pending)} DONC. Зайди и забери.`,
      };
    }
  }

  // 3. Энергия восстановилась полностью.
  const { energy } = regenerateEnergy(user, now);

  if (energy >= user.energyMax) {
    return {
      kind: 'energy',
      text: `Люди отдохнули: энергия полная, ${formatCoins(BigInt(user.energyMax))}. Пора за работу.`,
    };
  }

  return null;
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;

  return many;
}
