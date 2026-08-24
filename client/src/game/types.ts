export interface GameState {
  /** BigInt с сервера приходит строкой. */
  balance: string;
  energy: number;
  energyMax: number;
  energyPerSecond: number;
  coinsPerTap: number;
}

export interface TapResponse {
  accepted: number;
  awarded: number;
  state: GameState;
}
