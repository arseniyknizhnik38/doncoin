import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';

export interface OmertaItem {
  id: string;
  emoji: string;
  title: string;
}

export interface OmertaState {
  items: OmertaItem[];
  length: number;
  solved: boolean;
  /** Приходит только после разгадки. */
  answer: string[] | null;
  attemptsLeft: number;
  lastHits: number | null;
  rewardCoins: string;
  nextInSeconds: number;
}

export interface OmertaApi {
  omerta: OmertaState | null;
  sending: boolean;
  error: string | null;
  justSolved: string | null;
  guess: (ids: string[]) => void;
}

/** Шифр Омерты. Меняется в полночь — запрашиваем один раз при входе. */
export function useOmerta(
  token: string | null,
  onStateChange: (state: GameState) => void,
): OmertaApi {
  const [omerta, setOmerta] = useState<OmertaState | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSolved, setJustSolved] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ omerta: OmertaState }>('/api/omerta', token)
      .then((payload) => {
        if (!cancelled) {
          setOmerta(payload.omerta);
        }
      })
      .catch(() => {
        // Молча: как и шифр дня, это дополнение к экрану, а не его основа.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const guess = useCallback(
    (ids: string[]) => {
      if (!token || sending) {
        return;
      }

      setSending(true);
      setError(null);

      apiFetch<{ hits: number; reward: string; omerta: OmertaState; state: GameState }>(
        '/api/omerta/guess',
        token,
        { method: 'POST', body: JSON.stringify({ guess: ids }) },
      )
        .then((payload) => {
          setOmerta(payload.omerta);
          onStateChange(payload.state);

          if (payload.omerta.solved) {
            setJustSolved(payload.reward);
          }
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setSending(false));
    },
    [token, sending, onStateChange],
  );

  return { omerta, sending, error, justSolved, guess };
}
