import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';

export interface BackdropView {
  id: string;
  title: string;
  description: string;
  file: string;
  owned: boolean;
  /** Открылся рангом, а не покупкой. */
  byRank: boolean;
  /** Цена, null — если уже есть или купить нельзя. */
  price: string | null;
  affordable: boolean;
  equipped: boolean;
  /** Ранг, на котором достанется бесплатно. */
  freeAt: string;
}

export interface BackdropsApi {
  backdrops: BackdropView[] | null;
  loading: boolean;
  busy: string | null;
  error: string | null;
  buy: (id: string) => void;
  equip: (id: string) => void;
  reload: () => void;
}

/**
 * Фоны: что есть, что можно купить, что выбрано.
 *
 * Покупка меняет баланс, поэтому её ответ прокидывается в общее состояние
 * игры — иначе цифра наверху останется старой до следующего запроса.
 */
export function useBackdrops(
  token: string | null,
  refreshKey: number,
  onStateChange: (state: GameState) => void,
): BackdropsApi {
  const [backdrops, setBackdrops] = useState<BackdropView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownKey, setOwnKey] = useState(0);

  const reload = useCallback(() => setOwnKey((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<{ backdrops: BackdropView[] }>('/api/backdrops', token)
      .then((payload) => {
        if (!cancelled) {
          setBackdrops(payload.backdrops);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, ownKey]);

  const send = useCallback(
    (id: string, action: 'buy' | 'equip') => {
      if (!token || busy) {
        return;
      }

      setBusy(id);

      apiFetch<{ backdrops: BackdropView[]; state?: GameState }>(
        `/api/backdrops/${id}/${action}`,
        token,
        { method: 'POST' },
      )
        .then((payload) => {
          setBackdrops(payload.backdrops);

          if (payload.state) {
            onStateChange(payload.state);
          }

          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setBusy(null));
    },
    [token, busy, onStateChange],
  );

  const buy = useCallback((id: string) => send(id, 'buy'), [send]);
  const equip = useCallback((id: string) => send(id, 'equip'), [send]);

  return { backdrops, loading, busy, error, buy, equip, reload };
}
