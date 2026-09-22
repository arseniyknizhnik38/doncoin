import type { QuestsApi } from './useQuests';

interface QuestListProps {
  api: QuestsApi;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** Срок до обнуления списка — читается как дедлайн, поэтому не в секундах. */
function formatReset(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

/**
 * Задания дня. Стоят выше одноразовых: те кончаются за вечер, а эти — то,
 * ради чего игру открывают завтра.
 */
export function QuestList({ api }: QuestListProps) {
  const state = api.state;

  if (!state) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
          Задания дня
        </h3>
        <span className="text-[10px] tracking-wider text-neutral-400">
          обновятся через {formatReset(state.resetInSeconds)}
        </span>
      </div>

      {state.quests.map((quest) => {
        const percent = Math.round((quest.progress / quest.target) * 100);

        return (
          <div
            key={quest.id}
            className="rounded-lg border border-don-blood/50 bg-don-ink/80 p-3 text-left"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="truncate text-sm font-semibold text-neutral-100">
                {quest.title}
              </h4>
              <span className="shrink-0 text-xs text-don-gold-soft tabular-nums">
                +{formatCoins(quest.rewardCoins)}
                {quest.rewardRespect > 0 && (
                  <span className="text-neutral-400"> · ★{quest.rewardRespect}</span>
                )}
              </span>
            </div>

            <p className="mt-0.5 text-xs text-neutral-400">{quest.description}</p>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-don-gold transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400 tabular-nums">
                {formatCoins(quest.progress)} / {formatCoins(quest.target)}
              </span>

              {quest.claimed ? (
                <span className="text-[11px] tracking-wider text-neutral-400">Получено</span>
              ) : (
                <button
                  type="button"
                  disabled={!quest.done || api.claiming !== null}
                  onClick={() => api.claim(quest.id)}
                  className={`min-h-11 inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold ${
                    quest.done
                      ? 'bg-don-blood border-b-2 border-b-don-blood-deep text-don-gold-soft active:scale-95'
                      : 'border border-neutral-700 text-neutral-400'
                  }`}
                >
                  {api.claiming === quest.id ? 'Забираем…' : 'Забрать'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Сундук за все три превращает три мелких дела в одну цель на вечер. */}
      <button
        type="button"
        disabled={!state.chest.ready || api.claiming !== null}
        onClick={api.claimChest}
        className={`rounded-lg border px-4 min-h-11 inline-flex items-center justify-center py-2.5 text-sm font-semibold ${
          state.chest.claimed
            ? 'border-neutral-800 text-neutral-400'
            : state.chest.ready
              ? 'border-don-gold bg-don-gold/10 text-don-gold active:scale-95'
              : 'border-don-blood/40 text-neutral-400'
        }`}
      >
        {state.chest.claimed
          ? 'Сундук за день получен'
          : `Сундук за все три · +${formatCoins(state.chest.rewardCoins)} · ★${state.chest.rewardRespect}`}
      </button>
    </div>
  );
}
