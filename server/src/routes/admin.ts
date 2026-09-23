import { Router, type Request, type Response } from 'express';
import { AD_STATUS_TITLES, adStatus, isChatId, isTelegramUrl } from '../config/ads.js';
import { isAdmin } from '../config/admin.js';
import { isValidCipher, normalizeCipher } from '../config/cipher.js';
import { utcDayNumber } from '../config/rewards.js';
import { dailyCounts, retention } from '../lib/analytics.js';
import { setCipher } from '../lib/cipher.js';
import { omertaForOwner } from '../lib/omerta.js';
import { prisma } from '../lib/prisma.js';
import { diagnoseChannel } from '../lib/telegramApi.js';
import { writeRateLimit } from '../middleware/rateLimit.js';
import { getTelegramId, requireTelegramAuth } from '../middleware/telegramAuth.js';

export const adminRouter = Router();

adminRouter.use(requireTelegramAuth);
adminRouter.use(writeRateLimit());

/** Отсекаем всех, кроме перечисленных в ADMIN_TELEGRAM_IDS. */
adminRouter.use((_req: Request, res: Response, next) => {
  if (!isAdmin(getTelegramId(res))) {
    // 404, а не 403: посторонним незачем знать, что такой раздел существует.
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  next();
});

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

/** GET /api/admin/stats — сводка по игрокам, воронке и экономике. */
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const day = hoursAgo(24);
  const week = hoursAgo(24 * 7);

  const [
    total,
    newToday,
    newWeek,
    dau,
    wau,
    withUpgrade,
    withBusiness,
    inClan,
    claimedDaily,
    invited,
    completedFavor,
    money,
    clans,
    topPlayers,
    returnedRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: day } } }),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: day } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: week } } }),
    prisma.user.count({
      where: {
        OR: [{ tapLevel: { gt: 0 } }, { energyLevel: { gt: 0 } }, { regenLevel: { gt: 0 } }],
      },
    }),
    prisma.userBusiness.findMany({ distinct: ['userId'], select: { userId: true } }),
    prisma.user.count({ where: { clanId: { not: null } } }),
    prisma.user.count({ where: { lastDailyAt: { not: null } } }),
    prisma.user.count({ where: { referredById: { not: null } } }),
    prisma.favorCompletion.findMany({ distinct: ['userId'], select: { userId: true } }),
    prisma.user.aggregate({
      _sum: { balance: true, totalEarned: true },
      _max: { totalEarned: true },
    }),
    prisma.clan.count(),
    prisma.user.findMany({
      orderBy: { totalEarned: 'desc' },
      take: 5,
      select: { firstName: true, username: true, totalEarned: true, lastSeenAt: true },
    }),
    // Вернулся ли игрок хотя бы через сутки после регистрации — сравнение
    // двух колонок, которого нет в обычном where.
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "User"
      WHERE "lastSeenAt" >= "createdAt" + INTERVAL '24 hours'
    `,
  ]);

  const olderThanDay = await prisma.user.count({
    where: { createdAt: { lt: day } },
  });
  const returned = Number(returnedRows[0]?.count ?? 0n);

  // ——— Источники трафика.
  //
  // Рекламному каналу выдаётся ссылка с меткой: ?startapp=ad-название.
  // Метка проходит дорогой реферального кода, но кода такого нет — игрок
  // остаётся без пригласившего, а сырая строка лежит в referredByCode.
  // Здесь она превращается в цену игрока по каждому каналу: сколько пришло,
  // сколько вернулось через сутки, сколько выполнило подписку.
  const sourceRows = await prisma.$queryRaw<
    { tag: string; total: bigint; returned: bigint; eligible: bigint }[]
  >`
    SELECT
      "referredByCode" AS tag,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "lastSeenAt" >= "createdAt" + INTERVAL '24 hours')::bigint AS returned,
      COUNT(*) FILTER (WHERE "createdAt" < ${day})::bigint AS eligible
    FROM "User"
    WHERE "referredById" IS NULL AND "referredByCode" IS NOT NULL
    GROUP BY "referredByCode"
    ORDER BY total DESC
    LIMIT 50
  `;

  const sourceFavors = await prisma.$queryRaw<{ tag: string; favors: bigint }[]>`
    SELECT u."referredByCode" AS tag, COUNT(*)::bigint AS favors
    FROM "FavorCompletion" fc
    JOIN "User" u ON u.id = fc."userId"
    WHERE u."referredById" IS NULL AND u."referredByCode" IS NOT NULL
    GROUP BY u."referredByCode"
  `;

  const favorsByTag = new Map(sourceFavors.map((row) => [row.tag, Number(row.favors)]));

  const sources = sourceRows.map((row) => ({
    tag: row.tag,
    total: Number(row.total),
    returnedNextDay: Number(row.returned),
    eligibleForReturn: Number(row.eligible),
    favors: favorsByTag.get(row.tag) ?? 0,
  }));

  res.json({
    players: {
      total,
      newToday,
      newWeek,
      dau,
      wau,
      /** Из тех, кто зарегистрировался больше суток назад. */
      returnedNextDay: returned,
      eligibleForReturn: olderThanDay,
    },
    sources,
    // Удержание по когортам: заходил ли игрок именно на N-й день после
    // регистрации. Это и есть ответ на вопрос, жива ли игра.
    retention: await retention(now),
    days: await dailyCounts(now),
    funnel: {
      boughtUpgrade: withUpgrade,
      boughtBusiness: withBusiness.length,
      joinedClan: inClan,
      claimedDaily,
      cameFromReferral: invited,
      completedFavor: completedFavor.length,
    },
    economy: {
      inCirculation: (money._sum.balance ?? 0n).toString(),
      totalEarned: (money._sum.totalEarned ?? 0n).toString(),
      richest: (money._max.totalEarned ?? 0n).toString(),
      clans,
    },
    top: topPlayers.map((player) => ({
      name: player.firstName ?? (player.username ? `@${player.username}` : 'Аноним'),
      totalEarned: player.totalEarned.toString(),
      lastSeenAt: player.lastSeenAt,
    })),
  });
});

/**
 * GET /api/admin/cipher — шифры на ближайшие две недели и на вчера.
 *
 * Вчерашний нужен, чтобы было видно, сколько человек его разгадало: это
 * прямая мера того, доходит ли аудитория до канала.
 */
adminRouter.get('/cipher', async (_req: Request, res: Response) => {
  const today = utcDayNumber(new Date());

  const ciphers = await prisma.dailyCipher.findMany({
    where: { dayNumber: { gte: today - 1, lte: today + 14 } },
    orderBy: { dayNumber: 'asc' },
    include: { _count: { select: { solves: true } } },
  });

  res.json({
    today,
    ciphers: ciphers.map((cipher) => ({
      dayNumber: cipher.dayNumber,
      /** Смещение в сутках от сегодняшних: 0 — сегодня, 1 — завтра. */
      day: cipher.dayNumber - today,
      code: cipher.code,
      hint: cipher.hint,
      solves: cipher._count.solves,
    })),
  });
});

/**
 * POST /api/admin/cipher — завести шифр дня.
 *
 * Тело: `{ "code": "ОМЕРТА", "hint": "Ищите в закрепе", "day": 0 }`,
 * где `day` — смещение в сутках от сегодняшних (0 — сегодня, 1 — завтра).
 * Готовить шифр заранее удобно: код должен появиться в канале раньше, чем
 * игроки начнут его искать.
 */
adminRouter.post('/cipher', async (req: Request, res: Response) => {
  const body = req.body as { code?: unknown; hint?: unknown; day?: unknown };
  const code = typeof body?.code === 'string' ? normalizeCipher(body.code) : '';

  if (!isValidCipher(code)) {
    res.status(400).json({
      error: 'Код — 3–32 буквы или цифры, без пробелов',
      code: 'BAD_CODE',
    });
    return;
  }

  const offset = typeof body?.day === 'number' && Number.isInteger(body.day) ? body.day : 0;

  if (offset < 0 || offset > 30) {
    res.status(400).json({ error: 'Смещение — от 0 до 30 дней', code: 'BAD_DAY' });
    return;
  }

  const hint = typeof body?.hint === 'string' && body.hint.trim() ? body.hint.trim() : null;
  const saved = await setCipher(utcDayNumber(new Date()) + offset, code, hint);

  res.json({ cipher: { ...saved, hint } });
});

/**
 * GET /api/admin/ads — все рекламные кампании со статусом и выдачей.
 *
 * Это же отчёт рекламодателю: сколько подписок выдано из купленных и когда
 * кампания закрылась.
 */
adminRouter.get('/ads', async (_req: Request, res: Response) => {
  const now = new Date();
  const favors = await prisma.favor.findMany({
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({
    ads: favors.map((favor) => ({
      id: favor.id,
      advertiser: favor.advertiser,
      title: favor.title,
      channelName: favor.channelName,
      channelUrl: favor.channelUrl,
      channelChatId: favor.channelChatId,
      rewardDonc: favor.rewardDonc.toString(),
      rewardHours: favor.rewardHours,
      familyXpReward: favor.familyXpReward,
      startsAt: favor.startsAt,
      endsAt: favor.endsAt,
      slots: favor.slots,
      completedCount: favor.completedCount,
      sortOrder: favor.sortOrder,
      status: adStatus(favor, now),
      statusTitle: AD_STATUS_TITLES[adStatus(favor, now)],
    })),
  });
});

/** Разбор необязательной даты из тела запроса. */
function parseDate(value: unknown): Date | null | undefined {
  if (value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * POST /api/admin/ads — завести кампанию или обновить существующую.
 *
 * Ключ — канал: второй заказ на тот же канал перезаписывает первый. Две
 * кампании на один канал всё равно бессмысленны, подписка-то одна.
 */
adminRouter.post('/ads', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const channelName = typeof body.channelName === 'string' ? body.channelName.trim() : '';
  const channelUrl = typeof body.channelUrl === 'string' ? body.channelUrl.trim() : '';
  const channelChatId =
    typeof body.channelChatId === 'string' ? body.channelChatId.trim() : '';

  const bad = (error: string, code: string) => res.status(400).json({ error, code });

  if (title.length < 3 || title.length > 120) {
    bad('Заголовок — от 3 до 120 символов', 'BAD_TITLE');
    return;
  }

  if (channelName.length < 2 || channelName.length > 64) {
    bad('Название канала — от 2 до 64 символов', 'BAD_CHANNEL');
    return;
  }

  if (!isTelegramUrl(channelUrl)) {
    bad('Ссылка должна быть вида https://t.me/канал', 'BAD_URL');
    return;
  }

  if (!isChatId(channelChatId)) {
    bad('ID канала — @username или число вида -100…', 'BAD_CHAT_ID');
    return;
  }

  const rewardDonc =
    typeof body.rewardDonc === 'number' && body.rewardDonc >= 0
      ? BigInt(Math.floor(body.rewardDonc))
      : null;

  if (rewardDonc === null) {
    bad('Награда — неотрицательное число', 'BAD_REWARD');
    return;
  }

  const rewardHours =
    body.rewardHours === null || body.rewardHours === undefined
      ? null
      : typeof body.rewardHours === 'number' && body.rewardHours > 0 && body.rewardHours <= 48
        ? body.rewardHours
        : undefined;

  if (rewardHours === undefined) {
    bad('Награда в часах — от 0 до 48 либо пусто', 'BAD_REWARD_HOURS');
    return;
  }

  const startsAt = parseDate(body.startsAt ?? null);
  const endsAt = parseDate(body.endsAt ?? null);

  if (startsAt === undefined || endsAt === undefined) {
    bad('Даты — в формате ISO либо пусто', 'BAD_DATE');
    return;
  }

  if (startsAt && endsAt && endsAt <= startsAt) {
    bad('Конец размещения раньше начала', 'BAD_PERIOD');
    return;
  }

  const slots =
    body.slots === null || body.slots === undefined
      ? null
      : typeof body.slots === 'number' && Number.isInteger(body.slots) && body.slots > 0
        ? body.slots
        : undefined;

  if (slots === undefined) {
    bad('Лимит подписок — целое число больше нуля либо пусто', 'BAD_SLOTS');
    return;
  }

  const data = {
    advertiser:
      typeof body.advertiser === 'string' && body.advertiser.trim()
        ? body.advertiser.trim()
        : null,
    title,
    channelName,
    channelUrl,
    channelChatId,
    rewardDonc,
    rewardHours,
    familyXpReward:
      typeof body.familyXpReward === 'number' && body.familyXpReward >= 0
        ? Math.floor(body.familyXpReward)
        : 20,
    startsAt,
    endsAt,
    slots,
    sortOrder:
      typeof body.sortOrder === 'number' && Number.isInteger(body.sortOrder)
        ? body.sortOrder
        : 0,
    active: body.active === false ? false : true,
  };

  const saved = await prisma.favor.upsert({
    where: { weekNumber_channelName: { weekNumber: 0, channelName } },
    update: data,
    create: { ...data, weekNumber: 0 },
  });

  res.json({ ad: { id: saved.id, channelName: saved.channelName } });
});

/**
 * POST /api/admin/ads/:id/stop — снять кампанию с показа.
 *
 * Именно снять, а не удалить: у игроков остались отметки о выполнении, и
 * по ним считается отчёт рекламодателю.
 */
adminRouter.post('/ads/:id/stop', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const stopped = await prisma.favor.updateMany({
    where: { id: id ?? '' },
    data: { active: false },
  });

  if (stopped.count === 0) {
    res.status(404).json({ error: 'Кампания не найдена', code: 'AD_NOT_FOUND' });
    return;
  }

  res.json({ stopped: true });
});

/**
 * POST /api/admin/ads/:id/diagnose — сможет ли бот проверять подписку.
 *
 * Игрок при сбое видит только «не получилось проверить»; здесь владелец
 * узнаёт конкретную причину и что исправить.
 */
adminRouter.post('/ads/:id/diagnose', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const favor = await prisma.favor.findUnique({ where: { id: id ?? '' } });

  if (!favor) {
    res.status(404).json({ error: 'Кампания не найдена', code: 'AD_NOT_FOUND' });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.json({ diagnosis: { ok: false, message: 'На сервере не задан TELEGRAM_BOT_TOKEN' } });
    return;
  }

  res.json({ diagnosis: await diagnoseChannel(favor.channelChatId, botToken) });
});

/** GET /api/admin/omerta — ответ Шифра Омерты на сегодня и завтра. */
adminRouter.get('/omerta', async (_req: Request, res: Response) => {
  res.json({ omerta: await omertaForOwner(new Date()) });
});
