import type { NextFunction, Request, Response } from 'express';

/**
 * Ограничение частоты запросов — алгоритм «дырявого ведра».
 *
 * Энергия и так ограничивает заработок, поэтому цель здесь другая: не дать
 * одному клиенту заспамить базу тысячами запросов в секунду и сжечь лимиты
 * Neon и Vercel.
 *
 * Состояние держим в памяти процесса. На serverless это значит «на инстанс»:
 * при нескольких тёплых инстансах фактический лимит кратно выше. Для защиты
 * от одного зарвавшегося клиента этого достаточно, а для настоящих лимитов
 * нужен общий счётчик (Redis/Upstash) — это отдельная задача.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Сколько ключей держим, чтобы память не росла бесконечно. */
const MAX_KEYS = 5_000;

export interface RateLimitOptions {
  /** Сколько запросов в секунду разрешено в среднем. */
  perSecond: number;
  /** Разовый всплеск. */
  burst: number;
  /** Имя лимита — у каждого маршрута своё ведро. */
  name: string;
}

export function rateLimit({ perSecond, burst, name }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    // После авторизации ключ — игрок; до неё остаётся только адрес.
    const owner = (res.locals as { telegramId?: string }).telegramId ?? req.ip ?? 'unknown';
    const key = `${name}:${owner}`;
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: burst, updatedAt: now };

    // Ведро наполняется со временем до burst.
    const refill = ((now - bucket.updatedAt) / 1000) * perSecond;
    bucket.tokens = Math.min(burst, bucket.tokens + refill);
    bucket.updatedAt = now;

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) / perSecond);
      buckets.set(key, bucket);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Слишком много запросов, притормозите',
        code: 'RATE_LIMITED',
        retryAfter,
      });
      return;
    }

    bucket.tokens -= 1;

    if (buckets.size >= MAX_KEYS && !buckets.has(key)) {
      // Простейшая эвикция: убираем самую старую запись.
      const oldest = [...buckets.entries()].reduce((a, b) =>
        a[1].updatedAt <= b[1].updatedAt ? a : b,
      );
      buckets.delete(oldest[0]);
    }

    buckets.set(key, bucket);
    next();
  };
}

/** Ставятся после авторизации, чтобы ключом был игрок, а не общий IP. */
export const gameRateLimit = () =>
  rateLimit({ name: 'game', perSecond: 4, burst: 20 });

export const authRateLimit = () =>
  rateLimit({ name: 'auth', perSecond: 0.5, burst: 5 });

export const writeRateLimit = () =>
  rateLimit({ name: 'write', perSecond: 1, burst: 10 });
