import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';

export interface EnvelopeState {
  /** Ранг дорос — конверты заносят. */
  unlocked: boolean;
  /** Ранг, с которого начинают заносить. */
  unlocksAt: string;
  available: boolean;
  /** Что было в сегодняшнем, если уже открыли. */
  opened: { tier: string; title: string; amount: string } | null;
  nextInSeconds: number;
}

export interface EnvelopeApi {
  envelope: EnvelopeState | null;
  opening: boolean;
  error: string | null;
  /** Результат только что открытого — показываем крупно один раз. */
  justOpened: { title: string; amount: string } | null;
  open: () => void;
  dismiss: () => void;
}

/**
 * Конверт дня.
 *
 * Запрашивается один раз при входе: он меняется в полночь, а результат
 * открытия приходит ответом на само открытие.
 */
export function useEnvelope(
  token: string | null,
  onStateChange: (state: GameState) => void,
): EnvelopeApi {
  const [envelope, setEnvelope] = useState<EnvelopeState | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justOpened, setJustOpened] = useState<{ title: string; amount: string } | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ envelope: EnvelopeState }>('/api/envelope', token)
      .then((payload) => {
        if (!cancelled) {
          setEnvelope(payload.envelope);
        }
      })
      .catch(() => {
        // Молча: конверт — приятное дополнение, ошибка ради него не должна
        // портить главный экран.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const open = useCallback(() => {
    if (!token || opening) {
      return;
    }

    setOpening(true);

    apiFetch<{
      opened: { tier: string; title: string; amount: string };
      envelope: EnvelopeState;
      state: GameState;
    }>('/api/envelope/open', token, { method: 'POST' })
      .then((payload) => {
        setEnvelope(payload.envelope);
        setJustOpened({ title: payload.opened.title, amount: payload.opened.amount });
        onStateChange(payload.state);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Ошибка сети');
      })
      .finally(() => setOpening(false));
  }, [token, opening, onStateChange]);

  const dismiss = useCallback(() => setJustOpened(null), []);

  return { envelope, opening, error, justOpened, open, dismiss };
}
