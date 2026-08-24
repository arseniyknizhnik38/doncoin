import type { ParsedInitData } from './telegram.js';
import { prisma } from './prisma.js';

/** P2002 — нарушение уникального ограничения в Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Находит пользователя по telegramId, при первом заходе создаёт.
 *
 * referredByCode пишется только при создании — кто пригласил, тот и остаётся.
 * Профиль перезаписывается лишь когда имя или username действительно
 * изменились: эта функция вызывается на каждом игровом запросе, а лишний
 * UPDATE — это лишний round-trip до базы.
 */
export async function upsertUserFromTelegram(parsed: ParsedInitData) {
  const telegramId = String(parsed.user.id);
  const username = parsed.user.username ?? null;
  const firstName = parsed.user.first_name ?? null;

  const existing = await prisma.user.findUnique({ where: { telegramId } });

  if (!existing) {
    try {
      const user = await prisma.user.create({
        data: { telegramId, username, firstName, referredByCode: parsed.startParam },
      });
      return { user, isNew: true };
    } catch (error) {
      // Два первых входа одновременно (например, двойное открытие приложения):
      // один успевает создать строку, второй ловит нарушение уникальности
      // telegramId. Это не ошибка — просто дочитываем созданную запись.
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const user = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
      return { user, isNew: false };
    }
  }

  if (existing.username === username && existing.firstName === firstName) {
    return { user: existing, isNew: false };
  }

  const user = await prisma.user.update({
    where: { telegramId },
    data: { username, firstName },
  });

  return { user, isNew: false };
}
