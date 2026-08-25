export interface PlayerEntry {
  position: number;
  name: string;
  totalEarned: string;
  respect: number;
  rank: string;
  clan: string | null;
  isMe: boolean;
}

export interface ClanEntry {
  position: number;
  name: string;
  treasury: string;
  memberCount: number;
  isMine: boolean;
}

export interface LeaderboardData {
  players: {
    top: PlayerEntry[];
    me: { position: number; name: string; totalEarned: string; respect: number; rank: string };
  };
  clans: {
    top: ClanEntry[];
    me: { position: number; name: string; treasury: string } | null;
  };
}
