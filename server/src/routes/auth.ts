import { Router, type Request, type Response } from 'express';
import { isAdmin } from '../config/admin.js';
import { DAILY_STREAK_CAP, computeOfflineEarnings, dailyStatus } from '../config/rewards.js';
import { clanBonusPercent } from '../config/perks.js';
import { collectBusinessIncome } from '../lib/businesses.js';
import { prisma as db } from '../lib/prisma.js';
import { regenerateEnergy, toGameState } from '../lib/game.js';
import { prisma } from '../lib/prisma.js';
import { createSessionToken } from '../lib/session.js';
import { InitDataError, validateInitData } from '../lib/telegram.js';
import { upsertUserFromTelegram } from '../lib/users.js';
import { authRateLimit } from '../middleware/rateLimit.js';

export const authRouter = Router();

/**
 * POST /api/auth/telegram
 * Тело: { "initData": "<сырая строка initData из Telegram SDK>" }
 *
 * Проверяет подпись, затем находит или создаёт пользователя.
 */
authRouter.post('/telegram', authRateLimit(), async (req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.status(503).json({
      error: 'TELEGRAM_BOT_TOKEN не задан на сервере (см. server/.env)',
    });
    return;
  }

  const { initData } = req.body as { initData?: unknown };

  if (typeof initData !== 'string' || initData.length === 0) {
    res.status(400).json({ error: 'Ожидалось поле initData (строка)' });
    return;
  }

  let parsed;
  try {
    parsed = validateInitData(initData, botToken);
  } catch (error) {
    if (error instanceof InitDataError) {
      // Наружу не раскрываем детали проверки подписи.
      res.status(401).json({ error: 'initData не прошли проверку', code: error.code });
      return;
    }
    throw error;
  }

  const { user: stored, isNew } = await upsertUserFromTelegram(parsed);
  const now = new Date();

  // Пока игрока не было, «семья работала». Начисляем сразу при входе, а не
  // по кнопке: одна запись в базу вместо двух, и деньги нельзя потерять,
  // закрыв приложение до нажатия.
  // Прибавка к пассивному доходу: свой перк «Связи в семье» плюс клан.
  const clan = stored.clanId
    ? await db.clan.findUnique({
        where: { id: stored.clanId },
        select: { treasury: true, familyXp: true },
      })
    : null;
  const offlineBonus = stored.respectFamilyLevel * 5 + clanBonusPercent(clan);

  const offline = isNew
    ? { earned: 0n, hours: 0, capped: false }
    : computeOfflineEarnings(stored, now, offlineBonus);

  const user =
    offline.earned > 0n
      ? await prisma.user.update({
          where: { id: stored.id },
          data: {
            balance: { increment: offline.earned },
            totalEarned: { increment: offline.earned },
            lastSeenAt: now,
          },
        })
      : await prisma.user.update({
          where: { id: stored.id },
          data: { lastSeenAt: now },
        });

  // Бизнесы работают независимо от тапов — начисляем их доход тем же входом.
  const business = isNew
    ? { earned: 0n, perHour: 0n }
    : await collectBusinessIncome(user, now);

  const withBusiness =
    business.earned > 0n
      ? { ...user, balance: user.balance + business.earned, totalEarned: user.totalEarned + business.earned }
      : user;

  // Энергия в базе — на момент последнего запроса. Пересчитываем на сейчас,
  // иначе после паузы игрок увидел бы старое значение.
  const { energy } = regenerateEnergy(withBusiness, now);

  const session = createSessionToken(user.telegramId, botToken);

  res.json({
    isNew,
    // Дальнейшие запросы идут с этим токеном, а не с initData.
    session: { token: session.token, expiresAt: session.expiresAt },
    isAdmin: isAdmin(user.telegramId),
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      referredByCode: user.referredByCode,
      createdAt: user.createdAt,
    },
    state: toGameState({ ...withBusiness, energy }),
    offline: {
      earned: offline.earned.toString(),
      hours: Number(offline.hours.toFixed(2)),
      capped: offline.capped,
    },
    daily: { ...dailyStatus(withBusiness, now), streakCap: DAILY_STREAK_CAP },
    business: {
      earned: business.earned.toString(),
      perHour: business.perHour.toString(),
    },
  });
});
