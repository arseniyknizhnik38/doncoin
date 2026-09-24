import {
  CASE_COOLDOWN_HOURS,
  CASES,
  pickCaseText,
  type CaseStepKind,
} from '../config/cases.js';
import { pickLangStored } from '../config/i18n.js';
import { activeIncomePerHour, utcDayNumber } from '../config/rewards.js';
import type { User, UserCase } from '../generated/prisma/client.js';
import { TAPS_PER_RESPECT } from './game.js';
import { prisma } from './prisma.js';
import { grantTickets } from './raffle.js';

/**
 * «Дела семьи»: состояние, продвижение и закрытие.
 *
 * Шаги продвигаются лениво, при чтении: игрок тапает и покупает в других
 * местах игры, а дело просто сверяет счётчики. Точка отсчёта шага
 * запоминается при его выдаче — «заработай 25 000» значит новых, а не
 * когда-либо.
 */

/** Счётчик, по которому меряется шаг. Для 'daily' и 'arcade' — время. */
async function metricValue(user: User, kind: CaseStepKind): Promise<bigint> {
  switch (kind) {
    case 'earn':
      return user.totalEarned;
    case 'taps':
      return BigInt(user.respect * TAPS_PER_RESPECT + user.respectProgress);
    case 'upgrades':
      return BigInt(user.tapLevel + user.energyLevel + user.regenLevel);
    case 'business': {
      const sum = await prisma.userBusiness.aggregate({
        where: { userId: user.id },
        _sum: { level: true },
      });

      return BigInt(sum._sum.level ?? 0);
    }
    case 'daily':
    case 'arcade':
      return 0n;
  }
}

/** Прогресс шага: 0..target. */
async function stepProgress(
  user: User,
  active: Pick<UserCase, 'baseline' | 'stepStartedAt'>,
  kind: CaseStepKind,
  target: number,
): Promise<number> {
  if (kind === 'daily') {
    return user.lastDailyAt && user.lastDailyAt > active.stepStartedAt ? 1 : 0;
  }

  if (kind === 'arcade') {
    return user.arcadeDay >= utcDayNumber(active.stepStartedAt) && user.arcadeDay > 0 ? 1 : 0;
  }

  const metric = await metricValue(user, kind);
  const delta = metric - active.baseline;

  if (delta <= 0n) {
    return 0;
  }

  return Number(delta > BigInt(target) ? BigInt(target) : delta);
}

export interface CaseStepView {
  index: number;
  total: number;
  progress: number;
  target: number;
}

export interface CaseView {
  state: 'available' | 'active' | 'ready' | 'cooldown' | 'done_all';
  /** Когда появится следующее дело — для 'cooldown'. */
  nextAt: Date | null;
  title: string | null;
  /** Реплика Бобби: интро, текст шага или финальный шаг. */
  text: string | null;
  step: CaseStepView | null;
  reward: { donc: string; tickets: number } | null;
  casesDone: number;
}

const caseReward = (user: User, hours: number): bigint =>
  BigInt(Math.floor(activeIncomePerHour(user) * hours));

/** Дело глазами игрока; заодно лениво продвигает завершённые шаги. */
export async function caseView(user: User, now: Date): Promise<CaseView> {
  const lang = pickLangStored(user.language);

  const [active, doneCount] = await Promise.all([
    prisma.userCase.findFirst({ where: { userId: user.id, completedAt: null } }),
    prisma.userCase.count({ where: { userId: user.id, completedAt: { not: null } } }),
  ]);

  if (!active) {
    if (doneCount >= CASES.length) {
      return {
        state: 'done_all',
        nextAt: null,
        title: null,
        text: null,
        step: null,
        reward: null,
        casesDone: doneCount,
      };
    }

    const last = await prisma.userCase.findFirst({
      where: { userId: user.id, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
    });
    const nextAt = last?.completedAt
      ? new Date(last.completedAt.getTime() + CASE_COOLDOWN_HOURS * 3_600_000)
      : now;

    const definition = CASES[doneCount]!;

    if (nextAt > now) {
      return {
        state: 'cooldown',
        nextAt,
        title: null,
        text: null,
        step: null,
        reward: null,
        casesDone: doneCount,
      };
    }

    return {
      state: 'available',
      nextAt: null,
      title: pickCaseText(definition.title, lang),
      text: pickCaseText(definition.intro, lang),
      step: null,
      reward: {
        donc: caseReward(user, definition.rewardHours).toString(),
        tickets: definition.rewardTickets,
      },
      casesDone: doneCount,
    };
  }

  const definition = CASES[active.caseIndex];

  if (!definition) {
    // Каталог сократился — закрываем осиротевшее дело без награды.
    await prisma.userCase.update({
      where: { id: active.id },
      data: { completedAt: now },
    });

    return caseView(user, now);
  }

  // Ленивое продвижение: закрытые шаги пролистываются до первого живого.
  let current = active;

  for (let index = current.step; index < definition.steps.length; index += 1) {
    const step = definition.steps[index]!;
    const progress = await stepProgress(user, current, step.kind, step.target);

    if (progress < step.target) {
      return {
        state: 'active',
        nextAt: null,
        title: pickCaseText(definition.title, lang),
        text: pickCaseText(step.say, lang),
        step: {
          index: index + 1,
          total: definition.steps.length,
          progress,
          target: step.target,
        },
        reward: {
          donc: caseReward(user, definition.rewardHours).toString(),
          tickets: definition.rewardTickets,
        },
        casesDone: doneCount,
      };
    }

    if (index < definition.steps.length - 1) {
      const nextKind = definition.steps[index + 1]!.kind;

      current = await prisma.userCase.update({
        where: { id: current.id },
        data: {
          step: index + 1,
          baseline: await metricValue(user, nextKind),
          stepStartedAt: now,
        },
      });
    } else {
      return {
        state: 'ready',
        nextAt: null,
        title: pickCaseText(definition.title, lang),
        text: pickCaseText(step.say, lang),
        step: {
          index: definition.steps.length,
          total: definition.steps.length,
          progress: step.target,
          target: step.target,
        },
        reward: {
          donc: caseReward(user, definition.rewardHours).toString(),
          tickets: definition.rewardTickets,
        },
        casesDone: doneCount,
      };
    }
  }

  return caseView(user, now);
}

export class CaseError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'CaseError';
  }
}

/** Взять следующее дело. */
export async function startCase(user: User, now: Date): Promise<void> {
  const view = await caseView(user, now);

  if (view.state !== 'available') {
    throw new CaseError('Сейчас дела нет — Бобби подойдёт позже', 'NO_CASE');
  }

  const doneCount = view.casesDone;
  const definition = CASES[doneCount]!;

  await prisma.userCase.create({
    data: {
      userId: user.id,
      caseIndex: doneCount,
      step: 0,
      baseline: await metricValue(user, definition.steps[0]!.kind),
      stepStartedAt: now,
    },
  });
}

export interface CaseClaim {
  outro: string;
  reward: string;
  tickets: number;
}

/** Закрыть готовое дело и получить награду. */
export async function claimCase(user: User, now: Date): Promise<CaseClaim> {
  const view = await caseView(user, now);

  if (view.state !== 'ready') {
    throw new CaseError('Дело ещё не закончено', 'CASE_NOT_READY');
  }

  const active = await prisma.userCase.findFirst({
    where: { userId: user.id, completedAt: null },
  });

  if (!active) {
    throw new CaseError('Дело ещё не закончено', 'CASE_NOT_READY');
  }

  const definition = CASES[active.caseIndex]!;
  const reward = caseReward(user, definition.rewardHours);

  // Закрытие захватывается условием: два одновременных запроса не получат
  // одну награду дважды.
  const closed = await prisma.userCase.updateMany({
    where: { id: active.id, completedAt: null },
    data: { completedAt: now },
  });

  if (closed.count === 0) {
    throw new CaseError('Дело уже закрыто', 'ALREADY_CLAIMED');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      balance: { increment: reward },
      totalEarned: { increment: reward },
      lifetimeEarned: { increment: reward },
    },
  });

  await grantTickets(user.id, 'case', definition.rewardTickets);

  return {
    outro: pickCaseText(definition.outro, pickLangStored(user.language)),
    reward: reward.toString(),
    tickets: definition.rewardTickets,
  };
}
