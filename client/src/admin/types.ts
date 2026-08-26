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
