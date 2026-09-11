export interface QuestView {
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

export interface ChestView {
  /** Все три выполнены и сундук ещё не забран. */
  ready: boolean;
  claimed: boolean;
  rewardCoins: string;
  rewardRespect: number;
}

export interface QuestsState {
  quests: QuestView[];
  chest: ChestView;
  /** Сколько секунд до смены заданий. */
  resetInSeconds: number;
}
