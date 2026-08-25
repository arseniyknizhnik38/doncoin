export interface TaskView {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  rewardCoins: string;
  rewardRespect: number;
}
