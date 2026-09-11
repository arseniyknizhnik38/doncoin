import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';

export interface CipherState {
  /** Шифр на сегодня заведён. */
  available: boolean;
  /** Подсказка, где искать код. */
  hint: string | null;
  solved: boolean;
  rewardCoins: string;
}

export interface CipherApi {
  cipher: CipherState | null;
  sending: boolean;
  error: string | null;
  /** Сколько дали за разгадку — показываем один раз, сразу после ввода. */
  justSolved: string | null;
  solve: (code: string) => void;
}

/**
 * Шифр дня. Запрашивается один раз при входе: он меняется в полночь, и
 * опрашивать сервер чаще незачем.
 */
export function useCipher(
  token: string | null,
  onStateChange: (state: GameState) => void,
): CipherApi {
  const [cipher, setCipher] = useState<CipherState | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSolved, setJustSolved] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ cipher: CipherState }>('/api/cipher', token)
      .then((payload) => {
        if (!cancelled) {
          setCipher(payload.cipher);
        }
      })
      .catch(() => {
        // Молча: шифр — дополнение, ошибка ради него портить экран не должна.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const solve = useCallback(
    (code: string) => {
      if (!token || sending || !code.trim()) {
        return;
      }

      setSending(true);
      setError(null);

      apiFetch<{ reward: string; cipher: CipherState; state: GameState }>(
        '/api/cipher/solve',
        token,
        { method: 'POST', body: JSON.stringify({ code }) },
      )
        .then((payload) => {
          setCipher(payload.cipher);
          setJustSolved(payload.reward);
          onStateChange(payload.state);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setSending(false));
    },
    [token, sending, onStateChange],
  );

  return { cipher, sending, error, justSolved, solve };
}
