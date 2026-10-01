import { PERK_BONUS_PER_LEVEL, applyBonus, clanBonusPercent } from '../config/perks.js';
import { dailyStatus } from '../config/rewards.js';
import type { Business, User } from '../generated/prisma/client.js';
import { levelIncome } from '../config/businesses.js';
import { ENERGY_PER_TAP } from './energy.js';
import { regenerateEnergy } from './game.js';
import { prisma } from './prisma.js';
import { actorName } from './feed.js';
import { format, pickLangStored } from '../config/i18n.js';
import { SNITCH_QUOTES, canCallSnitch } from '../config/snitch.js';

export type NotificationKind = 'snitch' | 'streak' | 'business' | 'energy';

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
  /** Имена пригласивших — для сообщения «кента подозревают». */
  inviterNameById: Map<string, string>;
}

export async function buildNotifyContext(users: User[]): Promise<NotifyContext> {
  const userIds = users.map((user) => user.id);
  const clanIds = [...new Set(users.map((user) => user.clanId).filter(Boolean))] as string[];

  const inviterIds = [
    ...new Set(users.map((user) => user.referredById).filter(Boolean)),
  ] as string[];

  const [catalog, owned, clans, inviters] = await Promise.all([
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
    inviterIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: inviterIds } },
          select: { id: true, firstName: true, username: true },
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
    inviterNameById: new Map(inviters.map((inviter) => [inviter.id, actorName(inviter)])),
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
  const bonus = user.respectBusinessLevel * PERK_BONUS_PER_LEVEL + clanBonusPercent(clan);

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
  // 0. Кент пропал на сутки — его подозревают. Это сильнее всего остального:
  // тут не монеты, а человек, который за тебя поручился.
  const inviterName = user.referredById
    ? context.inviterNameById.get(user.referredById)
    : undefined;

  if (inviterName && canCallSnitch(user, now)) {
    const quotes = SNITCH_QUOTES[pickLangStored(user.language)];
    // Цитата по часу, а не случайно: так функция остаётся чистой и
    // проверяемой, а разные прогоны всё равно дают разные строки.
    const quote = quotes[Math.floor(now.getTime() / 3_600_000) % quotes.length]!;

    return { kind: 'snitch', text: format(quote, { inviter: inviterName }) };
  }

  const lang = pickLangStored(user.language);

  // 1. Стрик сгорит: бонус за сегодня не забран, а серия уже набрана.
  const daily = dailyStatus(user, now);
  const mskHour = (now.getUTCHours() + 3) % 24;

  if (daily.available && user.dailyStreak > 0 && mskHour >= 17) {
    const streak = user.dailyStreak;
    const text =
      lang === 'zh'
        ? `连续 ${streak} 天的记录今晚午夜就要断了。快把奖励领了，别让家族觉得你凉了。`
        : lang === 'en'
          ? `Your ${streak}-day streak burns at midnight. Grab the bonus before the family decides you have gone cold.`
          : `Серия ${streak} ${plural(streak, 'день', 'дня', 'дней')} сгорит в полночь. ` +
            'Забери бонус, пока семья не решила, что ты остыл.';

    return { kind: 'streak', text };
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
      const amount = formatCoins(pending);
      const text =
        lang === 'zh'
          ? `你不在，生意照转：攒下了 ${amount} DONC。进来收账。`
          : lang === 'en'
            ? `Business ran without you: ${amount} DONC piled up. Come in and collect.`
            : `Дела шли без тебя: накопилось ${amount} DONC. Зайди и забери.`;

      return { kind: 'business', text };
    }
  }

  // 3. Энергия восстановилась полностью.
  const { energy } = regenerateEnergy(user, now);

  if (energy >= user.energyMax) {
    const taps = formatCoins(BigInt(Math.floor(user.energyMax / ENERGY_PER_TAP)));
    const text =
      lang === 'zh'
        ? `手下都歇够了：弹匣满了，${taps} 次点击等着你。该干活了。`
        : lang === 'en'
          ? `The crew is rested: the clip is full, ${taps} taps ready. Time to work.`
          : `Люди отдохнули: обойма полная, ${taps} тапов. Пора за работу.`;

    return { kind: 'energy', text };
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
