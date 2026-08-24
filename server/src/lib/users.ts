import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';
import {
  INVITEE_REWARD,
  INVITER_REWARD,
  generateReferralCode,
  normalizeReferralCode,
} from './referrals.js';
import type { ParsedInitData } from './telegram.js';

/**
 * Поля, на которых сработало уникальное ограничение (P2002), или null —
 * если ошибка другая.
 *
 * Форма ответа зависит от версии Prisma и драйвера: meta.target бывает
 * массивом, строкой, а с driver adapter в Prisma 7 не заполняется вовсе —
 * тогда имя поля остаётся только в тексте ошибки. Разбираем все три случая.
 */
function uniqueViolationFields(error: unknown): string[] | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { code, meta, message } = error as {
    code?: string;
    message?: string;
    meta?: { target?: unknown };
  };

  if (code !== 'P2002') {
    return null;
  }

  const target = meta?.target;

  if (Array.isArray(target)) {
    return target.map(String);
  }

  if (typeof target === 'string') {
    return [target];
  }

  return typeof message === 'string' ? [message] : [];
}

const mentions = (fields: string[], field: string) =>
  fields.some((value) => value.includes(field));

/**
 * Находит пользователя по telegramId, при первом заходе создаёт.
 *
 * Профиль перезаписывается лишь когда имя или username действительно
 * изменились: функция вызывается на каждом входе, а лишний UPDATE — это
 * лишний round-trip до базы.
 */
export async function upsertUserFromTelegram(
  parsed: ParsedInitData,
): Promise<{ user: User; isNew: boolean }> {
  const telegramId = String(parsed.user.id);
  const username = parsed.user.username ?? null;
  const firstName = parsed.user.first_name ?? null;

  const existing = await prisma.user.findUnique({ where: { telegramId } });

  if (existing) {
    if (existing.username === username && existing.firstName === firstName) {
      return { user: existing, isNew: false };
    }

    const user = await prisma.user.update({
      where: { telegramId },
      data: { username, firstName },
    });

    return { user, isNew: false };
  }

  return createUser({ telegramId, username, firstName, startParam: parsed.startParam });
}

interface CreateUserInput {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  startParam: string | null;
}

async function createUser(input: CreateUserInput): Promise<{ user: User; isNew: boolean }> {
  // Кто пригласил: ищем владельца кода из ссылки. Свой код новичку
  // принадлежать ещё не может, так что самоприглашение невозможно.
  const code = normalizeReferralCode(input.startParam);
  const inviter = code
    ? await prisma.user.findUnique({ where: { referralCode: code } })
    : null;

  // Коллизия сгенерированного кода крайне маловероятна, но проверяется базой,
  // поэтому просто пробуем ещё раз с новым кодом.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [user] = await prisma.$transaction([
        prisma.user.create({
          data: {
            telegramId: input.telegramId,
            username: input.username,
            firstName: input.firstName,
            referralCode: generateReferralCode(),
            referredByCode: input.startParam,
            referredById: inviter?.id ?? null,
            balance: inviter ? INVITEE_REWARD : 0n,
          },
        }),
        ...(inviter
          ? [
              prisma.user.update({
                where: { id: inviter.id },
                data: {
                  balance: { increment: INVITER_REWARD },
                  referralEarned: { increment: INVITER_REWARD },
                },
              }),
            ]
          : []),
      ]);

      return { user, isNew: true };
    } catch (error) {
      const fields = uniqueViolationFields(error);

      if (fields === null) {
        throw error;
      }

      // Два первых входа одновременно: строку успел создать другой запрос.
      if (mentions(fields, 'telegramId')) {
        const user = await prisma.user.findUniqueOrThrow({
          where: { telegramId: input.telegramId },
        });

        return { user, isNew: false };
      }

      if (!mentions(fields, 'referralCode')) {
        throw error;
      }
    }
  }

  throw new Error('Не удалось подобрать свободный реферальный код');
}
