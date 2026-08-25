import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';
import type { TaskView } from './types';

export interface TasksApi {
  tasks: TaskView[] | null;
  loading: boolean;
  claiming: string | null;
  error: string | null;
  /** Сколько наград можно забрать прямо сейчас. */
  readyCount: number;
  claim: (id: string) => void;
  reload: () => void;
}

export function useTasks(
  token: string | null,
  onStateChange: (state: GameState) => void,
): TasksApi {
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<{ tasks: TaskView[] }>('/api/tasks', token)
      .then((payload) => {
        if (!cancelled) {
          setTasks(payload.tasks);
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
  }, [token, refreshKey]);

  const claim = useCallback(
    (id: string) => {
      if (!token || claiming) {
        return;
      }

      setClaiming(id);

      apiFetch<{ tasks: TaskView[]; state: GameState }>(`/api/tasks/${id}/claim`, token, {
        method: 'POST',
      })
        .then((payload) => {
          setTasks(payload.tasks);
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

  const readyCount = (tasks ?? []).filter((task) => task.done && !task.claimed).length;

  return { tasks, loading, claiming, error, readyCount, claim, reload };
}
