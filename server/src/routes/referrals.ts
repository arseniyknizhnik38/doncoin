import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { INVITEE_REWARD, INVITER_REWARD } from '../lib/referrals.js';
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

  res.json({
    code: user.referralCode,
    invitedCount: user._count.referrals,
    earned: user.referralEarned.toString(),
    rewards: {
      inviter: INVITER_REWARD.toString(),
      invitee: INVITEE_REWARD.toString(),
    },
    invited: user.referrals.map((friend) => ({
      firstName: friend.firstName,
      username: friend.username,
      joinedAt: friend.createdAt,
    })),
  });
});
