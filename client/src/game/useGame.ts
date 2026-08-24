import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from './types';

/** Как часто накопленные тапы уходят на сервер. */
const FLUSH_INTERVAL_MS = 700;
/** Должно совпадать с MAX_TAPS_PER_REQUEST на сервере. */
const MAX_TAPS_PER_REQUEST = 50;

export interface GameApi {
  state: GameState | null;
  /** Тап засчитывается локально сразу, на сервер уходит пачкой. */
  tap: () => boolean;
  error: string | null;
}

/**
 * Локальное состояние игры с оптимистичными тапами.
 *
 * Клиент рисует результат мгновенно, но истина — за сервером: каждый ответ
 * на /api/game/tap перезаписывает баланс и энергию. Поэтому накрутка на
 * клиенте ничего не даёт, а лаг до базы не портит ощущение от нажатий.
 */
export function useGame(
  initDataRaw: string | undefined,
  initialState: GameState | null,
): GameApi {
  const [state, setState] = useState<GameState | null>(initialState);
  const [error, setError] = useState<string | null>(null);

  const pendingTaps = useRef(0);
  const inFlight = useRef(false);
  const stateRef = useRef<GameState | null>(initialState);

  /**
   * Пишем состояние сразу и в ref, и в React. Ref нужен синхронно: между
   * двумя быстрыми тапами рендер ещё не успевает произойти, и без этого
   * все нажатия подряд считали бы от одного и того же старого состояния.
   */
  const commitState = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    if (initialState && !stateRef.current) {
      commitState(initialState);
    }
  }, [initialState, commitState]);

  // Локальное восстановление энергии — чтобы полоска росла плавно,
  // не дожидаясь ответов сервера.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;

      if (current && current.energy < current.energyMax) {
        commitState({
          ...current,
          energy: Math.min(current.energyMax, current.energy + current.energyPerSecond),
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [commitState]);

  const flush = useCallback(async () => {
    if (inFlight.current || pendingTaps.current === 0 || !initDataRaw) {
      return;
    }

    const taps = Math.min(pendingTaps.current, MAX_TAPS_PER_REQUEST);
    pendingTaps.current -= taps;
    inFlight.current = true;

    try {
      const response = await fetch('/api/game/tap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `tma ${initDataRaw}`,
        },
        body: JSON.stringify({ taps }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? `Ошибка ${response.status}`);
      }

      // Ответ сервера авторитетен: он учитывает и энергию, и награду.
      commitState(payload.state as GameState);
      setError(null);
    } catch (cause) {
      // Тапы, которые не долетели, не возвращаем в очередь: сервер всё равно
      // пересчитает состояние следующим успешным запросом.
      setError(cause instanceof Error ? cause.message : 'Ошибка сети');
    } finally {
      inFlight.current = false;
    }
  }, [initDataRaw, commitState]);

  useEffect(() => {
    const timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      void flush();
    };
  }, [flush]);

  const tap = useCallback((): boolean => {
    const current = stateRef.current;

    if (!current || current.energy < 1) {
      return false;
    }

    pendingTaps.current += 1;
    commitState({
      ...current,
      balance: String(Number(current.balance) + current.coinsPerTap),
      energy: current.energy - 1,
    });

    return true;
  }, [commitState]);

  return { state, tap, error };
}
