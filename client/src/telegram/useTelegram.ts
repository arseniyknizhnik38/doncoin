import { initData, useSignal, type User } from '@telegram-apps/sdk-react';
import { isTelegramEnv } from './init';

export interface TelegramState {
  /** Открыто внутри Telegram? */
  isTelegram: boolean;
  /** Данные пользователя из initData (только внутри Telegram). */
  user: User | undefined;
  /** Готовое к показу имя: «Имя Фамилия», иначе @username, иначе null. */
  displayName: string | null;
}

export function useTelegram(): TelegramState {
  const user = useSignal(initData.user);
  const isTelegram = isTelegramEnv();

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    : '';

  const displayName =
    fullName || (user?.username ? `@${user.username}` : null);

  return { isTelegram, user, displayName };
}
