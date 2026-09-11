export interface FavorView {
  id: string;
  title: string;
  channelName: string;
  channelUrl: string;
  /** Награда, уже пересчитанная под этого игрока. */
  rewardDonc: string;
  familyXpReward: number;
  /** Сколько наград осталось у рекламодателя, null — без ограничения. */
  slotsLeft: number | null;
  completed: boolean;
  completedAt: string | null;
}

export interface FavorsData {
  favors: FavorView[];
}
