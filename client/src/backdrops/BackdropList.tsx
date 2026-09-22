import type { GameState } from '../game/types';
import { ErrorState, SkeletonList } from '../ui/States';
import type { BackdropsApi } from './useBackdrops';

interface BackdropListProps {
  api: BackdropsApi;
  state: GameState;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * Витрина фонов.
 *
 * Единственная трата в игре, которая не возвращает деньги, — поэтому рядом с
 * ценой честно сказано, что фон достанется бесплатно на своём ранге. Пусть
 * покупает тот, кто не хочет ждать, а не тот, кто не понял.
 */
export function BackdropList({ api, state }: BackdropListProps) {
  if (!api.backdrops) {
    return api.loading ? (
      <SkeletonList rows={3} />
    ) : (
      <ErrorState message={api.error ?? 'Не удалось загрузить'} onRetry={api.reload} />
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-center text-xs tracking-wider text-neutral-400">
        Фон своего ранга достаётся даром. Остальные — за монеты, и монеты
        уходят насовсем.
      </p>

      {api.error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{api.error}</p>
      )}

      {api.backdrops.map((backdrop) => {
        // Считаем от живого баланса: флаг с сервера — снимок на момент загрузки.
        const affordable =
          backdrop.price !== null && Number(state.balance) >= Number(backdrop.price);

        return (
          <div
            key={backdrop.id}
            className={`overflow-hidden rounded-lg border text-left ${
              backdrop.equipped
                ? 'border-don-gold/70 bg-don-ink'
                : 'border-don-edge bg-don-ink/80'
            }`}
          >
            {/* Превью самой картинки: покупать фон вслепую бессмысленно. */}
            <div className="relative h-32 w-full overflow-hidden bg-black/40">
              <img
                src={backdrop.file}
                alt=""
                aria-hidden
                // Кадрируем выше середины: внизу у всех фонов пустой пол, и на
                // узкой полоске превью от комнаты не оставалось ничего.
                className="h-full w-full object-cover object-[50%_35%] [image-rendering:pixelated]"
                decoding="async"
                // Картинки ещё может не быть — тогда остаётся тёмная плашка,
                // и это выглядит спокойнее, чем значок битого файла.
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="truncate text-base font-semibold text-don-bone">
                  {backdrop.title}
                </h3>
                {backdrop.equipped && (
                  <span className="shrink-0 text-[11px] tracking-[0.2em] text-don-gold uppercase">
                    выбран
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-xs text-neutral-400">{backdrop.description}</p>

              {!backdrop.owned && (
                <p className="mt-1 text-[11px] text-neutral-400">
                  {backdrop.freeAt
                    ? `Бесплатно на ранге «${backdrop.freeAt}»`
                    : 'Рангом не даётся — только покупка'}
                </p>
              )}

              {backdrop.equipped ? null : backdrop.owned ? (
                <button
                  type="button"
                  disabled={api.busy !== null}
                  onClick={() => api.equip(backdrop.id)}
                  className="mt-3 min-h-11 w-full rounded-lg border border-don-gold/40 px-4 py-2.5 text-sm font-semibold text-don-gold active:scale-95 disabled:opacity-50"
                >
                  {api.busy === backdrop.id ? 'Ставим…' : 'Поставить'}
                </button>
              ) : backdrop.price === null ? null : (
                <button
                  type="button"
                  disabled={!affordable || api.busy !== null}
                  onClick={() => api.buy(backdrop.id)}
                  className={`mt-3 min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    affordable
                      ? 'bg-don-blood border-b-2 border-b-don-blood-deep text-don-gold-soft active:scale-95'
                      : 'border border-neutral-700 text-neutral-400'
                  }`}
                >
                  {api.busy === backdrop.id
                    ? 'Покупаем…'
                    : `Купить за ${formatCoins(backdrop.price)}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
