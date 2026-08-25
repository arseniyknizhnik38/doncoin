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
}

export interface BusinessIncome {
  perHour: string;
  pending: string;
}
