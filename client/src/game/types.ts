export interface RankView {
  id: string;
  /** Латиницей — для подписи прогресса. */
  code: string;
  title: string;
  canJoinClan: boolean;
  unlocks: string | null;
  minBalance: string;
  next: {
    id: string;
    code: string;
    title: string;
    minBalance: string;
  } | null;
}

export interface GameState {
  /** BigInt с сервера приходит строкой. */
  balance: string;
  /** Заработано за всё время — на этом строится ранг. */
  totalEarned: string;
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
  /** Медленная репутационная валюта. */
  respect: number;
  /** Тапов накоплено в счёт следующей единицы Respect. */
  respectProgress: number;
  /** Сколько тапов нужно на одну единицу Respect. */
  tapsPerRespect: number;
  /** Ранг, вычисленный сервером из баланса. */
  rank: RankView;
}

export interface TapResponse {
  accepted: number;
  awarded: number;
  respectAwarded: number;
  state: GameState;
}
