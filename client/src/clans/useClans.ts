import { useCallback, useEffect, useState } from 'react';
import type { GameState } from '../game/types';
import type { ClansData, MyClan } from './types';

export interface ClansApi {
  data: ClansData | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  create: (name: string) => void;
  join: (clanId: string) => void;
  leave: () => void;
  donate: (amount: number) => void;
  reload: () => void;
}

export function useClans(
  token: string | null,
  /** Меняется при открытии вкладки — заставляет перезапросить данные. */
  refreshKey = 0,
  onStateChange: (state: GameState) => void,
): ClansApi {
  const [data, setData] = useState<ClansData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch('/api/clans', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? `Ошибка ${response.status}`);
        }

        setData(payload as ClansData);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, reloadToken, refreshKey]);

  /** Общая обёртка для действий: они все возвращают новое состояние клана. */
  const act = useCallback(
    (path: string, body?: unknown) => {
      if (!token || busy) {
        return;
      }

      setBusy(true);

      fetch(`/api/clans${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(payload?.error ?? `Ошибка ${response.status}`);
          }

          setData((prev) =>
            prev ? { ...prev, myClan: (payload.myClan ?? null) as MyClan | null } : prev,
          );

          if (payload.state) {
            onStateChange(payload.state as GameState);
          }

          setError(null);
          // Список кланов мог измениться (казна, число участников, роспуск).
          setReloadToken((value) => value + 1);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setBusy(false));
    },
    [token, busy, onStateChange],
  );

  return {
    data,
    loading,
    busy,
    error,
    create: useCallback((name: string) => act('', { name }), [act]),
    join: useCallback((clanId: string) => act(`/${clanId}/join`), [act]),
    leave: useCallback(() => act('/leave'), [act]),
    donate: useCallback((amount: number) => act('/donate', { amount }), [act]),
    reload: useCallback(() => setReloadToken((value) => value + 1), []),
  };
}
