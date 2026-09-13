import { format, pickLangStored } from '../config/i18n.js';
import { COMEBACK_TO_INVITER, kushFor } from '../config/snitch.js';
import type { User } from '../generated/prisma/client.js';
import { actorName } from './feed.js';
import { prisma } from './prisma.js';
import { sendMessage } from './telegramApi.js';

export interface Comeback {
  /** Куш вернувшемуся. */
  amount: bigint;
  /** Кто за него поручился — показываем в игре. */
  inviter: string | null;
}

/**
 * Кент вернулся после «подозрения» — платим обоим.
 *
 * Отметка снимается условием в UPDATE: вход может прийти дважды подряд
 * (перевход, двойной эффект в клиенте), а куш должен выдаться один раз.
 */
export async function payComebackIfPending(user: User): Promise<Comeback | null> {
  if (!user.snitchPending) {
    return null;
  }

  const amount = kushFor(user);

  const taken = await prisma.user.updateMany({
    where: { id: user.id, snitchPending: true },
    data: {
      snitchPending: false,
      balance: { increment: amount },
      totalEarned: { increment: amount },
      lifetimeEarned: { increment: amount },
    },
  });

  if (taken.count === 0) {
    return null;
  }

  const inviter = user.referredById
    ? await prisma.user.findUnique({ where: { id: user.referredById } })
    : null;

  if (!inviter) {
    return { amount, inviter: null };
  }

  const inviterAmount = kushFor(inviter);

  await prisma.user.update({
    where: { id: inviter.id },
    data: {
      balance: { increment: inviterAmount },
      totalEarned: { increment: inviterAmount },
      lifetimeEarned: { increment: inviterAmount },
      referralEarned: { increment: inviterAmount },
    },
  });

  // Пригласивший должен узнать, за что ему прилетело, — иначе куш выглядит
  // как ошибка в балансе. Отказ Telegram куш не отменяет.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken && inviter.notificationsEnabled && !inviter.notificationsBlocked) {
    const text = format(COMEBACK_TO_INVITER[pickLangStored(inviter.language)], {
      friend: actorName(user),
      amount: Number(inviterAmount).toLocaleString('ru-RU'),
    });
    const result = await sendMessage(inviter.telegramId, text, botToken);

    if (result === 'blocked') {
      await prisma.user.update({
        where: { id: inviter.id },
        data: { notificationsBlocked: true },
      });
    }
  }

  return { amount, inviter: actorName(inviter) };
}
