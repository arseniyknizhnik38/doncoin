export interface AdminStats {
  players: {
    total: number;
    newToday: number;
    newWeek: number;
    dau: number;
    wau: number;
    returnedNextDay: number;
    eligibleForReturn: number;
  };
  /** Удержание N-го дня по когортам. */
  retention: {
    day: number;
    eligible: number;
    returned: number;
    /** null — считать ещё не на ком. */
    percent: number | null;
  }[];
  /** Приток и активность по дням за две недели. */
  days: {
    day: number;
    /** Сколько дней назад: 0 — сегодня. */
    ago: number;
    newPlayers: number;
    activePlayers: number;
  }[];
  funnel: {
    boughtUpgrade: number;
    boughtBusiness: number;
    joinedClan: number;
    claimedDaily: number;
    cameFromReferral: number;
    completedFavor: number;
  };
  economy: {
    inCirculation: string;
    totalEarned: string;
    richest: string;
    clans: number;
  };
  top: { name: string; totalEarned: string; lastSeenAt: string }[];
}
