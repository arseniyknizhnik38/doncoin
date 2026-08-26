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
  clans: ClanSummary[];
}
