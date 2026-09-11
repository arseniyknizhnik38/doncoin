export interface RankView {
  id: string;
  /** Латиницей — для подписи прогресса. */
  code: string;
  title: string;
  /** Звезда внутри ранга: 1..3. */
  star: number;
  /** Всего звёзд у ранга — рисуем и погашенные. */
  stars: number;
  /** Порядковый номер ступени, 0..17. */
  step: number;
  canJoinClan: boolean;
  unlocks: string | null;
  minBalance: string;
  next: {
    id: string;
    code: string;
    title: string;
    star: number;
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
  /** Сколько энергии стоит один тап. */
  energyPerTap: number;
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
