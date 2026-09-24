import { openTelegramLink } from '@telegram-apps/sdk-react';
import { useT } from '../i18n';
import { ErrorState, SkeletonList } from '../ui/States';
import type { FavorsApi } from './useFavors';

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** Ссылки на каналы открываем внутри Telegram, а не во внешнем браузере. */
const openChannel = (url: string) => {
  const [called] = openTelegramLink.ifAvailable(url);

  if (!called) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export function FavorsScreen({ api }: { api: FavorsApi }) {
  const t = useT();
  const { data, loading, checking, error, failed } = api;

  if (!data) {
    return loading ? (
      <SkeletonList rows={4} />
    ) : (
      <ErrorState message={error ?? 'Не удалось загрузить'} onRetry={api.reload} />
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-center text-lg font-semibold tracking-wider text-don-gold-soft">
        The Family needs a favor
      </p>

      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{t(error)}</p>
      )}

      {data.favors.length === 0 ? (
        <p className="rounded-lg border border-don-edge/60 px-4 py-6 text-center text-xs tracking-wider text-neutral-400">
          {t('На этой неделе поручений нет. Загляните позже.')}
        </p>
      ) : (
        data.favors.map((favor) => (
          <div
            key={favor.id}
            className={`rounded-lg border p-4 text-left ${
              favor.completed
                ? 'border-emerald-500/40 bg-don-ink/80'
                : 'border-don-edge bg-don-ink/80'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-don-bone">
                  {favor.channelName}
                </h3>
                <p className="mt-0.5 text-xs text-neutral-400">{favor.title}</p>
              </div>
              {favor.completed && (
                <span className="shrink-0 text-[11px] tracking-[0.2em] text-emerald-400/80 uppercase">
                  ✓ {t('Сделано')}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-don-gold-soft">
              +{formatCoins(favor.rewardDonc)}
              <span className="text-neutral-400"> DONC</span>
              {favor.familyXpReward > 0 && (
                <span className="text-neutral-400">
                  {' '}
                  · {t('+{n} опыта семье', { n: favor.familyXpReward })}
                </span>
              )}
            </p>

            {/* Остаток наград — честный дефицит: рекламодатель купил
                конкретное число подписок, и когда они кончатся, задание
                пропадёт. Показываем только под конец, иначе «осталось 4980»
                читается как шум. */}
            {!favor.completed && favor.slotsLeft !== null && favor.slotsLeft <= 100 && (
              <p className="mt-1 text-xs tracking-wider text-don-blood-light">
                {t('Осталось наград: {n}', { n: favor.slotsLeft })}
              </p>
            )}

            {!favor.completed && failed?.id === favor.id && (
              <p className="mt-2 text-xs tracking-wider text-don-blood-light">
                {t(failed.message)}
              </p>
            )}

            {!favor.completed && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openChannel(favor.channelUrl)}
                  className="min-h-11 flex-1 rounded-lg border border-don-gold/40 px-4 py-2.5 text-sm text-don-gold active:scale-95"
                >
                  {t('Перейти')}
                </button>
                <button
                  type="button"
                  disabled={checking !== null}
                  onClick={() => api.check(favor.id)}
                  className="min-h-11 flex-1 rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-2.5 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
                >
                  {t(checking === favor.id ? 'Проверяем…' : 'Проверить')}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
