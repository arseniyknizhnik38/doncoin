import { Router, type Request, type Response } from 'express';
import { clanBonusPercent, clanLevel, clanPower } from '../config/perks.js';
import { clanRank, resolveRank } from '../config/ranks.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import {
  CLAN_LIST_LIMIT,
  ClanError,
  assertCanJoinClans,
  normalizeClanName,
  parseDonation,
} from '../lib/clans.js';
import {
  describeWar,
  enlistInActiveWar,
  freezeWarEntries,
  hasActiveWar,
  settleDueWars,
} from '../lib/wars.js';
import { prisma } from '../lib/prisma.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const clansRouter = Router();

clansRouter.use(requireTelegramAuth);
clansRouter.use(writeRateLimit());

const memberSelect = {
  firstName: true,
  username: true,
  balance: true,
  totalEarned: true,
  clanContributed: true,
  clanJoinedAt: true,
} as const;

async function loadUser(res: Response) {
  const user = await prisma.user.findUnique({
    where: { telegramId: getTelegramId(res) },
  });

  if (!user) {
    throw new ClanError('CLAN_NOT_FOUND', 'Пользователь не найден, войдите заново', 404);
  }

  return user;
}

function serializeMember(member: {
  firstName: string | null;
  username: string | null;
  balance: bigint;
  totalEarned: bigint;
  clanContributed: bigint;
  clanJoinedAt: Date | null;
}) {
  return {
    firstName: member.firstName,
    username: member.username,
    balance: member.balance.toString(),
    contributed: member.clanContributed.toString(),
    joinedAt: member.clanJoinedAt,
    rank: resolveRank(member.totalEarned).title,
  };
}

async function describeMyClan(clanId: string | null, ownerId: string) {
  if (!clanId) {
    return null;
  }

  const clan = await prisma.clan.findUnique({
    where: { id: clanId },
    include: {
      members: { orderBy: { clanContributed: 'desc' }, select: memberSelect },
      owner: { select: { id: true, firstName: true, username: true } },
    },
  });

  if (!clan) {
    return null;
  }

  return {
    id: clan.id,
    name: clan.name,
    treasury: clan.treasury.toString(),
    familyXp: clan.familyXp,
    level: clanLevel(clan),
    power: clanPower(clan).toString(),
    bonusPercent: clanBonusPercent(clan),
    memberCount: clan.members.length,
    isOwner: clan.owner.id === ownerId,
    owner: { firstName: clan.owner.firstName, username: clan.owner.username },
    members: clan.members.map(serializeMember),
  };
}

/** GET /api/clans — мой клан, список кланов и доступность вступления. */
clansRouter.get('/', async (_req: Request, res: Response) => {
  const user = await loadUser(res);

  // Планировщик на бесплатном тарифе ходит раз в сутки, поэтому итоги войны
  // подводятся ещё и здесь — игрок не должен видеть войну, срок которой вышел.
  if (user.clanId) {
    await settleDueWars(new Date(), user.clanId);
  }

  const clans = await prisma.clan.findMany({
    orderBy: [{ treasury: 'desc' }, { createdAt: 'asc' }],
    take: CLAN_LIST_LIMIT,
    select: {
      id: true,
      name: true,
      treasury: true,
      _count: { select: { members: true } },
    },
  });

  const required = clanRank();

  res.json({
    canJoin: resolveRank(user.totalEarned).canJoinClan,
    requiredRank: {
      code: required.code,
      title: required.title,
      minBalance: required.minBalance.toString(),
    },
    myClan: await describeMyClan(user.clanId, user.id),
    war: user.clanId ? await describeWar(user.clanId, user.id) : null,
    clans: clans.map((clan) => ({
      id: clan.id,
      name: clan.name,
      treasury: clan.treasury.toString(),
      memberCount: clan._count.members,
    })),
  });
});

/** POST /api/clans — создать клан и стать его владельцем. */
clansRouter.post('/', async (req: Request, res: Response) => {
  const user = await loadUser(res);
  assertCanJoinClans(user);

  if (user.clanId) {
    throw new ClanError('ALREADY_IN_CLAN', 'Вы уже состоите в клане');
  }

  const name = normalizeClanName((req.body as { name?: unknown }).name);

  // Проверка без учёта регистра — для понятной ошибки. Настоящую гарантию
  // даёт функциональный индекс lower(name) в базе, он же ловит гонку.
  const taken = await prisma.clan.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });

  if (taken) {
    throw new ClanError('NAME_TAKEN', 'Клан с таким названием уже есть');
  }

  let clan;

  try {
    clan = await prisma.clan.create({
      data: {
        name,
        ownerId: user.id,
        members: { connect: { id: user.id } },
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new ClanError('NAME_TAKEN', 'Клан с таким названием уже есть');
    }

    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { clanJoinedAt: new Date() },
  });

  res.status(201).json({ myClan: await describeMyClan(clan.id, user.id) });
});

/** POST /api/clans/:id/join */
clansRouter.post('/:id/join', async (req: Request, res: Response) => {
  const user = await loadUser(res);
  assertCanJoinClans(user);

  if (user.clanId) {
    throw new ClanError('ALREADY_IN_CLAN', 'Вы уже состоите в клане');
  }

  const rawId = req.params.id;
  const clanId = Array.isArray(rawId) ? rawId[0] : rawId;
  const clan = clanId ? await prisma.clan.findUnique({ where: { id: clanId } }) : null;

  if (!clan) {
    throw new ClanError('CLAN_NOT_FOUND', 'Клан не найден', 404);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { clanId: clan.id, clanJoinedAt: new Date(), clanContributed: 0n },
  });

  // Пришедшего в середине войны сразу зачисляем в состав — со слепком «с нуля».
  await enlistInActiveWar(clan.id, user.id, user.totalEarned);

  res.json({ myClan: await describeMyClan(clan.id, user.id) });
});

/** POST /api/clans/leave — выйти; владелец распускает клан. */
clansRouter.post('/leave', async (_req: Request, res: Response) => {
  const user = await loadUser(res);

  if (!user.clanId) {
    throw new ClanError('NOT_IN_CLAN', 'Вы не состоите в клане');
  }

  const clan = await prisma.clan.findUniqueOrThrow({
    where: { id: user.clanId },
    include: { _count: { select: { members: true } } },
  });

  if (clan.ownerId === user.id) {
    if (await hasActiveWar(clan.id)) {
      throw new ClanError(
        'WAR_IN_PROGRESS',
        'Нельзя распустить семью, пока идёт война',
      );
    }

    if (clan._count.members > 1) {
      throw new ClanError(
        'OWNER_MUST_DISBAND',
        'Владелец не может выйти, пока в клане есть другие участники',
      );
    }

    // Последний участник — клан распускается вместе с казной.
    await prisma.clan.delete({ where: { id: clan.id } });
    res.json({ myClan: null, disbanded: true });
    return;
  }

  // Вклад в идущую войну остаётся клану: иначе выход в последний день
  // обнулял бы счёт соклановцам.
  await freezeWarEntries(prisma, user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { clanId: null, clanJoinedAt: null, clanContributed: 0n },
  });

  res.json({ myClan: null, disbanded: false });
});

/** POST /api/clans/donate — внести монеты в казну клана. */
clansRouter.post('/donate', async (req: Request, res: Response) => {
  const user = await loadUser(res);

  if (!user.clanId) {
    throw new ClanError('NOT_IN_CLAN', 'Вы не состоите в клане');
  }

  const amount = parseDonation((req.body as { amount?: unknown }).amount, user.balance);

  // Списание с условием «денег хватает» — иначе два одновременных взноса
  // могли бы увести баланс в минус.
  const spent = await prisma.user.updateMany({
    where: { id: user.id, balance: { gte: amount } },
    data: {
      balance: { decrement: amount },
      clanContributed: { increment: amount },
    },
  });

  if (spent.count === 0) {
    throw new ClanError('NOT_ENOUGH_COINS', 'Недостаточно монет для взноса');
  }

  await prisma.clan.update({
    where: { id: user.clanId },
    data: { treasury: { increment: amount } },
  });

  // Состояние собираем локально: UPDATE прошёл с условием «денег хватает»,
  // значит результат известен и лишний запрос к базе не нужен.
  const fresh = { ...user, balance: user.balance - amount };
  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    myClan: await describeMyClan(user.clanId, user.id),
    state: toGameState({ ...fresh, energy }),
  });
});
