import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';
import type { PerkView, RespectBalance } from './types';

export interface PerksApi {
  perks: PerkView[] | null;
  respect: RespectBalance | null;
  loading: boolean;
  buying: string | null;
  error: string | null;
  buy: (id: string) => void;
  reload: () => void;
}

interface PerksResponse {
  perks: PerkView[];
  respect: RespectBalance;
  state?: GameState;
}

export function usePerks(
  token: string | null,
  refreshKey = 0,
  onStateChange: (state: GameState) => void = () => {},
): PerksApi {
  const [perks, setPerks] = useState<PerkView[] | null>(null);
  const [respect, setRespect] = useState<RespectBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<PerksResponse>('/api/perks', token)
      .then((payload) => {
        if (!cancelled) {
          setPerks(payload.perks);
          setRespect(payload.respect);
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

  const buy = useCallback(
    (id: string) => {
      if (!token || buying) {
        return;
      }

      setBuying(id);

      apiFetch<PerksResponse>(`/api/perks/${id}/buy`, token, { method: 'POST' })
        .then((payload) => {
          setPerks(payload.perks);
          setRespect(payload.respect);

          if (payload.state) {
            onStateChange(payload.state);
          }

          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setBuying(null));
    },
    [token, buying, onStateChange],
  );

  return { perks, respect, loading, buying, error, buy, reload };
}
