export interface InvitedFriend {
  firstName: string | null;
  username: string | null;
  joinedAt: string;
  /** Друг наиграл свой порог — награда за него получена. */
  confirmed: boolean;
  /** Сколько тапов он уже сделал, но не больше порога. */
  taps: number;
}

export interface TournamentData {
  endsAt: string;
  prizes: number[];
  top: { name: string; qualified: number; isMe: boolean }[];
  my: { qualified: number; place: number | null };
  last: { place: number; name: string; tickets: number }[];
}

export interface ReferralsData {
  tournament: TournamentData;
  code: string;
  invitedCount: number;
  earned: string;
  rewards: { inviter: string; invitee: string };
  /** Сколько тапов должен сделать друг, чтобы награда пришла. */
  qualifyTaps: number;
  /** За скольких друзей деньги уже получены. */
  confirmedCount: number;
  invited: InvitedFriend[];
}
