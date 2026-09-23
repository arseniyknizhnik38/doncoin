import { Router, type Request, type Response } from 'express';
import { adReward, isRunning, slotsLeft } from '../config/ads.js';
import { isAdmin } from '../config/admin.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { grantTickets } from '../lib/raffle.js';
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

/** GET /api/favors — идущие рекламные кампании и отметки о выполнении. */
favorsRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();

  // Фильтруем в коде, а не запросом: условий у «кампания идёт» четыре, и
  // в SQL они превращаются в нечитаемое дерево, которое потом разъезжается
  // с проверкой при выдаче награды. Активных кампаний всегда единицы.
  const favors = await prisma.favor.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      completions: {
        where: { userId: user.id },
        select: { completedAt: true },
      },
    },
  });

  res.json({
    favors: favors
      // Выполненную кампанию продолжаем показывать, даже если она кончилась:
      // иначе отметка «сделано» пропадает из списка вместе с ней.
      .filter((favor) => isRunning(favor, now) || favor.completions.length > 0)
      .map((favor) => ({
        id: favor.id,
        title: favor.title,
        channelName: favor.channelName,
        channelUrl: favor.channelUrl,
        // channelChatId наружу не отдаём: это техническое поле для проверки
        // подписки на сервере.
        rewardDonc: adReward(favor, user).toString(),
        familyXpReward: favor.familyXpReward,
        slotsLeft: slotsLeft(favor),
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

  if (!favor) {
    res.status(404).json({ error: 'Задание не найдено', code: 'FAVOR_NOT_FOUND' });
    return;
  }

  const now = new Date();

  if (!isRunning(favor, now)) {
    res.status(409).json({
      error:
        favor.slots !== null && favor.completedCount >= favor.slots
          ? 'Награды за это задание кончились'
          : 'Задание больше не действует',
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

      // Владельцу — настоящая причина прямо на карточке: иначе, чтобы понять,
      // что бот не админ канала, нужно лезть в логи сервера.
      res.status(503).json({
        error: isAdmin(user.telegramId)
          ? `Проверка не работает: ${error.code} — ${error.detail ?? error.message}. Подробнее — «Проверить бота» в Сводке.`
          : 'Не получилось проверить подписку, попробуйте позже',
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

  const reward = adReward(favor, user);

  try {
    // Всё одной транзакцией: отметка о выполнении, счётчик выданных наград,
    // деньги игроку и опыт семье.
    await prisma.$transaction(async (tx) => {
      await tx.favorCompletion.create({
        data: { userId: user.id, favorId: favor.id },
      });

      // Лимит проверяется здесь, а не только выше: между проверкой и выдачей
      // могли уложиться другие игроки. Условие в WHERE не даст уйти за
      // оплаченное рекламодателем число подписок.
      const counted = await tx.favor.updateMany({
        where:
          favor.slots === null
            ? { id: favor.id }
            : { id: favor.id, completedCount: { lt: favor.slots } },
        data: { completedCount: { increment: 1 } },
      });

      if (counted.count === 0) {
        throw new SlotsExhausted();
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: reward },
          totalEarned: { increment: reward },
          lifetimeEarned: { increment: reward },
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
    if (error instanceof SlotsExhausted) {
      res.status(409).json({
        error: 'Награды за это задание только что кончились',
        code: 'FAVOR_EXPIRED',
      });
      return;
    }

    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({
        error: 'Задание уже выполнено',
        code: 'ALREADY_COMPLETED',
      });
      return;
    }

    throw error;
  }

  // Билет розыгрыша — за подписку. Вне транзакции: билет — приложение
  // к награде, а не её условие.
  await grantTickets(user.id, 'favor');

  const fresh = {
    ...user,
    balance: user.balance + reward,
    totalEarned: user.totalEarned + reward,
  };
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    reward: {
      donc: reward.toString(),
      familyXp: user.clanId ? favor.familyXpReward : 0,
    },
    state: toGameState({ ...fresh, energy }),
  });
});

/** Лимит подписок выбран, пока шла транзакция — откатываем её целиком. */
class SlotsExhausted extends Error {
  constructor() {
    super('Лимит подписок выбран');
    this.name = 'SlotsExhausted';
  }
}
