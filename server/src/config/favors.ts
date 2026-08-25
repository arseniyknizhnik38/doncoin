/**
 * Еженедельные поручения. Каталог задаётся здесь и заливается seed-скриптом
 * на текущую неделю.
 */

export interface FavorSeed {
  title: string;
  channelName: string;
  channelUrl: string;
  /** Технический ID канала — для будущей проверки подписки. */
  channelChatId: string;
  rewardDonc: bigint;
  familyXpReward: number;
}

/**
 * Номер недели: ГОД*100 + номер недели по ISO.
 *
 * Просто «номер недели в году» повторялся бы каждый год и однажды поднял бы
 * прошлогодние поручения, поэтому в число зашит и год.
 */
export function weekNumber(date: Date): number {
  // ISO-неделя: четверг той же недели определяет год.
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));

  return target.getUTCFullYear() * 100 + week;
}

export const FAVOR_CATALOG: readonly FavorSeed[] = [
  {
    title: 'Проверь, что пришло с той стороны границы',
    channelName: 'Матрёшка Экспресс 🪆',
    channelUrl: 'https://t.me/matryoshkaexpress',
    // У публичных каналов Bot API принимает @username как chat_id — значит
    // будущая проверка подписки заработает без выяснения числового ID.
    channelChatId: '@matryoshkaexpress',
    rewardDonc: 50_000n,
    familyXpReward: 20,
  },
  {
    title: 'Загляни к партнёрам',
    channelName: 'DONCOIN News',
    channelUrl: 'https://t.me/doncoin_news',
    channelChatId: '-1000000000001',
    rewardDonc: 25_000n,
    familyXpReward: 10,
  },
  {
    title: 'Послушай, что говорят на улице',
    channelName: 'Crypto Street',
    channelUrl: 'https://t.me/crypto_street',
    channelChatId: '-1000000000002',
    rewardDonc: 30_000n,
    familyXpReward: 12,
  },
  {
    title: 'Наведайся к друзьям семьи',
    channelName: 'Mafia Games Hub',
    channelUrl: 'https://t.me/mafia_games_hub',
    channelChatId: '-1000000000003',
    rewardDonc: 40_000n,
    familyXpReward: 15,
  },
  {
    title: 'Проверь новый район',
    channelName: 'TON Deals',
    channelUrl: 'https://t.me/ton_deals',
    channelChatId: '-1000000000004',
    rewardDonc: 50_000n,
    familyXpReward: 20,
  },
];
