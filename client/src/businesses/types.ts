export interface BusinessView {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  level: number;
  incomePerHour: string;
  nextIncomePerHour: string;
  nextCost: string;
  affordable: boolean;
  owned: boolean;
  /** Ранг ещё не дорос — бизнес виден, но купить нельзя. */
  locked: boolean;
  /** Ступень ранга, с которой бизнес открывается. */
  requiredRank: string;
}

export interface BusinessIncome {
  perHour: string;
  pending: string;
  /** Касса переполнена — дальше доход не копится. */
  full: boolean;
}
