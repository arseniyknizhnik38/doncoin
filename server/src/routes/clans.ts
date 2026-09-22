import { Router, type Request, type Response } from 'express';
import {
  TRIBUTE_MAX_PERCENT,
  clanBonusPercent,
  clanLevel,
  clanPower,
} from '../config/perks.js';
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
  startWarsForWeek,
} from '../lib/wars.js';
import { recordFeed } from '../lib/feed.js';
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
    tributePercent: clan.tributePercent,
    tributeMax: TRIBUTE_MAX_PERCENT,
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

  // Планировщик на бесплатном тарифе ходит раз в сутки и может не сработать
  // вовсе, поэтому война умеет жить и без него: здесь закрываются войны с
  // вышедшим сроком, а если у клана войны нет — составляются пары. Обе
  // операции идемпотентны, а когда война уже идёт, вторая даже не вызывается.
  if (user.clanId) {
    const now = new Date();

    await settleDueWars(now, user.clanId);

    if (!(await hasActiveWar(user.clanId))) {
      await startWarsForWeek(now);
    }
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
    throw new ClanError('ALREADY_IN_CLAN', 'Вы уже состоите в семье');
  }

  const name = normalizeClanName((req.body as { name?: unknown }).name);

  // Проверка без учёта регистра — для понятной ошибки. Настоящую гарантию
  // даёт функциональный индекс lower(name) в базе, он же ловит гонку.
  const taken = await prisma.clan.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });

  if (taken) {
    throw new ClanError('NAME_TAKEN', 'Семья с таким названием уже есть');
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
    await recordFeed({ kind: 'clan_created', actor: clan.name });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new ClanError('NAME_TAKEN', 'Семья с таким названием уже есть');
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
    throw new ClanError('ALREADY_IN_CLAN', 'Вы уже состоите в семье');
  }

  const rawId = req.params.id;
  const clanId = Array.isArray(rawId) ? rawId[0] : rawId;
  const clan = clanId ? await prisma.clan.findUnique({ where: { id: clanId } }) : null;

  if (!clan) {
    throw new ClanError('CLAN_NOT_FOUND', 'Семья не найдена', 404);
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
    throw new ClanError('NOT_IN_CLAN', 'Вы не состоите в семье');
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
        'Владелец не может выйти, пока в семье есть другие люди',
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
    throw new ClanError('NOT_IN_CLAN', 'Вы не состоите в семье');
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

  const beforeDonation = await prisma.clan.findUnique({
    where: { id: user.clanId },
    select: { name: true, treasury: true, familyXp: true },
  });

  const raised = await prisma.clan.update({
    where: { id: user.clanId },
    data: { treasury: { increment: amount } },
    select: { name: true, treasury: true, familyXp: true },
  });

  // Уровень семьи нигде не хранится — он считается от кассы и опыта. Момент
  // взятия уровня ловим сравнением «до и после»: другого способа узнать,
  // что порог только что перешли, нет.
  if (beforeDonation && clanLevel(raised) > clanLevel(beforeDonation)) {
    await recordFeed({
      kind: 'clan_level',
      actor: raised.name,
      amount: BigInt(clanLevel(raised)),
    });
  }

  // Состояние собираем локально: UPDATE прошёл с условием «денег хватает»,
  // значит результат известен и лишний запрос к базе не нужен.
  const fresh = { ...user, balance: user.balance - amount };
  const { energy } = regenerateEnergy(fresh, new Date());

  res.json({
    myClan: await describeMyClan(user.clanId, user.id),
    state: toGameState({ ...fresh, energy }),
  });
});

/**
 * POST /api/clans/tribute — глава задаёт долю, которую участники отстёгивают
 * в кассу с дохода бизнесов.
 *
 * Потолок в коде, а не на усмотрение главы: поставивший девяносто процентов
 * разогнал бы семью за вечер, и механика привязки стала бы способом её
 * разрушить.
 */
clansRouter.post('/tribute', async (req: Request, res: Response) => {
  const user = await loadUser(res);

  if (!user.clanId) {
    throw new ClanError('NOT_IN_CLAN', 'Вы не состоите в семье');
  }

  const clan = await prisma.clan.findUniqueOrThrow({ where: { id: user.clanId } });

  if (clan.ownerId !== user.id) {
    throw new ClanError('NOT_OWNER', 'Долю задаёт глава семьи', 403);
  }

  const raw = (req.body as { percent?: unknown }).percent;

  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > TRIBUTE_MAX_PERCENT) {
    throw new ClanError(
      'BAD_TRIBUTE',
      `Доля — целое число от 0 до ${TRIBUTE_MAX_PERCENT}`,
      400,
    );
  }

  await prisma.clan.update({
    where: { id: clan.id },
    data: { tributePercent: raw },
  });

  res.json({ myClan: await describeMyClan(clan.id, user.id) });
});
