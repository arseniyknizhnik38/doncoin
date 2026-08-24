export interface InvitedFriend {
  firstName: string | null;
  username: string | null;
  joinedAt: string;
}

export interface ReferralsData {
  code: string;
  invitedCount: number;
  earned: string;
  rewards: { inviter: string; invitee: string };
  invited: InvitedFriend[];
}
