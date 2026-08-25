import { useCallback, useEffect, useState } from 'react';
import { initDataRaw, useSignal } from '@telegram-apps/sdk-react';
import type { GameState } from '../game/types';
import type { DailyStatus, OfflineEarnings } from '../rewards/types';
import { isTelegramEnv } from './init';

export interface AuthUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  referredByCode: string | null;
  createdAt: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authorized' | 'error';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** true — пользователь создан прямо сейчас, при первом открытии. */
  isNew: boolean;
  error: string | null;
  /** Игровое состояние на момент входа. */
  state: GameState | null;
  /** Сырые initData — нужны для повторного входа. */
  initDataRaw: string | undefined;
  /** Сессионный токен для игровых запросов. */
  sessionToken: string | null;
  /** Что накапало, пока игрока не было. */
  offline: OfflineEarnings | null;
  /** Состояние ежедневного бонуса на момент входа. */
  daily: DailyStatus | null;
  /** Войти заново — например, когда сессия истекла. */
  reauth: () => void;
}

/**
 * Отправляет сырые initData на сервер, который проверяет подпись и
 * находит/создаёт пользователя. Вне Telegram запрос не делается.
 */
export function useAuth(): AuthState {
  // Сигнал, а не useRawInitData(): тот бросает исключение вне Telegram.
  const rawInitData = useSignal(initDataRaw);
  const [state, setState] = useState<
    Omit<AuthState, 'initDataRaw' | 'reauth'>
  >({
    status: 'idle',
    user: null,
    isNew: false,
    error: null,
    state: null,
    sessionToken: null,
    offline: null,
    daily: null,
  });
  const [attempt, setAttempt] = useState(0);

  const reauth = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!isTelegramEnv() || !rawInitData) {
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: rawInitData }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? `Ошибка ${response.status}`);
        }

        const offline = (payload.offline ?? null) as OfflineEarnings | null;

        setState((prev) => ({
          status: 'authorized',
          user: payload.user as AuthUser,
          isNew: Boolean(payload.isNew),
          error: null,
          state: (payload.state ?? null) as GameState | null,
          sessionToken: (payload.session?.token ?? null) as string | null,
          // Повторный вход (перевход после 401 или двойной вызов эффекта
          // в StrictMode) возвращает нулевой оффлайн-доход — не затираем им
          // то, что реально начислили в этой сессии.
          offline:
            offline && Number(offline.earned) > 0 ? offline : prev.offline,
          daily: (payload.daily ?? null) as DailyStatus | null,
        }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          status: 'error',
          user: null,
          isNew: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          state: null,
          sessionToken: null,
          offline: null,
          daily: null,
        });
      });

    return () => controller.abort();
  }, [rawInitData, attempt]);

  return { ...state, initDataRaw: rawInitData, reauth };
}
