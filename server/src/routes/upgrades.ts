import { Router, type Request, type Response } from 'express';
import type { User } from '../generated/prisma/client.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { describeUpgrades, findUpgrade } from '../lib/upgrades.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const upgradesRouter = Router();

upgradesRouter.use(requireTelegramAuth);
upgradesRouter.use(writeRateLimit());

const USER_NOT_FOUND = {
  error: 'Пользователь не найден, выполните вход заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/upgrades — каталог с текущими уровнями и ценами. */
upgradesRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(USER_NOT_FOUND);
    return;
  }

  const { energy } = regenerateEnergy(user, new Date());

  res.json({
    upgrades: describeUpgrades(user),
    state: toGameState({ ...user, energy }),
  });
});

/** POST /api/upgrades/:id/buy — купить следующий уровень. */
upgradesRouter.post('/:id/buy', async (req: Request, res: Response) => {
  // В типах Express 5 параметр может быть и массивом.
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const upgrade = findUpgrade(id ?? '');

  if (!upgrade) {
    res.status(404).json({ error: 'Такого улучшения нет' });
    return;
  }

  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(USER_NOT_FOUND);
    return;
  }

  const level = user[upgrade.levelField];

  if (level >= upgrade.maxLevel) {
    res.status(409).json({ error: 'Достигнут максимальный уровень', code: 'MAX_LEVEL' });
    return;
  }

  const price = upgrade.price(level);

  if (user.balance < price) {
    res.status(409).json({ error: 'Недостаточно монет', code: 'NOT_ENOUGH_COINS' });
    return;
  }

  // Списание и повышение уровня — одним UPDATE с условиями: денег хватает
  // и уровень не изменился с момента чтения. Иначе две одновременные покупки
  // могли бы уйти в минус или списать дважды за один уровень.
  const updated = await prisma.user.updateMany({
    where: {
      telegramId,
      balance: { gte: price },
      [upgrade.levelField]: level,
    },
    data: {
      balance: { decrement: price },
      [upgrade.levelField]: { increment: 1 },
      ...upgrade.valueAt(level + 1),
    },
  });

  if (updated.count === 0) {
    res.status(409).json({
      error: 'Покупка не прошла, попробуйте ещё раз',
      code: 'CONFLICT',
    });
    return;
  }

  // Перечитывать строку не нужно: UPDATE прошёл ровно с теми условиями,
  // которые мы проверяли, значит результат известен точно. Это экономит
  // целый round-trip до базы, а он тут стоит сотни миллисекунд.
  const fresh: User = {
    ...user,
    balance: user.balance - price,
    [upgrade.levelField]: level + 1,
    ...upgrade.valueAt(level + 1),
  };

  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    upgrades: describeUpgrades(fresh),
    state: toGameState({ ...fresh, energy }),
  });
});
