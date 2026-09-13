import { CipherCard } from '../cipher/CipherCard';
import type { CipherApi } from '../cipher/useCipher';
import { FavorsScreen } from '../favors/FavorsScreen';
import type { FavorsApi } from '../favors/useFavors';
import { OmertaCard } from '../omerta/OmertaCard';
import type { OmertaApi } from '../omerta/useOmerta';
import { QuestList } from '../quests/QuestList';
import type { QuestsApi } from '../quests/useQuests';
import { ErrorState, SkeletonList } from '../ui/States';
import type { TasksApi } from './useTasks';

interface TasksPanelProps {
  tasks: TasksApi;
  quests: QuestsApi;
  cipher: CipherApi;
  omerta: OmertaApi;
  favors: FavorsApi;
  onClose: () => void;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** Панель заданий поверх экрана — чтобы не заводить шестую вкладку. */
export function TasksPanel({ tasks, quests, cipher, omerta, favors, onClose }: TasksPanelProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-don-black/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto px-6 py-8">
        <header className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-[0.2em] text-don-gold uppercase">
            Задания
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg border border-don-blood/50 px-3 py-1.5 text-sm text-neutral-400"
          >
            Закрыть
          </button>
        </header>

        {/* Шифр и задания дня — сверху: одноразовые задания кончаются за
            вечер, а эти две штуки и есть причина открыть игру завтра. */}
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
                className={`rounded-xl border p-4 text-left ${
                  task.claimed
                    ? 'border-neutral-800 bg-don-ink/40 opacity-60'
                    : task.done
                      ? 'border-don-gold/50 bg-don-ink'
                      : 'border-don-blood/40 bg-don-ink/70'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold text-neutral-100">{task.title}</h3>
                  <span className="shrink-0 text-xs text-don-gold-soft">
                    +{formatCoins(task.rewardCoins)}
                    {task.rewardRespect > 0 && ` · ★${task.rewardRespect}`}
                  </span>
                </div>

                <p className="mt-1 text-xs text-neutral-500">{task.description}</p>

                {task.target > 1 && !task.claimed && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-don-blood to-don-gold"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] text-neutral-500 tabular-nums">
                      {formatCoins(task.progress)} / {formatCoins(task.target)}
                    </span>
                  </div>
                )}

                {task.claimed ? (
                  <p className="mt-2 text-xs tracking-wider text-neutral-600">Получено</p>
                ) : task.done ? (
                  <button
                    type="button"
                    disabled={tasks.claiming !== null}
                    onClick={() => tasks.claim(task.id)}
                    className="mt-3 w-full rounded-lg bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
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
