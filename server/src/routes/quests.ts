import { Router, type Request, type Response } from 'express';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { claimChest, claimQuest, questsState } from '../lib/quests.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const questsRouter = Router();

questsRouter.use(requireTelegramAuth);
questsRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** GET /api/quests — задания на сегодня с прогрессом. */
questsRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json(await questsState(user, new Date()));
});

/**
 * POST /api/quests/:id/claim — забрать награду за задание.
 * POST /api/quests/chest/claim — забрать сундук за все три.
 *
 * Оба обработчика перечитывают игрока после начисления: награда меняет
 * баланс и Respect, и клиент должен получить их одним ответом, иначе
 * цифры на экране разъедутся до следующего запроса.
 */
async function respondWithClaim(
  res: Response,
  claim: (user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>, now: Date) => Promise<{ coins: bigint; respect: number }>,
) {
  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const now = new Date();
  const { coins, respect } = await claim(user, now);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
  const { energy } = regenerateEnergy(fresh, now);

  res.json({
    claimed: { coins: coins.toString(), respect },
    ...(await questsState(fresh, now)),
    state: toGameState({ ...fresh, energy }),
  });
}

questsRouter.post('/chest/claim', async (_req: Request, res: Response) => {
  await respondWithClaim(res, (user, now) => claimChest(user, now));
});

questsRouter.post('/:id/claim', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  await respondWithClaim(res, (user, now) => claimQuest(user, id ?? '', now));
});
