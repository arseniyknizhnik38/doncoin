import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';
import type { FavorsData } from './types';

export interface FavorsApi {
  data: FavorsData | null;
  loading: boolean;
  checking: string | null;
  error: string | null;
  /** id поручения, за которое только что дали награду. */
  justRewarded: string | null;
  /** Поручение, по которому проверка не прошла, и что показать игроку. */
  failed: { id: string; message: string } | null;
  check: (id: string) => void;
  reload: () => void;
}

export function useFavors(
  token: string | null,
  refreshKey = 0,
  onStateChange: (state: GameState) => void = () => {},
): FavorsApi {
  const [data, setData] = useState<FavorsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justRewarded, setJustRewarded] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);

  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<FavorsData>('/api/favors', token)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
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
  }, [token, refreshKey, retry]);

  const check = useCallback(
    (id: string) => {
      if (!token || checking) {
        return;
      }

      setChecking(id);
      setFailed(null);

      apiFetch<{ state: GameState }>(`/api/favors/${id}/complete`, token, {
        method: 'POST',
      })
        .then((payload) => {
          onStateChange(payload.state);
          setJustRewarded(id);
          setError(null);
          // Список перезапрашиваем — отметка о выполнении приходит с сервера.
          setRetry((value) => value + 1);
          window.setTimeout(() => setJustRewarded(null), 3000);
        })
        .catch((cause: unknown) => {
          // Показываем прямо на карточке: игроку важно знать, какое поручение
          // не зачлось и что с этим делать.
          setFailed({
            id,
            message: cause instanceof Error ? cause.message : 'Ошибка сети',
          });
        })
        .finally(() => setChecking(null));
    },
    [token, checking, onStateChange],
  );

  return { data, loading, checking, error, justRewarded, failed, check, reload };
}
