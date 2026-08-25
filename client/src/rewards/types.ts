export interface DailyStatus {
  available: boolean;
  /** День серии, который засчитают при получении. */
  nextStreak: number;
  reward: string;
  streak: number;
  streakCap: number;
}

export interface OfflineEarnings {
  earned: string;
  hours: number;
  /** Упёрлись в потолок накопления. */
  capped: boolean;
}
