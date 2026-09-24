import { Router, type Request, type Response } from 'express';
import { tournamentView } from '../lib/tournament.js';
import { prisma } from '../lib/prisma.js';
import { TAPS_PER_RESPECT } from '../lib/game.js';
import {
  INVITEE_REWARD,
  INVITER_REWARD,
  REFERRAL_QUALIFY_TAPS,
} from '../lib/referrals.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const referralsRouter = Router();

referralsRouter.use(requireTelegramAuth);
referralsRouter.use(writeRateLimit());

/** Сколько приглашённых показываем списком. */
const INVITED_LIMIT = 50;

/** GET /api/referrals — свой код, статистика и список приглашённых. */
referralsRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
    select: {
      id: true,
      referralCode: true,
      referralEarned: true,
      _count: { select: { referrals: true } },
      referrals: {
        orderBy: { createdAt: 'desc' },
        take: INVITED_LIMIT,
        select: {
          firstName: true,
          username: true,
          createdAt: true,
          // По этим полям видно, засчитан ли друг и сколько ему осталось
          // доиграть до зачёта.
          referralRewarded: true,
          respect: true,
          respectProgress: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({
      error: 'Пользователь не найден, выполните вход заново',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  const tournament = await tournamentView(user.id, new Date());

  res.json({
    tournament,
    code: user.referralCode,
    invitedCount: user._count.referrals,
    earned: user.referralEarned.toString(),
    rewards: {
      inviter: INVITER_REWARD.toString(),
      invitee: INVITEE_REWARD.toString(),
    },
    /** Сколько тапов должен сделать друг, чтобы награда пришла. */
    qualifyTaps: REFERRAL_QUALIFY_TAPS,
    /** За скольких друзей деньги уже получены. */
    confirmedCount: user.referrals.filter((friend) => friend.referralRewarded).length,
    invited: user.referrals.map((friend) => {
      const taps = friend.respect * TAPS_PER_RESPECT + friend.respectProgress;

      return {
        firstName: friend.firstName,
        username: friend.username,
        joinedAt: friend.createdAt,
        confirmed: friend.referralRewarded,
        // Показываем прогресс, а не голое «не засчитан»: так видно, что друга
        // надо растормошить, а не что игра зажала награду.
        taps: Math.min(taps, REFERRAL_QUALIFY_TAPS),
      };
    }),
  });
});
