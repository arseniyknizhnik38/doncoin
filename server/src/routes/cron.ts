import { Router, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import {
  BATCH_SIZE,
  IDLE_HOURS_BEFORE_NOTIFY,
  MIN_HOURS_BETWEEN_NOTIFICATIONS,
  SEND_DELAY_MS,
  isQuietTime,
} from '../config/notifications.js';
import { buildNotifyContext, draftNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { sendMessage } from '../lib/telegramApi.js';
import { settleDueWars, startWarsForWeek } from '../lib/wars.js';

export const cronRouter = Router();

/** Сравнение секретов за постоянное время. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Задачи по расписанию вызывает внешний планировщик, а не игрок, поэтому
 * авторизация здесь своя — общий секрет в заголовке.
 */
cronRouter.use((req: Request, res: Response, next) => {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    res.status(503).json({ error: 'CRON_SECRET не задан' });
    return;
  }

  // Vercel Cron сам подставляет Authorization: Bearer <CRON_SECRET> и не
  // умеет слать свои заголовки, поэтому принимаем оба варианта: свой
  // x-cron-secret для внешних планировщиков и Bearer от Vercel.
  const bearer = (req.get('authorization') ?? '').replace(/^Bearer /i, '');
  const provided = req.get('x-cron-secret') || bearer;

  if (!provided || !secretMatches(provided, expected)) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  next();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST /api/cron/notify — разослать напоминания.
 *
 * Кандидатов отбираем строго: игрок давно не заходил, давно не получал
 * сообщений, не отключил их и не заблокировал бота. Даже после этого пишем
 * только если нашёлся содержательный повод.
 */
// Vercel Cron умеет только GET, внешние планировщики обычно шлют POST.
async function runNotify(_req: Request, res: Response) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN не задан' });
    return;
  }

  const now = new Date();

  if (isQuietTime(now)) {
    res.json({ skipped: 'quiet-hours', sent: 0 });
    return;
  }

  const idleBefore = new Date(now.getTime() - IDLE_HOURS_BEFORE_NOTIFY * 3_600_000);
  const notifiedBefore = new Date(
    now.getTime() - MIN_HOURS_BETWEEN_NOTIFICATIONS * 3_600_000,
  );

  const candidates = await prisma.user.findMany({
    where: {
      notificationsEnabled: true,
      notificationsBlocked: false,
      lastSeenAt: { lt: idleBefore },
      OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: notifiedBefore } }],
    },
    orderBy: { lastSeenAt: 'asc' },
    take: BATCH_SIZE,
  });

  // Всё общее — тремя запросами на весь пакет, а не по три на человека.
  const context = await buildNotifyContext(candidates);

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  let nothingToSay = 0;

  for (const user of candidates) {
    const draft = draftNotification(user, now, context);

    if (!draft) {
      nothingToSay += 1;
      continue;
    }

    const result = await sendMessage(user.telegramId, draft.text, botToken);

    if (result === 'sent') {
      sent += 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastNotifiedAt: now },
      });
    } else if (result === 'blocked') {
      blocked += 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { notificationsBlocked: true },
      });
    } else {
      failed += 1;
    }

    await sleep(SEND_DELAY_MS);
  }

  console.log(
    `[notify] кандидатов ${candidates.length}: отправлено ${sent}, нечего сказать ${nothingToSay}, заблокировали ${blocked}, ошибок ${failed}`,
  );

  res.json({ candidates: candidates.length, sent, nothingToSay, blocked, failed });
}

cronRouter.get('/notify', runNotify);
cronRouter.post('/notify', runNotify);

/**
 * POST /api/cron/wars — подвести итоги закончившихся войн и составить пары
 * на новую неделю.
 *
 * Обе операции идемпотентны: закрытие войны «захватывает» её условным
 * UPDATE, а составление пар пропускает кланы, уже расписанные на эту неделю.
 * Поэтому лишний запуск ничего не ломает, а пропущенный — навёрстывается.
 */
async function runWars(_req: Request, res: Response) {
  const now = new Date();

  const settled = await settleDueWars(now);
  const started = await startWarsForWeek(now);

  console.log(
    `[wars] закрыто ${settled}, создано пар ${started.created}` +
      (started.skipped ? ` (пропуск: ${started.skipped})` : '') +
      (started.byeClan ? `, без пары: ${started.byeClan}` : ''),
  );

  res.json({ settled, ...started });
}

cronRouter.get('/wars', runWars);
cronRouter.post('/wars', runWars);
