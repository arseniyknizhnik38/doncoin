import type React from 'react';
import { useState } from 'react';
import { useT } from '../i18n';
import type { Comeback } from '../telegram/useAuth';
import type { DailyApi } from './useDaily';
import type { OfflineEarnings } from './types';

interface RewardsBarProps {
  offline: OfflineEarnings | null;
  /** Куш за то, что вернулся, пока семья подозревала в стукачестве. */
  comeback?: Comeback | null;
  daily: DailyApi;
  /** Сколько наград за задания можно забрать. */
  tasksReady: number;
  /** Карточка конверта дня — стоит рядом с бонусом, это тот же ритуал. */
  envelope?: React.ReactNode;
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
export function RewardsBar({
  offline,
  comeback = null,
  daily,
  tasksReady,
  envelope,
  onOpenTasks,
}: RewardsBarProps) {
  const [offlineHidden, setOfflineHidden] = useState(false);
  const showOffline = offline !== null && Number(offline.earned) > 0 && !offlineHidden;
  const status = daily.status;
  const [comebackHidden, setComebackHidden] = useState(false);
  const t = useT();

  return (
    <div className="flex w-full flex-col gap-2">
      {comeback && !comebackHidden && (
        <button
          type="button"
          onClick={() => setComebackHidden(true)}
          className="w-full rounded-xl border border-don-gold/60 bg-don-ink/90 px-4 py-2.5 text-left"
        >
          <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
            🐟 {t('Не стукач')}
          </p>
          <p className="text-sm text-neutral-200">
            {comeback.inviter
              ? t('Вернулся — {inviter} за тебя поручился. Куш обоим:', {
                  inviter: comeback.inviter,
                })
              : t('Вернулся. Куш:')}{' '}
            <span className="font-semibold text-don-gold-soft">
              +{formatCoins(comeback.amount)}
            </span>
          </p>
        </button>
      )}

      {envelope}

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
              <span className="text-neutral-500"> · копится не больше 8 часов</span>
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
              : `Забрать бонус дня ${status.nextStreak}${
                  status.milestone ? ' ×3' : ''
                } · +${formatCoins(status.reward)}`}
          </button>
        )
      )}

      {/* Обещание следующей крупной награды — то, ради чего серию не бросают. */}
      {status && status.daysToMilestone !== null && (
        <p className="text-center text-[11px] tracking-wider text-neutral-500">
          Через {status.daysToMilestone}{' '}
          {status.daysToMilestone === 1 ? 'день' : 'дн.'} — тройной бонус
        </p>
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
