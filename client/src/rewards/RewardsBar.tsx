import { useState } from 'react';
import type { DailyApi } from './useDaily';
import type { OfflineEarnings } from './types';

interface RewardsBarProps {
  offline: OfflineEarnings | null;
  daily: DailyApi;
  /** Сколько наград за задания можно забрать. */
  tasksReady: number;
  onOpenTasks: () => void;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

const formatHours = (hours: number) => {
  if (hours >= 1) {
    const rounded = Math.round(hours * 10) / 10;
    return `${rounded} ч`;
  }

  return `${Math.max(1, Math.round(hours * 60))} мин`;
};

/** Плашка «пока вас не было» и кнопка ежедневного бонуса. */
export function RewardsBar({ offline, daily, tasksReady, onOpenTasks }: RewardsBarProps) {
  const [offlineHidden, setOfflineHidden] = useState(false);
  const showOffline = offline !== null && Number(offline.earned) > 0 && !offlineHidden;
  const status = daily.status;



  return (
    <div className="flex w-full flex-col gap-2">
      {showOffline && (
        <button
          type="button"
          onClick={() => setOfflineHidden(true)}
          className="w-full rounded-xl border border-don-gold/40 bg-don-ink/80 px-4 py-2.5 text-left"
        >
          <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
            Пока вас не было
          </p>
          <p className="text-sm text-neutral-200">
            Семья заработала{' '}
            <span className="font-semibold text-don-gold-soft">
              +{formatCoins(offline.earned)}
            </span>{' '}
            за {formatHours(offline.hours)}
            {offline.capped && (
              <span className="text-neutral-500"> · копится не больше 3 часов</span>
            )}
          </p>
        </button>
      )}

      {daily.justClaimed ? (
        <p className="rounded-xl border border-don-gold/40 bg-don-ink/80 px-4 py-2.5 text-sm text-don-gold-soft">
          Бонус получен: +{formatCoins(daily.justClaimed)}
        </p>
      ) : (
        status?.available && (
          <button
            type="button"
            disabled={daily.claiming}
            onClick={daily.claim}
            className="w-full rounded-xl bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-2.5 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
          >
            {daily.claiming
              ? 'Забираем…'
              : `Забрать бонус дня ${status.nextStreak} · +${formatCoins(status.reward)}`}
          </button>
        )
      )}

      <button
        type="button"
        onClick={onOpenTasks}
        className={`w-full rounded-xl border px-4 py-2 text-sm ${
          tasksReady > 0
            ? 'border-don-gold/50 bg-don-ink text-don-gold-soft'
            : 'border-don-blood/40 bg-don-ink/60 text-neutral-400'
        }`}
      >
        Задания{tasksReady > 0 ? ` · готово ${tasksReady}` : ''}
      </button>

      {daily.error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">
          {daily.error}
        </p>
      )}
    </div>
  );
}
