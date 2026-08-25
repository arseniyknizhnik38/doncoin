import type { User } from '../generated/prisma/client.js';
import { TAPS_PER_RESPECT } from '../lib/game.js';

/**
 * Задания для первых шагов. Прогресс нигде не хранится — он выводится из
 * полей игрока, поэтому задания нельзя рассинхронизировать с реальностью,
 * а добавление нового задания не требует миграции.
 */

/** Данные, которых нет в самой строке пользователя. */
export interface TaskContext {
  referralCount: number;
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  /** Сколько нужно набрать. */
  target: number;
  /** Сколько уже набрано. */
  progress: (user: User, context: TaskContext) => number;
  rewardCoins: bigint;
  rewardRespect: number;
}

/** Всего тапов: respect выдаётся ровно за каждые TAPS_PER_RESPECT тапов. */
const totalTaps = (user: User) =>
  user.respect * TAPS_PER_RESPECT + user.respectProgress;

export const TASKS: readonly TaskDefinition[] = [
  {
    id: 'first_taps',
    title: 'Размять пальцы',
    description: 'Сделать 500 тапов',
    target: 500,
    progress: totalTaps,
    rewardCoins: 2_000n,
    rewardRespect: 0,
  },
  {
    id: 'earn_10k',
    title: 'Первые деньги',
    description: 'Заработать 10 000 DONC',
    target: 10_000,
    progress: (user) => Number(user.totalEarned),
    rewardCoins: 3_000n,
    rewardRespect: 0,
  },
  {
    id: 'first_upgrade',
    title: 'Вложиться в дело',
    description: 'Купить любое улучшение',
    target: 1,
    progress: (user) =>
      user.tapLevel + user.energyLevel + user.regenLevel > 0 ? 1 : 0,
    rewardCoins: 2_500n,
    rewardRespect: 0,
  },
  {
    id: 'daily_claim',
    title: 'Дисциплина',
    description: 'Забрать ежедневный бонус',
    target: 1,
    progress: (user) => (user.lastDailyAt ? 1 : 0),
    rewardCoins: 1_500n,
    rewardRespect: 0,
  },
  {
    id: 'invite_friend',
    title: 'Расширить семью',
    description: 'Привести друга по своей ссылке',
    target: 1,
    progress: (_user, context) => context.referralCount,
    rewardCoins: 5_000n,
    rewardRespect: 10,
  },
  {
    id: 'join_clan',
    title: 'Своя банда',
    description: 'Вступить в клан или основать свой',
    target: 1,
    progress: (user) => (user.clanId ? 1 : 0),
    rewardCoins: 10_000n,
    rewardRespect: 25,
  },
];

export function findTask(id: string): TaskDefinition | undefined {
  return TASKS.find((task) => task.id === id);
}

export interface TaskView {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  rewardCoins: string;
  rewardRespect: number;
}

export function describeTasks(user: User, context: TaskContext): TaskView[] {
  return TASKS.map((task) => {
    const progress = Math.min(task.progress(user, context), task.target);

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      progress,
      target: task.target,
      done: progress >= task.target,
      claimed: user.claimedTasks.includes(task.id),
      rewardCoins: task.rewardCoins.toString(),
      rewardRespect: task.rewardRespect,
    };
  });
}
