import type { NextFunction, Request, Response } from 'express';
import { InitDataError, validateInitData } from '../lib/telegram.js';
import { SessionError, verifySessionToken } from '../lib/session.js';

export interface AuthLocals {
  telegramId: string;
}

export function getTelegramId(res: Response): string {
  return (res.locals as AuthLocals).telegramId;
}

/**
 * Авторизация игровых запросов. Принимаем два варианта заголовка:
 *
 *   Authorization: Bearer <сессионный токен>   — основной
 *   Authorization: tma <raw initData>          — запасной
 *
 * Сессионный токен выдаётся при входе и живёт неделю. Запасной вариант
 * оставлен для уже открытых вкладок со старой версией клиента: они
 * продолжают работать, пока пользователь не перезапустит приложение.
 *
 * В базу здесь не ходим: пользователя достают сами обработчики тем же
 * запросом, которым читают или пишут состояние.
 */
export function requireTelegramAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN не задан на сервере' });
    return;
  }

  const header = req.get('authorization') ?? '';
  const separator = header.indexOf(' ');
  const scheme = header.slice(0, separator);
  const value = header.slice(separator + 1);

  if (!value) {
    res.status(401).json({ error: 'Нужен заголовок Authorization', code: 'NO_AUTH' });
    return;
  }

  try {
    if (scheme === 'Bearer') {
      (res.locals as AuthLocals).telegramId = verifySessionToken(value, botToken).sub;
      next();
      return;
    }

    if (scheme === 'tma') {
      (res.locals as AuthLocals).telegramId = String(
        validateInitData(value, botToken).user.id,
      );
      next();
      return;
    }

    res.status(401).json({ error: 'Неизвестная схема авторизации', code: 'NO_AUTH' });
  } catch (error) {
    if (error instanceof SessionError) {
      // EXPIRED — сигнал клиенту, что нужно заново пройти вход.
      res.status(401).json({ error: 'Сессия истекла, войдите заново', code: error.code });
      return;
    }

    if (error instanceof InitDataError) {
      res.status(401).json({ error: 'initData не прошли проверку', code: error.code });
      return;
    }

    next(error);
  }
}
