export interface ClanMember {
  firstName: string | null;
  username: string | null;
  balance: string;
  contributed: string;
  joinedAt: string | null;
  rank: string;
}

export interface MyClan {
  id: string;
  name: string;
  treasury: string;
  familyXp: number;
  level: number;
  power: string;
  bonusPercent: number;
  memberCount: number;
  isOwner: boolean;
  owner: { firstName: string | null; username: string | null };
  members: ClanMember[];
}

export interface WarFighter {
  firstName: string | null;
  username: string | null;
  earned: string;
  /** Игрок вышел из клана — его вклад заморожен. */
  left: boolean;
}

export interface WarSide {
  id: string;
  name: string;
  score: string;
}

export interface CurrentWar {
  id: string;
  endsAt: string;
  me: WarSide;
  rival: WarSide;
  myEarned: string;
  fighters: WarFighter[];
}

export interface WarResult {
  id: string;
  finishedAt: string | null;
  rivalName: string;
  myScore: string;
  rivalScore: string;
  outcome: 'win' | 'loss' | 'draw';
  potPaid: string;
}

export interface WarState {
  current: CurrentWar | null;
  last: WarResult | null;
}

export interface ClanSummary {
  id: string;
  name: string;
  treasury: string;
  memberCount: number;
}

export interface ClansData {
  canJoin: boolean;
  /** Ранг, с которого открываются кланы. */
  requiredRank: { code: string; title: string; minBalance: string };
  myClan: MyClan | null;
  /** Война семьи: идущая и итог прошлой. null — если игрок вне клана. */
  war: WarState | null;
  clans: ClanSummary[];
}
