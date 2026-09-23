import { BoosterBar } from '../boosters/BoosterBar';
import type { BoostersApi } from '../boosters/useBoosters';
import { CipherCard } from '../cipher/CipherCard';
import type { CipherApi } from '../cipher/useCipher';
import { EnvelopeCard } from '../envelope/EnvelopeCard';
import type { EnvelopeApi } from '../envelope/useEnvelope';
import { FavorsScreen } from '../favors/FavorsScreen';
import type { FavorsApi } from '../favors/useFavors';
import { FeedTicker } from '../feed/FeedList';
import type { FeedApi } from '../feed/useFeed';
import { OmertaCard } from '../omerta/OmertaCard';
import type { OmertaApi } from '../omerta/useOmerta';
import { QuestList } from '../quests/QuestList';
import { RaffleCard } from '../raffle/RaffleCard';
import type { RaffleApi } from '../raffle/useRaffle';
import type { QuestsApi } from '../quests/useQuests';
import type { DailyApi } from '../rewards/useDaily';
import type { OfflineEarnings } from '../rewards/types';
import type { Comeback } from '../telegram/useAuth';
import { ErrorState, SkeletonList } from '../ui/States';
import type { TasksApi } from './useTasks';

interface TasksPanelProps {
  tasks: TasksApi;
  quests: QuestsApi;
  cipher: CipherApi;
  omerta: OmertaApi;
  envelope: EnvelopeApi;
  feed: FeedApi;
  favors: FavorsApi;
  daily: DailyApi;
  boosters: BoostersApi;
  raffle: RaffleApi;
  /** Что накапало, пока игрока не было. */
  offline: OfflineEarnings | null;
  /** Куш за возвращение, если кента подозревали. */
  comeback: Comeback | null;
  onClose: () => void;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

const formatHours = (hours: number) =>
  hours >= 1 ? `${Math.round(hours * 10) / 10} ч` : `${Math.max(1, Math.round(hours * 60))} мин`;

/**
 * Всё, что делается не тапом.
 *
 * Раньше половина этого лежала на главном экране плашками поверх персонажа:
 * бонус дня, задания, бустеры, конверт, слухи. Каждая отнимала высоту у
 * фигуры, ради которой экран и открывают, а вместе они превращали его в
 * список кнопок с человеком где-то внизу. Здесь им и место.
 */
export function TasksPanel({
  tasks,
  quests,
  cipher,
  omerta,
  envelope,
  feed,
  favors,
  daily,
  boosters,
  raffle,
  offline,
  comeback,
  onClose,
}: TasksPanelProps) {
  const status = daily.status;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-don-black/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto px-6 py-8 [&>*]:shrink-0">
        <header className="flex items-center justify-between">
          <h2 className="font-pixel text-2xl leading-relaxed text-don-gold uppercase">
            Задания
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg border border-don-edge px-3 min-h-11 inline-flex items-center justify-center py-1.5 text-sm text-neutral-400"
          >
            Закрыть
          </button>
        </header>

        {/* Сначала то, что уже начислено: человек открыл панель и сразу видит,
            что его ждали. */}
        {comeback && (
          <p className="rounded-lg border border-don-gold/40 bg-don-ink/80 px-4 py-2 text-sm text-don-bone">
            🐟 {comeback.inviter ? `${comeback.inviter} за тебя поручился` : 'Ты вернулся'} ·{' '}
            <span className="font-semibold text-don-gold-soft">
              +{formatCoins(comeback.amount)}
            </span>
          </p>
        )}

        {offline && Number(offline.earned) > 0 && (
          <p className="rounded-lg border border-don-gold/40 bg-don-ink/80 px-4 py-2 text-sm text-don-bone">
            Пока вас не было:{' '}
            <span className="font-semibold text-don-gold-soft">
              +{formatCoins(offline.earned)}
            </span>{' '}
            за {formatHours(offline.hours)}
          </p>
        )}

        {daily.justClaimed ? (
          <p className="rounded-lg border border-don-gold/40 bg-don-ink/80 px-4 py-2.5 text-sm text-don-gold-soft">
            Бонус получен: +{formatCoins(daily.justClaimed)}
          </p>
        ) : (
          status?.available && (
            <button
              type="button"
              disabled={daily.claiming}
              onClick={daily.claim}
              className="w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 min-h-11 inline-flex items-center justify-center py-2.5 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
            >
              {daily.claiming
                ? 'Забираем…'
                : `Забрать бонус дня ${status.nextStreak}${
                    status.milestone ? ' ×3' : ''
                  } · +${formatCoins(status.reward)}`}
            </button>
          )
        )}

        {status && status.daysToMilestone !== null && (
          <p className="text-center text-[11px] tracking-wider text-neutral-400">
            Через {status.daysToMilestone}{' '}
            {status.daysToMilestone === 1 ? 'день' : 'дн.'} — тройной бонус
          </p>
        )}

        {daily.error && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">
            {daily.error}
          </p>
        )}

        <BoosterBar api={boosters} />

        <EnvelopeCard api={envelope} />
        <RaffleCard api={raffle} />
        <FeedTicker api={feed} />
        <OmertaCard api={omerta} />

        {/* Подписки на каналы — сразу под Омертой: это заработок игры, и
            пропускать их из виду нельзя. Пустой блок не показываем. */}
        {favors.data && favors.data.favors.length > 0 && <FavorsScreen api={favors} />}

        <CipherCard api={cipher} />
        <QuestList api={quests} />

        <h3 className="mt-2 text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
          Разовые задания
        </h3>

        {tasks.error && tasks.tasks && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">
            {tasks.error}
          </p>
        )}

        {!tasks.tasks ? (
          tasks.loading ? (
            <SkeletonList rows={4} />
          ) : (
            <ErrorState message={tasks.error ?? 'Не удалось загрузить'} onRetry={tasks.reload} />
          )
        ) : (
          tasks.tasks.map((task) => {
            const percent = Math.round((task.progress / task.target) * 100);

            return (
              <div
                key={task.id}
                className={`rounded-lg border p-4 text-left ${
                  task.claimed
                    ? 'border-neutral-800 bg-don-ink/80 opacity-60'
                    : task.done
                      ? 'border-don-gold/70 bg-don-ink'
                      : 'border-don-edge bg-don-ink/80'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold text-don-bone">{task.title}</h3>
                  <span className="shrink-0 text-xs text-don-gold-soft">
                    +{formatCoins(task.rewardCoins)}
                    {task.rewardRespect > 0 && ` · ★${task.rewardRespect}`}
                  </span>
                </div>

                <p className="mt-1 text-xs text-neutral-400">{task.description}</p>

                {task.target > 1 && !task.claimed && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-don-gold"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] text-neutral-400 tabular-nums">
                      {formatCoins(task.progress)} / {formatCoins(task.target)}
                    </span>
                  </div>
                )}

                {task.claimed ? (
                  <p className="mt-2 text-xs tracking-wider text-neutral-400">Получено</p>
                ) : task.done ? (
                  <button
                    type="button"
                    disabled={tasks.claiming !== null}
                    onClick={() => tasks.claim(task.id)}
                    className="mt-3 min-h-11 w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
                  >
                    {tasks.claiming === task.id ? 'Забираем…' : 'Забрать награду'}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
