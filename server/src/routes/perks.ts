import { Router, type Request, type Response } from 'express';
import { availableRespect, describePerks, findPerk } from '../config/perks.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const perksRouter = Router();

perksRouter.use(requireTelegramAuth);
perksRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/perks — на что можно потратить Respect. */
perksRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({
    perks: describePerks(user),
    respect: { total: user.respect, spent: user.respectSpent, available: availableRespect(user) },
  });
});

/** POST /api/perks/:id/buy — купить следующий уровень за Respect. */
perksRouter.post('/:id/buy', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const perk = findPerk(Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? ''));

  if (!perk) {
    res.status(404).json({ error: 'Такого улучшения нет', code: 'PERK_NOT_FOUND' });
    return;
  }

  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const level = user[perk.levelField];

  if (level >= perk.maxLevel) {
    res.status(409).json({ error: 'Достигнут максимум', code: 'MAX_LEVEL' });
    return;
  }

  const cost = perk.cost(level);

  if (availableRespect(user) < cost) {
    res.status(409).json({ error: 'Недостаточно Respect', code: 'NOT_ENOUGH_RESPECT' });
    return;
  }

  // Условия «уровень не изменился» и «Respect хватает» — прямо в UPDATE,
  // поэтому две одновременные покупки не дадут лишний уровень.
  const updated = await prisma.user.updateMany({
    where: {
      telegramId,
      [perk.levelField]: level,
      respectSpent: { lte: user.respect - cost },
    },
    data: {
      [perk.levelField]: { increment: 1 },
      respectSpent: { increment: cost },
    },
  });

  if (updated.count === 0) {
    res.status(409).json({ error: 'Покупка не прошла, попробуйте ещё раз', code: 'CONFLICT' });
    return;
  }

  const fresh = {
    ...user,
    [perk.levelField]: level + 1,
    respectSpent: user.respectSpent + cost,
  };
  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    perks: describePerks(fresh),
    respect: {
      total: fresh.respect,
      spent: fresh.respectSpent,
      available: availableRespect(fresh),
    },
    state: toGameState({ ...fresh, energy }),
  });
});
