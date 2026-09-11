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
  // ——— Первый вечер: провести за руку до второй звезды
  {
    id: 'first_taps',
    title: 'Размять пальцы',
    description: 'Сделать 500 тапов',
    target: 500,
    progress: totalTaps,
    rewardCoins: 5_000n,
    rewardRespect: 0,
  },
  {
    id: 'first_upgrade',
    title: 'Вложиться в дело',
    description: 'Купить любое улучшение',
    target: 1,
    progress: (user) =>
      user.tapLevel + user.energyLevel + user.regenLevel > 0 ? 1 : 0,
    rewardCoins: 5_000n,
    rewardRespect: 0,
  },
  {
    id: 'earn_25k',
    title: 'Первые деньги',
    description: 'Заработать 25 000 DONC',
    target: 25_000,
    progress: (user) => Number(user.totalEarned),
    rewardCoins: 10_000n,
    rewardRespect: 0,
  },
  {
    id: 'daily_claim',
    title: 'Дисциплина',
    description: 'Забрать ежедневный бонус',
    target: 1,
    progress: (user) => (user.lastDailyAt ? 1 : 0),
    rewardCoins: 5_000n,
    rewardRespect: 0,
  },

  // ——— Первая неделя: показать, что игра длиннее одного вечера
  {
    id: 'invite_friend',
    title: 'Расширить семью',
    description: 'Привести друга по своей ссылке',
    target: 1,
    progress: (_user, context) => context.referralCount,
    rewardCoins: 25_000n,
    rewardRespect: 10,
  },
  {
    id: 'taps_10k',
    title: 'Рабочие руки',
    description: 'Сделать 10 000 тапов',
    target: 10_000,
    progress: totalTaps,
    rewardCoins: 50_000n,
    rewardRespect: 15,
  },
  {
    id: 'upgrades_10',
    title: 'Крепкое дело',
    description: 'Купить 10 уровней улучшений',
    target: 10,
    progress: (user) => user.tapLevel + user.energyLevel + user.regenLevel,
    rewardCoins: 100_000n,
    rewardRespect: 20,
  },
  {
    id: 'streak_7',
    title: 'Неделя без пропусков',
    description: 'Собрать серию из 7 дней',
    target: 7,
    progress: (user) => user.dailyStreak,
    rewardCoins: 200_000n,
    rewardRespect: 30,
  },

  // ——— Дальше: цели на вторую-четвёртую неделю
  {
    id: 'join_clan',
    title: 'Своя банда',
    description: 'Вступить в клан или основать свой',
    target: 1,
    progress: (user) => (user.clanId ? 1 : 0),
    rewardCoins: 300_000n,
    rewardRespect: 40,
  },
  {
    id: 'invite_5',
    title: 'Своих людей побольше',
    description: 'Привести 5 друзей',
    target: 5,
    progress: (_user, context) => context.referralCount,
    rewardCoins: 500_000n,
    rewardRespect: 60,
  },
  {
    id: 'rank_soldier',
    title: 'Стать солдатом',
    description: 'Дорасти до ранга «Солдат»',
    target: 1_950_000,
    progress: (user) => Number(user.totalEarned),
    rewardCoins: 750_000n,
    rewardRespect: 75,
  },
  {
    id: 'streak_30',
    title: 'Месяц в семье',
    description: 'Собрать серию из 30 дней',
    target: 30,
    progress: (user) => user.dailyStreak,
    rewardCoins: 3_000_000n,
    rewardRespect: 150,
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
