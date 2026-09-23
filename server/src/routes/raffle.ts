import { Router, type Request, type Response } from 'express';
import { actorName } from '../lib/feed.js';
import { prisma } from '../lib/prisma.js';
import { ticketWindowStart } from '../lib/raffle.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const raffleRouter = Router();

raffleRouter.use(requireTelegramAuth);
raffleRouter.use(writeRateLimit());

const NOT_FOUND = {
  error: 'Пользователь не найден, войдите заново',
  code: 'USER_NOT_FOUND',
};

/**
 * GET /api/raffle — текущий розыгрыш, билеты игрока и его сейф.
 *
 * Один запрос на всё: карточка в «Заданиях» рисуется целиком из этого
 * ответа, и клиенту не нужно склеивать три источника.
 */
raffleRouter.get('/', async (_req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    res.status(404).json(NOT_FOUND);
    return;
  }

  const since = await ticketWindowStart();

  const [active, myTickets, totalTickets, vault, lastDrawn] = await Promise.all([
    prisma.raffle.findFirst({
      where: { drawnAt: null },
      orderBy: { createdAt: 'asc' },
      include: { item: true },
    }),
    prisma.raffleTicket.count({
      where: { userId: user.id, createdAt: { gt: since } },
    }),
    prisma.raffleTicket.count({ where: { createdAt: { gt: since } } }),
    prisma.nftOwnership.findMany({
      where: { userId: user.id },
      orderBy: { wonAt: 'desc' },
      include: { item: true },
    }),
    prisma.raffle.findFirst({
      where: { drawnAt: { not: null } },
      orderBy: { drawnAt: 'desc' },
      include: { item: true, winner: true },
    }),
  ]);

  res.json({
    raffle: {
      active: active
        ? {
            id: active.id,
            endsAt: active.endsAt,
            myTickets,
            totalTickets,
            item: {
              id: active.item.id,
              name: active.item.name,
              description: active.item.description,
              icon: active.item.icon,
              rarity: active.item.rarity,
              supply: active.item.supply,
              minted: active.item.minted,
            },
          }
        : null,
      lastWinner:
        lastDrawn && lastDrawn.winner
          ? { name: actorName(lastDrawn.winner), itemName: lastDrawn.item.name }
          : null,
      vault: vault.map((owned) => ({
        id: owned.id,
        itemId: owned.itemId,
        name: owned.item.name,
        icon: owned.item.icon,
        rarity: owned.item.rarity,
        serial: owned.serial,
        supply: owned.item.supply,
        wonAt: owned.wonAt,
      })),
    },
  });
});
