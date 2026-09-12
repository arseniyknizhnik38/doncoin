import { Router, type Request, type Response } from 'express';
import { describeBackdrops, findBackdrop } from '../config/backdrops.js';
import { rankStep } from '../config/ranks.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const backdropsRouter = Router();

backdropsRouter.use(requireTelegramAuth);
backdropsRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** Каталог с отметками владения — общий для всех трёх обработчиков. */
async function catalogFor(userId: string, step: number, balance: bigint, equipped: string | null) {
  const purchases = await prisma.backdropPurchase.findMany({
    where: { userId },
    select: { backdropId: true },
  });

  return describeBackdrops(
    step,
    balance,
    purchases.map((purchase) => purchase.backdropId),
    equipped,
  );
}

/** GET /api/backdrops — что есть, что можно купить, что выбрано. */
backdropsRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({
    backdrops: await catalogFor(
      user.id,
      rankStep(user.totalEarned),
      user.balance,
      user.equippedBackdrop,
    ),
  });
});

/** POST /api/backdrops/:id/buy — купить фон за монеты. */
backdropsRouter.post('/:id/buy', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const backdrop = findBackdrop(id ?? '');

  if (!backdrop) {
    res.status(404).json({ error: 'Такого фона нет', code: 'BACKDROP_NOT_FOUND' });
    return;
  }

  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const step = rankStep(user.totalEarned);

  if (step >= backdrop.freeFromStep) {
    res.status(409).json({ error: 'Этот фон уже ваш', code: 'ALREADY_OWNED' });
    return;
  }

  if (backdrop.price <= 0n) {
    res.status(409).json({ error: 'Этот фон нельзя купить', code: 'NOT_FOR_SALE' });
    return;
  }

  if (user.balance < backdrop.price) {
    res.status(409).json({ error: 'Недостаточно монет', code: 'NOT_ENOUGH_COINS' });
    return;
  }

  try {
    // Отметка о покупке и списание — одной транзакцией. Уникальный ключ
    // (userId, backdropId) не даст купить дважды при гонке, а условие по
    // балансу — уйти в минус.
    await prisma.$transaction(async (tx) => {
      await tx.backdropPurchase.create({
        data: { userId: user.id, backdropId: backdrop.id, price: backdrop.price },
      });

      const paid = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: backdrop.price } },
        data: {
          balance: { decrement: backdrop.price },
          // Купленный фон сразу становится выбранным: иначе игрок платит и
          // не видит, за что.
          equippedBackdrop: backdrop.id,
        },
      });

      if (paid.count === 0) {
        throw new NotEnoughCoins();
      }
    });
  } catch (error) {
    if (error instanceof NotEnoughCoins) {
      res.status(409).json({ error: 'Недостаточно монет', code: 'NOT_ENOUGH_COINS' });
      return;
    }

    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'Фон уже куплен', code: 'ALREADY_OWNED' });
      return;
    }

    throw error;
  }

  const fresh = { ...user, balance: user.balance - backdrop.price, equippedBackdrop: backdrop.id };
  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    backdrops: await catalogFor(user.id, step, fresh.balance, backdrop.id),
    state: toGameState({ ...fresh, energy }),
  });
});

/** POST /api/backdrops/:id/equip — поставить один из своих фонов. */
backdropsRouter.post('/:id/equip', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const backdrop = findBackdrop(id ?? '');

  if (!backdrop) {
    res.status(404).json({ error: 'Такого фона нет', code: 'BACKDROP_NOT_FOUND' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const step = rankStep(user.totalEarned);

  if (step < backdrop.freeFromStep) {
    const bought = await prisma.backdropPurchase.findUnique({
      where: { userId_backdropId: { userId: user.id, backdropId: backdrop.id } },
    });

    if (!bought) {
      res.status(409).json({ error: 'Этого фона у вас нет', code: 'NOT_OWNED' });
      return;
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { equippedBackdrop: backdrop.id },
  });

  res.json({
    backdrops: await catalogFor(user.id, step, user.balance, backdrop.id),
  });
});

/** Баланс не сошёлся между проверкой и списанием — откатываем покупку. */
class NotEnoughCoins extends Error {
  constructor() {
    super('Недостаточно монет');
    this.name = 'NotEnoughCoins';
  }
}
