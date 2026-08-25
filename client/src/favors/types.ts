export interface FavorView {
  id: string;
  title: string;
  channelName: string;
  channelUrl: string;
  rewardDonc: string;
  familyXpReward: number;
  completed: boolean;
  completedAt: string | null;
}

export interface FavorsData {
  weekNumber: number;
  favors: FavorView[];
}
