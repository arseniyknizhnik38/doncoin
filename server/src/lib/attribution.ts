import { createHash } from 'node:crypto';
import {
  CONVERSION_MIN_SECONDS,
  CONVERSION_TAPS,
  MAX_CONVERSIONS_PER_IP_HOUR,
  MIN_ACCOUNT_AGE_DAYS,
  estimateAccountAgeDays,
  type AdTag,
} from '../config/attribution.js';
import { prisma } from './prisma.js';
import { sendPostback } from './postback.js';

/**
 * Конверсии рекламной сети.
 *
 * Сеть платит за игрока, который начал играть, а не за открытое приложение:
 * открытий у любой закупки втрое больше, и платить за них значит оплачивать
 * чужих ботов. Поэтому конверсия уходит только после первого осмысленного
 * действия и только через антифрод.
 *
 * Отказы пишутся в журнал наравне с успехами: по ним потом видно, площадка
 * привела ботов или мы сами зарезали живых людей слишком строгим фильтром.
 */

/** Чем игрок доказал, что играет. */
export type ConversionTrigger =
  | { kind: 'taps'; taps: number }
  | { kind: 'business' };

/** Поля, которых достаточно для решения о конверсии. */
export interface AttributedUser {
  id: string;
  telegramId: string;
  adSource: string | null;
  adPlacement: string | null;
  adCampaign: string | null;
  adClickId: string | null;
  adLandedAt: Date | null;
  adConvertedAt: Date | null;
}

/**
 * Отпечаток адреса вместо самого адреса.
 *
 * Для правила «больше трёх с одного адреса за час» нужен лишь признак
 * одинаковости, а хранение сырых IP это персональные данные, которые
 * придётся защищать и объяснять.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) {
    return null;
  }

  const salt = process.env.AD_IP_SALT ?? process.env.CRON_SECRET ?? 'doncoin';

  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Пишет строку журнала.
 *
 * Одна строка на игрока и причину: повторная попытка лишь обновляет счётчик.
 * Иначе автокликер, который бьётся в порог сорока секунд, за минуту оставил
 * бы в журнале сотню одинаковых записей и спрятал бы в них всё остальное.
 */
async function log(input: {
  user: AttributedUser;
  status: 'sent' | 'rejected' | 'failed';
  reason: string;
  detail?: string;
  attempts?: number;
  ipHash?: string | null;
}): Promise<void> {
  const data = {
    userId: input.user.id,
    source: input.user.adSource,
    placement: input.user.adPlacement,
    clickId: input.user.adClickId,
    status: input.status,
    reason: input.reason,
    detail: input.detail ?? null,
    attempts: input.attempts ?? 0,
    ipHash: input.ipHash ?? null,
  };

  try {
    await prisma.adConversionLog.upsert({
      where: { userId_reason: { userId: input.user.id, reason: input.reason } },
      create: data,
      update: {
        status: data.status,
        detail: data.detail,
        attempts: { increment: Math.max(1, data.attempts) },
        ipHash: data.ipHash,
      },
    });
  } catch (error) {
    // Журнал это аналитика. Игрок не должен получить отказ в тапе из-за
    // того, что не записалась строка статистики.
    console.warn('[ads] не записали конверсию в журнал', error);
  }
}

/** Выполнено ли условие конверсии. */
function triggerMet(trigger: ConversionTrigger): boolean {
  return trigger.kind === 'business' || trigger.taps >= CONVERSION_TAPS;
}

/**
 * Антифрод. Возвращает причину отказа или null, если всё чисто.
 *
 * Порядок проверок от дешёвых к дорогим: сначала арифметика по уже
 * загруженным полям, и только в конце запросы к базе.
 */
async function rejectionReason(
  user: AttributedUser,
  now: Date,
  ipHash: string | null,
): Promise<{ reason: string; detail: string } | null> {
  // 1. Слишком быстро. Это не приговор: следующий тап после сорока секунд
  // пройдёт проверку и конверсия уйдёт. Отказ фиксируем, чтобы в журнале
  // осталась причина, если игрок больше не вернётся.
  const seconds = user.adLandedAt
    ? (now.getTime() - user.adLandedAt.getTime()) / 1000
    : Number.POSITIVE_INFINITY;

  if (seconds < CONVERSION_MIN_SECONDS) {
    return { reason: 'too-fast', detail: `${Math.round(seconds)}s` };
  }

  // 2. Свежий аккаунт Telegram. Оценка по идентификатору приблизительная,
  // поэтому отсутствие справочника опор трактуем в пользу игрока.
  const ageDays = estimateAccountAgeDays(user.telegramId, now);

  if (ageDays !== null && ageDays < MIN_ACCOUNT_AGE_DAYS) {
    return { reason: 'young-account', detail: `${ageDays.toFixed(1)}d` };
  }

  // 3. Тот же click id уже приводил другого игрока: сеть отдаёт клик один
  // раз, повтор означает руками подставленную ссылку.
  if (user.adClickId) {
    const twin = await prisma.user.count({
      where: {
        adClickId: user.adClickId,
        adConvertedAt: { not: null },
        id: { not: user.id },
      },
    });

    if (twin > 0) {
      return { reason: 'duplicate-click', detail: String(twin) };
    }
  }

  // 4. Поток с одного адреса.
  if (ipHash) {
    const recent = await prisma.adConversionLog.count({
      where: {
        ipHash,
        status: 'sent',
        createdAt: { gte: new Date(now.getTime() - 3_600_000) },
        userId: { not: user.id },
      },
    });

    if (recent >= MAX_CONVERSIONS_PER_IP_HOUR) {
      return { reason: 'ip-flood', detail: String(recent) };
    }
  }

  return null;
}

/**
 * Проверяет и, если пора, отправляет конверсию.
 *
 * Вызывается с горячих путей (тап, покупка бизнеса), поэтому уходит мгновенно
 * для всех, у кого метки нет или конверсия уже была: это подавляющее
 * большинство вызовов, и ни одного запроса к базе на них не тратится.
 *
 * Сама отправка в сеть не ждётся: ответ сети занимает секунды, а игрок ждёт
 * свой тап. Отметка в базе ставится до отправки, и именно она, а не ответ
 * сети, гарантирует «один раз на игрока».
 */
export async function maybeSendConversion(input: {
  user: AttributedUser;
  trigger: ConversionTrigger;
  ip?: string | null;
  now?: Date;
}): Promise<void> {
  const { user, trigger } = input;

  if (!user.adClickId || user.adConvertedAt !== null || !triggerMet(trigger)) {
    return;
  }

  const now = input.now ?? new Date();
  const ipHash = hashIp(input.ip);

  try {
    const rejection = await rejectionReason(user, now, ipHash);

    if (rejection) {
      await log({ user, status: 'rejected', ...rejection, ipHash });
      return;
    }

    // Отметка ставится условием в UPDATE: два тапа могут прийти
    // одновременно, и без условия сеть получила бы две конверсии за одного
    // игрока, то есть мы заплатили бы дважды.
    const claimed = await prisma.user.updateMany({
      where: { id: user.id, adConvertedAt: null },
      data: { adConvertedAt: now },
    });

    if (claimed.count === 0) {
      return;
    }

    const tag: AdTag = {
      source: user.adSource ?? 'unknown',
      placement: user.adPlacement,
      campaign: user.adCampaign,
      clickId: user.adClickId,
    };

    // Фоном: сервер свой, процесс живёт между запросами, поэтому обещание
    // спокойно доигрывается после ответа игроку.
    void sendPostback({
      tag,
      userId: user.telegramId,
      event: trigger.kind === 'business' ? 'first_business' : 'taps',
    })
      .then((result) =>
        log({
          user,
          status: result.status === 'sent' ? 'sent' : 'failed',
          reason: result.status === 'sent' ? 'sent' : result.reason,
          detail: result.detail,
          attempts: result.attempts,
          ipHash,
        }),
      )
      .catch((error: unknown) => {
        console.warn('[ads] postback упал', error);
      });
  } catch (error) {
    // Ни одна ошибка статистики не должна ломать игру.
    console.warn('[ads] конверсия не обработана', error);
  }
}
