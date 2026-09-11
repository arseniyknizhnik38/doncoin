export interface DailyStatus {
  available: boolean;
  /** День серии, который засчитают при получении. */
  nextStreak: number;
  reward: string;
  streak: number;
  streakCap: number;
  /** Сколько дней до следующей тройной награды, null — если она сегодня. */
  daysToMilestone: number | null;
  /** Сегодня платят втройне. */
  milestone: boolean;
}

export interface OfflineEarnings {
  earned: string;
  hours: number;
  /** Упёрлись в потолок накопления. */
  capped: boolean;
}
