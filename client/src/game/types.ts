export interface GameState {
  /** BigInt с сервера приходит строкой. */
  balance: string;
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
}

export interface TapResponse {
  accepted: number;
  awarded: number;
  respectAwarded: number;
  state: GameState;
}
