import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';
import type { QuestsState } from './types';

export interface QuestsApi {
  state: QuestsState | null;
  loading: boolean;
  claiming: string | null;
  error: string | null;
  /** Сколько наград (включая сундук) можно забрать прямо сейчас. */
  readyCount: number;
  claim: (id: string) => void;
  claimChest: () => void;
  reload: () => void;
}

/**
 * Задания дня. Прогресс на сервере считается от слепка, снятого при первой
 * за сутки загрузке, поэтому список достаточно перезапрашивать при открытии
 * панели — сам по себе он не «тикает».
 */
export function useQuests(
  token: string | null,
  refreshKey: number,
  onStateChange: (state: GameState) => void,
): QuestsApi {
  const [state, setState] = useState<QuestsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownKey, setOwnKey] = useState(0);

  const reload = useCallback(() => setOwnKey((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<QuestsState>('/api/quests', token)
      .then((payload) => {
        if (!cancelled) {
          setState(payload);
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
    (path: string, key: string) => {
      if (!token || claiming) {
        return;
      }

      setClaiming(key);

      apiFetch<QuestsState & { state: GameState }>(path, token, { method: 'POST' })
        .then((payload) => {
          setState({
            quests: payload.quests,
            chest: payload.chest,
            resetInSeconds: payload.resetInSeconds,
          });
          onStateChange(payload.state);
          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setClaiming(null));
    },
    [token, claiming, onStateChange],
  );

  const claim = useCallback((id: string) => send(`/api/quests/${id}/claim`, id), [send]);

  const claimChest = useCallback(() => send('/api/quests/chest/claim', 'chest'), [send]);

  const readyCount =
    (state?.quests ?? []).filter((quest) => quest.done && !quest.claimed).length +
    (state?.chest.ready ? 1 : 0);

  return { state, loading, claiming, error, readyCount, claim, claimChest, reload };
}
