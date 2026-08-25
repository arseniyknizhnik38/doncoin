import { Router, type Request, type Response } from 'express';
import { weekNumber } from '../config/favors.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { SubscriptionCheckError, checkSubscription } from '../lib/telegramApi.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const favorsRouter = Router();

favorsRouter.use(requireTelegramAuth);
favorsRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/favors — активные поручения недели и отметки о выполнении. */
favorsRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
    select: { id: true },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const week = weekNumber(new Date());

  const favors = await prisma.favor.findMany({
    where: { weekNumber: week, active: true },
    orderBy: { rewardDonc: 'asc' },
    select: {
      id: true,
      title: true,
      channelName: true,
      channelUrl: true,
      rewardDonc: true,
      familyXpReward: true,
      // channelChatId наружу не отдаём: это техническое поле для проверки
      // подписки на сервере.
      completions: {
        where: { userId: user.id },
        select: { completedAt: true },
      },
    },
  });

  res.json({
    weekNumber: week,
    favors: favors.map((favor) => ({
      id: favor.id,
      title: favor.title,
      channelName: favor.channelName,
      channelUrl: favor.channelUrl,
      rewardDonc: favor.rewardDonc.toString(),
      familyXpReward: favor.familyXpReward,
      completed: favor.completions.length > 0,
      completedAt: favor.completions[0]?.completedAt ?? null,
    })),
  });
});

/**
 * POST /api/favors/:id/complete — проверить подписку и выдать награду.
 *
 * Подписка проверяется на сервере через getChatMember: клиент не может
 * ни подтвердить её за себя, ни обойти запросом напрямую в API.
 */
favorsRouter.post('/:id/complete', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const favorId = Array.isArray(rawId) ? rawId[0] : rawId;

  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const favor = favorId
    ? await prisma.favor.findUnique({ where: { id: favorId } })
    : null;

  if (!favor || !favor.active) {
    res.status(404).json({ error: 'Поручение не найдено', code: 'FAVOR_NOT_FOUND' });
    return;
  }

  if (favor.weekNumber !== weekNumber(new Date())) {
    res.status(409).json({
      error: 'Поручение прошлой недели',
      code: 'FAVOR_EXPIRED',
    });
    return;
  }

  // Проверяем подписку до любых начислений.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.status(503).json({
      error: 'Проверка подписки недоступна',
      code: 'CHECK_UNAVAILABLE',
    });
    return;
  }

  let subscribed: boolean;

  try {
    subscribed = await checkSubscription(favor.channelChatId, user.telegramId, botToken);
  } catch (error) {
    if (error instanceof SubscriptionCheckError) {
      // Детали — в лог владельцу: чаще всего это «бот не админ канала».
      console.warn(
        `[favors] проверка подписки не прошла (${favor.channelName}): ${error.code} — ${error.detail ?? ''}`,
      );

      res.status(503).json({
        error: 'Не получилось проверить подписку, попробуйте позже',
        code: 'CHECK_UNAVAILABLE',
      });
      return;
    }

    throw error;
  }

  if (!subscribed) {
    res.status(409).json({
      error: 'Подпишитесь на канал и нажмите «Проверить» ещё раз',
      code: 'NOT_SUBSCRIBED',
    });
    return;
  }

  try {
    // Всё одной транзакцией: отметка о выполнении, награда игроку и опыт
    // семье. Уникальный ключ (userId, favorId) не даст начислить дважды —
    // при гонке вторая попытка упадёт на нём и откатит начисление.
    await prisma.$transaction(async (tx) => {
      await tx.favorCompletion.create({
        data: { userId: user.id, favorId: favor.id },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: favor.rewardDonc },
          totalEarned: { increment: favor.rewardDonc },
        },
      });

      if (user.clanId) {
        await tx.clan.update({
          where: { id: user.clanId },
          data: { familyXp: { increment: favor.familyXpReward } },
        });
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({
        error: 'Поручение уже выполнено',
        code: 'ALREADY_COMPLETED',
      });
      return;
    }

    throw error;
  }

  const fresh = {
    ...user,
    balance: user.balance + favor.rewardDonc,
    totalEarned: user.totalEarned + favor.rewardDonc,
  };
  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    reward: {
      donc: favor.rewardDonc.toString(),
      familyXp: user.clanId ? favor.familyXpReward : 0,
    },
    state: toGameState({ ...fresh, energy }),
  });
});
