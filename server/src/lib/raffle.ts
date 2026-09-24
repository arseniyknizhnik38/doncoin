import { randomInt } from 'node:crypto';
import { EN_NFT_NAMES } from '../config/nft.js';
import type { NftItem, Raffle } from '../generated/prisma/client.js';
import { actorName, recordFeed } from './feed.js';
import { prisma } from './prisma.js';

/**
 * Розыгрыши генезис-коллекции.
 *
 * Билеты выдаются за игровые действия (бонус дня, подписка, приведённый
 * кент) и играют ровно в одном тираже: тираж считает билеты, выданные после
 * предыдущего тиража. Победитель — случайный билет: у кого билетов больше,
 * у того и шансов больше, без отдельной арифметики весов.
 */

export type TicketReason = 'daily' | 'referral' | 'favor' | 'tournament';

/** Билетов за приведённого кента — дороже всего, это и есть привлечение. */
export const REFERRAL_TICKETS = 3;

/**
 * Выписывает билеты за игровое действие.
 *
 * Ошибку глотаем: билет — приложение к бонусу, а не его условие. Игрок не
 * должен получить отказ в бонусе дня из-за того, что не записался билет.
 */
export async function grantTickets(
  userId: string,
  reason: TicketReason,
  count = 1,
): Promise<void> {
  try {
    await prisma.raffleTicket.createMany({
      data: Array.from({ length: count }, () => ({ userId, reason })),
    });
  } catch (error) {
    console.warn('[raffle] билет не выписан', error);
  }
}

/**
 * Начало окна текущего тиража: момент предыдущего тиража.
 *
 * До первого тиража окно открыто с начала времён — считаются все билеты,
 * в том числе выданные до объявления розыгрыша: билет, честно заработанный
 * бонусом дня, не должен сгорать из-за того, что владелец объявил розыгрыш
 * позже.
 */
export async function ticketWindowStart(): Promise<Date> {
  const last = await prisma.raffle.aggregate({ _max: { drawnAt: true } });

  return last._max.drawnAt ?? new Date(0);
}

/**
 * Личное сообщение об идущем розыгрыше — в тоне игры и на языке игрока.
 *
 * Никаких обещаний цены: только вещь, номер экземпляра и как получить
 * билеты. Остальное игрок решает сам.
 */
export function raffleAnnouncement(
  raffle: Raffle & { item: NftItem },
  language: string,
): string {
  const serial = raffle.item.minted + 1;

  if (language === 'en') {
    const name = EN_NFT_NAMES[raffle.item.name] ?? raffle.item.name;

    return (
      `The family is holding a raffle: “${name}”, No. ${serial} of ${raffle.item.supply} — ` +
      'no more will ever be made. Tickets come with the daily bonus, subscriptions ' +
      'and a crew member who plays. Get in before the draw.'
    );
  }

  return (
    `В семье розыгрыш: «${raffle.item.name}», № ${serial} из ${raffle.item.supply} — ` +
    'больше таких не выпустят. Билет — за бонус дня, за подписку, за кента в деле. ' +
    'Успей до тиража.'
  );
}

/** Отказ в тираже с кодом — маршрут превращает его в понятный ответ. */
export class DrawError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'DrawError';
  }
}

export interface DrawResult {
  winner: { id: string; telegramId: string; name: string };
  itemName: string;
  serial: number;
  totalTickets: number;
}

/**
 * Проводит тираж: случайный билет окна решает всё.
 *
 * Отметка drawnAt ставится условием в UPDATE до выбора победителя: два
 * одновременных запроса владельца не разыграют одну вещь дважды. Серийник
 * выдаётся тем же приёмом — счётчик minted двигается только пока он меньше
 * тиража, допечатать вещь сверх обещанного нельзя даже ошибкой.
 */
export async function drawRaffle(raffleId: string): Promise<DrawResult> {
  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    include: { item: true },
  });

  if (!raffle) {
    throw new DrawError('Розыгрыш не найден', 'RAFFLE_NOT_FOUND');
  }

  if (raffle.drawnAt) {
    throw new DrawError('Тираж уже проведён', 'ALREADY_DRAWN');
  }

  const since = await ticketWindowStart();
  const now = new Date();
  const window = { createdAt: { gt: since, lte: now } };

  const total = await prisma.raffleTicket.count({ where: window });

  if (total === 0) {
    throw new DrawError('В тираже нет ни одного билета', 'NO_TICKETS');
  }

  const [ticket] = await prisma.raffleTicket.findMany({
    where: window,
    orderBy: { id: 'asc' },
    skip: randomInt(total),
    take: 1,
    include: { user: true },
  });

  if (!ticket) {
    throw new DrawError('В тираже нет ни одного билета', 'NO_TICKETS');
  }

  const serial = await prisma.$transaction(async (tx) => {
    const claimed = await tx.raffle.updateMany({
      where: { id: raffle.id, drawnAt: null },
      data: { drawnAt: now, winnerId: ticket.userId, totalTickets: total },
    });

    if (claimed.count === 0) {
      throw new DrawError('Тираж уже проведён', 'ALREADY_DRAWN');
    }

    const counted = await tx.nftItem.updateMany({
      where: { id: raffle.itemId, minted: { lt: raffle.item.supply } },
      data: { minted: { increment: 1 } },
    });

    if (counted.count === 0) {
      throw new DrawError('Тираж вещи исчерпан', 'SUPPLY_EXHAUSTED');
    }

    const fresh = await tx.nftItem.findUniqueOrThrow({
      where: { id: raffle.itemId },
      select: { minted: true },
    });

    await tx.nftOwnership.create({
      data: {
        itemId: raffle.itemId,
        userId: ticket.userId,
        serial: fresh.minted,
        source: 'raffle',
      },
    });

    return fresh.minted;
  });

  await recordFeed({
    kind: 'raffle_won',
    actor: actorName(ticket.user),
    rival: raffle.item.name,
  });

  return {
    winner: {
      id: ticket.userId,
      telegramId: ticket.user.telegramId,
      name: actorName(ticket.user),
    },
    itemName: raffle.item.name,
    serial,
    totalTickets: total,
  };
}
