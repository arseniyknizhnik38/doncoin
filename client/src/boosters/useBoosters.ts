import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';
import type { BoosterView } from './types';

export interface BoostersApi {
  boosters: BoosterView[] | null;
  using: string | null;
  error: string | null;
  use: (id: string) => void;
}

/**
 * Заряды бустеров. Список тянем один раз при входе и обновляем ответом на
 * трату: заряды меняются только от действий самого игрока, опрашивать
 * сервер незачем.
 */
export function useBoosters(
  token: string | null,
  onStateChange: (state: GameState) => void,
): BoostersApi {
  const [boosters, setBoosters] = useState<BoosterView[] | null>(null);
  const [using, setUsing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ boosters: BoosterView[] }>('/api/boosters', token)
      .then((payload) => {
        if (!cancelled) {
          setBoosters(payload.boosters);
        }
      })
      .catch(() => {
        // Молча: бустеры — приятное дополнение, ради них не стоит показывать
        // игроку ошибку поверх основного экрана.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const use = useCallback(
    (id: string) => {
      if (!token || using) {
        return;
      }

      setUsing(id);

      apiFetch<{ boosters: BoosterView[]; state: GameState }>(
        `/api/boosters/${id}/use`,
        token,
        { method: 'POST' },
      )
        .then((payload) => {
          setBoosters(payload.boosters);
          onStateChange(payload.state);
          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setUsing(null));
    },
    [token, using, onStateChange],
  );

  return { boosters, using, error, use };
}
