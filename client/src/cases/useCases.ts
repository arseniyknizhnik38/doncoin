import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';

export interface CaseStepView {
  index: number;
  total: number;
  progress: number;
  target: number;
}

export interface CaseView {
  state: 'available' | 'active' | 'ready' | 'cooldown' | 'done_all';
  nextAt: string | null;
  title: string | null;
  /** Реплика Бобби — интро или текст текущего шага. Локализует сервер. */
  text: string | null;
  step: CaseStepView | null;
  reward: { donc: string; tickets: number } | null;
  casesDone: number;
}

export interface CaseClaimResult {
  outro: string;
  reward: string;
  tickets: number;
}

export interface CasesApi {
  data: CaseView | null;
  busy: boolean;
  error: string | null;
  /** Итог только что закрытого дела — для финальной реплики Бобби. */
  claimed: CaseClaimResult | null;
  start: () => void;
  claim: () => void;
  dismissClaimed: () => void;
}

/**
 * Дела семьи. Прогресс двигают тапы и покупки в других местах игры,
 * поэтому дело перечитывается при каждом открытии панели заданий —
 * тем же ключом, что и задания дня.
 */
export function useCases(
  token: string | null,
  refreshKey: number,
  onStateChange: (state: GameState) => void,
): CasesApi {
  const [data, setData] = useState<CaseView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<CaseClaimResult | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ case: CaseView }>('/api/cases', token)
      .then((payload) => {
        if (!cancelled) {
          setData(payload.case);
        }
      })
      .catch(() => {
        // Молча: дело — дополнение к заданиям, а не их основа.
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  const start = useCallback(() => {
    if (!token || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    apiFetch<{ case: CaseView }>('/api/cases/start', token, { method: 'POST' })
      .then((payload) => setData(payload.case))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Ошибка сети'),
      )
      .finally(() => setBusy(false));
  }, [token, busy]);

  const claim = useCallback(() => {
    if (!token || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    apiFetch<CaseClaimResult & { case: CaseView; state: GameState }>(
      '/api/cases/claim',
      token,
      { method: 'POST' },
    )
      .then((payload) => {
        onStateChange(payload.state);
        setData(payload.case);
        setClaimed({ outro: payload.outro, reward: payload.reward, tickets: payload.tickets });
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Ошибка сети'),
      )
      .finally(() => setBusy(false));
  }, [token, busy, onStateChange]);

  const dismissClaimed = useCallback(() => setClaimed(null), []);

  return { data, busy, error, claimed, start, claim, dismissClaimed };
}
