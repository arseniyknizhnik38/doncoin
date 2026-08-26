export interface PerkView {
  id: string;
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  bonus: number;
  nextBonus: number | null;
  cost: number | null;
  affordable: boolean;
}

export interface RespectBalance {
  total: number;
  spent: number;
  available: number;
}
