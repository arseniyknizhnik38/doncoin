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
  onOpenTasks,
}: RewardsBarProps) {
  const [offlineHidden, setOfflineHidden] = useState(false);
  const showOffline = offline !== null && Number(offline.earned) > 0 && !offlineHidden;
  const status = daily.status;
  const [comebackHidden, setComebackHidden] = useState(false);
  const t = useT();

  return (
    <div className="flex w-full flex-col gap-1.5">
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

      {showOffline && (
        <button
          type="button"
          onClick={() => setOfflineHidden(true)}
          className="w-full truncate rounded-xl border border-don-gold/40 bg-don-ink/80 px-3 py-1.5 text-left text-xs text-neutral-300"
        >
          Пока вас не было:{' '}
          <span className="font-semibold text-don-gold-soft">
            +{formatCoins(offline.earned)}
          </span>{' '}
          за {formatHours(offline.hours)}
        </button>
      )}

      {/* Бонус дня и задания — одной строкой. Раньше это были две кнопки во
          всю ширину плюс строка про тройной бонус: три полосы ради двух
          нажатий, и всё это отнимало высоту у персонажа. */}
      <div className="flex w-full gap-2">
        {daily.justClaimed ? (
          <p className="flex-1 truncate rounded-xl border border-don-gold/40 bg-don-ink/80 px-3 py-2 text-center text-xs text-don-gold-soft">
            Бонус: +{formatCoins(daily.justClaimed)}
          </p>
        ) : (
          status?.available && (
            <button
              type="button"
              disabled={daily.claiming}
              onClick={daily.claim}
              className="flex-1 truncate rounded-xl bg-gradient-to-r from-don-blood to-don-blood-deep px-3 py-2 text-xs font-semibold text-don-gold-soft disabled:opacity-50"
            >
              {daily.claiming
                ? 'Забираем…'
                : `Бонус дня${status.milestone ? ' ×3' : ''} · +${formatCoins(status.reward)}`}
            </button>
          )
        )}

        <button
          type="button"
          onClick={onOpenTasks}
          className={`flex-1 truncate rounded-xl border px-3 py-2 text-xs ${
            tasksReady > 0
              ? 'border-don-gold/50 bg-don-ink text-don-gold-soft'
              : 'border-don-blood/40 bg-don-ink/60 text-neutral-400'
          }`}
        >
          Задания{tasksReady > 0 ? ` · ${tasksReady}` : ''}
        </button>
      </div>

      {daily.error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">
          {daily.error}
        </p>
      )}
    </div>
  );
}
