import { useEffect, useState } from 'react';
import { initDataRaw, useSignal } from '@telegram-apps/sdk-react';
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
}

/**
 * Отправляет сырые initData на сервер, который проверяет подпись и
 * находит/создаёт пользователя. Вне Telegram запрос не делается.
 */
export function useAuth(): AuthState {
  // Сигнал, а не useRawInitData(): тот бросает исключение вне Telegram.
  const rawInitData = useSignal(initDataRaw);
  const [state, setState] = useState<AuthState>({
    status: 'idle',
    user: null,
    isNew: false,
    error: null,
  });

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

        setState({
          status: 'authorized',
          user: payload.user as AuthUser,
          isNew: Boolean(payload.isNew),
          error: null,
        });
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
        });
      });

    return () => controller.abort();
  }, [rawInitData]);

  return state;
}
