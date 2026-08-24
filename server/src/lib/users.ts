import type { ParsedInitData } from './telegram.js';
import { prisma } from './prisma.js';

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
    const user = await prisma.user.create({
      data: { telegramId, username, firstName, referredByCode: parsed.startParam },
    });
    return { user, isNew: true };
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
