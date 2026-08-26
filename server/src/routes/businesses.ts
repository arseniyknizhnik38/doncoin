import { Router, type Request, type Response } from 'express';
import { applyBonus } from '../config/perks.js';
import {
  BusinessError,
  businessBonusPercent,
  buyBusinessLevel,
  collectBusinessIncome,
  describeBusinesses,
  loadBusinesses,
  pendingBusinessIncome,
  totalIncomePerHour,
} from '../lib/businesses.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const businessesRouter = Router();

businessesRouter.use(requireTelegramAuth);
businessesRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/businesses — каталог с уровнями игрока и доходом. */
businessesRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();
  const rows = await loadBusinesses(user.id);
  // Показываем доход с учётом прибавок — иначе игрок видит одно число,
  // а получает другое, и смысл «Деловой хватки» и уровня клана не виден.
  const perHour = applyBonus(totalIncomePerHour(rows), await businessBonusPercent(user));

  res.json({
    businesses: describeBusinesses(rows, user.balance),
    income: {
      perHour: perHour.toString(),
      // Показываем накопленное, но не начисляем: запись на GET — плохая идея,
      // деньги придут при следующем входе или покупке.
      pending: pendingBusinessIncome(user.businessCollectedAt, perHour, now).toString(),
    },
  });
});

/** POST /api/businesses/:id/buy — купить или улучшить бизнес. */
businessesRouter.post('/:id/buy', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const businessId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!businessId) {
    throw new BusinessError('BUSINESS_NOT_FOUND', 'Не указан бизнес', 404);
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  // Сначала зачисляем накопленное: игрок вправе потратить то, что уже
  // заработали его бизнесы.
  const now = new Date();
  await collectBusinessIncome(user, now);

  const { level, cost } = await buyBusinessLevel(user.id, businessId);

  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const rows = await loadBusinesses(user.id);
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    level,
    spent: cost.toString(),
    businesses: describeBusinesses(rows, fresh.balance),
    income: {
      perHour: applyBonus(
        totalIncomePerHour(rows),
        await businessBonusPercent(fresh),
      ).toString(),
      pending: '0',
    },
    state: toGameState({ ...fresh, energy }),
  });
});
