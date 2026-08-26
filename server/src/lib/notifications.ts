import { dailyStatus } from '../config/rewards.js';
import type { User } from '../generated/prisma/client.js';
import {
  loadBusinesses,
  pendingBusinessIncome,
  totalIncomePerHour,
} from './businesses.js';
import { regenerateEnergy } from './game.js';

export type NotificationKind = 'streak' | 'business' | 'energy';

export interface NotificationDraft {
  kind: NotificationKind;
  text: string;
}

/** Минимальный доход, ради которого стоит писать. */
const MIN_BUSINESS_INCOME = 1_000n;

const formatCoins = (value: bigint) => Number(value).toLocaleString('ru-RU');

/**
 * Выбирает одно сообщение — самое ценное для игрока прямо сейчас.
 *
 * Порядок неслучаен: сгорающий стрик это потеря, накопленный доход —
 * выгода, полная энергия — просто напоминание. Потери мотивируют сильнее,
 * поэтому идут первыми. Если повода нет, возвращаем null и молчим.
 */
export async function draftNotification(
  user: User,
  now: Date,
): Promise<NotificationDraft | null> {
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
  const rows = await loadBusinesses(user.id);
  const perHour = totalIncomePerHour(rows);

  if (perHour > 0n) {
    const pending = pendingBusinessIncome(user.businessCollectedAt, perHour, now);

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
