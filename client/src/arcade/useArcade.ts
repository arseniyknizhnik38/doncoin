import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';

export interface ArcadeStatus {
  available: boolean;
  best: number;
  /** Во сколько монет превращается одно очко. */
  perPoint: number;
  maxScore: number;
}

export interface ArcadeResult {
  reward: string;
  best: number;
  isRecord: boolean;
}

export interface ArcadeApi {
  status: ArcadeStatus | null;
  claiming: boolean;
  error: string | null;
  result: ArcadeResult | null;
  claim: (score: number) => void;
  /** Сбрасывает итог прошлого забега перед новым показом карточки. */
  resetResult: () => void;
}

/** «Сбор выручки»: статус дня и сдача забега. */
export function useArcade(
  token: string | null,
  onStateChange: (state: GameState) => void,
): ArcadeApi {
  const [status, setStatus] = useState<ArcadeStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArcadeResult | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ arcade: ArcadeStatus }>('/api/arcade', token)
      .then((payload) => {
        if (!cancelled) {
          setStatus(payload.arcade);
        }
      })
      .catch(() => {
        // Молча: забег — дополнение к заданиям, а не их основа.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const claim = useCallback(
    (score: number) => {
      if (!token || claiming) {
        return;
      }

      setClaiming(true);
      setError(null);

      apiFetch<ArcadeResult & { state: GameState }>('/api/arcade/claim', token, {
        method: 'POST',
        body: JSON.stringify({ score }),
      })
        .then((payload) => {
          onStateChange(payload.state);
          setResult({ reward: payload.reward, best: payload.best, isRecord: payload.isRecord });
          setStatus((prev) =>
            prev ? { ...prev, available: false, best: payload.best } : prev,
          );
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setClaiming(false));
    },
    [token, claiming, onStateChange],
  );

  const resetResult = useCallback(() => setResult(null), []);

  return { status, claiming, error, result, claim, resetResult };
}
