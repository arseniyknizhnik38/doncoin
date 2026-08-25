export interface UpgradeView {
  id: 'tap' | 'energy' | 'regen';
  title: string;
  description: string;
  level: number;
  maxLevel: number;
  current: string;
  next: string | null;
  price: string | null;
  affordable: boolean;
}
