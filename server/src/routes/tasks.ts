import { Router, type Request, type Response } from 'express';
import { describeTasks, findTask } from '../config/tasks.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const tasksRouter = Router();

tasksRouter.use(requireTelegramAuth);
tasksRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/** Рефералов считаем отдельно — в строке пользователя их нет. */
async function loadContext(userId: string) {
  return { referralCount: await prisma.user.count({ where: { referredById: userId } }) };
}

/** GET /api/tasks — список заданий с прогрессом. */
tasksRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  res.json({ tasks: describeTasks(user, await loadContext(user.id)) });
});

/** POST /api/tasks/:id/claim — забрать награду за выполненное задание. */
tasksRouter.post('/:id/claim', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const task = findTask(Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? ''));

  if (!task) {
    res.status(404).json({ error: 'Такого задания нет', code: 'TASK_NOT_FOUND' });
    return;
  }

  const telegramId = getTelegramId(res);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  if (user.claimedTasks.includes(task.id)) {
    res.status(409).json({ error: 'Награда уже получена', code: 'ALREADY_CLAIMED' });
    return;
  }

  const context = await loadContext(user.id);

  if (task.progress(user, context) < task.target) {
    res.status(409).json({ error: 'Задание ещё не выполнено', code: 'NOT_DONE' });
    return;
  }

  // Условие «задания нет в списке полученных» стоит в самом UPDATE, поэтому
  // два одновременных запроса дадут одну награду.
  const updated = await prisma.user.updateMany({
    where: { telegramId, NOT: { claimedTasks: { has: task.id } } },
    data: {
      balance: { increment: task.rewardCoins },
      totalEarned: { increment: task.rewardCoins },
      respect: { increment: task.rewardRespect },
      claimedTasks: { push: task.id },
    },
  });

  if (updated.count === 0) {
    res.status(409).json({ error: 'Награда уже получена', code: 'ALREADY_CLAIMED' });
    return;
  }

  const fresh = {
    ...user,
    balance: user.balance + task.rewardCoins,
    totalEarned: user.totalEarned + task.rewardCoins,
    respect: user.respect + task.rewardRespect,
    claimedTasks: [...user.claimedTasks, task.id],
  };
  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    reward: { coins: task.rewardCoins.toString(), respect: task.rewardRespect },
    tasks: describeTasks(fresh, context),
    state: toGameState({ ...fresh, energy }),
  });
});
