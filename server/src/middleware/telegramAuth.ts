import type { NextFunction, Request, Response } from 'express';
import { InitDataError, type TelegramUser, validateInitData } from '../lib/telegram.js';

export interface AuthLocals {
  telegramUser: TelegramUser;
}

export function getTelegramUser(res: Response): TelegramUser {
  return (res.locals as AuthLocals).telegramUser;
}

export function getTelegramId(res: Response): string {
  return String(getTelegramUser(res).id);
}

/**
 * Авторизация игровых запросов. Клиент шлёт те же initData, что и при входе:
 *
 *   Authorization: tma <raw initData>
 *
 * Подпись проверяется на каждом запросе — сервер не доверяет клиенту ничего,
 * включая telegramId. В базу здесь не ходим: пользователя достают сами
 * обработчики тем же запросом, которым читают или пишут игровое состояние.
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
  const [scheme, raw] = header.split(' ');

  if (scheme !== 'tma' || !raw) {
    res.status(401).json({ error: 'Ожидался заголовок Authorization: tma <initData>' });
    return;
  }

  try {
    (res.locals as AuthLocals).telegramUser = validateInitData(raw, botToken).user;
    next();
  } catch (error) {
    if (error instanceof InitDataError) {
      res.status(401).json({ error: 'initData не прошли проверку', code: error.code });
      return;
    }
    next(error);
  }
}
