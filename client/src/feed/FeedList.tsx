import type { FeedApi } from './useFeed';

/** «5 мин назад», «2 ч назад», «вчера» — точное время здесь не нужно. */
function when(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);

  if (minutes < 1) {
    return 'только что';
  }

  if (minutes < 60) {
    return `${minutes} мин назад`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ч назад`;
  }

  const days = Math.floor(hours / 24);

  return days === 1 ? 'вчера' : `${days} дн. назад`;
}

/**
 * Лента «Что слышно».
 *
 * В основном про семьи — так в этом мире и устроено: на слуху не личные
 * успехи, а кто с кем сошёлся и кто поднялся. Про отдельных игроков сюда
 * попадает только редкое, иначе лента превращается в бегущую строку.
 */
export function FeedList({ api }: { api: FeedApi }) {
  const events = api.events;

  if (!events || events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-don-blood/40 px-4 py-5 text-center text-xs tracking-wider text-neutral-400">
        {api.loading ? 'Слушаем улицу…' : 'Пока тихо. Первая новость — за вами.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
        Что слышно
      </h3>

      {events.map((event) => (
        <div
          key={event.id}
          className={`rounded-lg border px-3 py-2 text-left ${
            event.aboutClan
              ? 'border-don-blood/40 bg-don-ink/70'
              : 'border-don-gold/30 bg-don-ink/50'
          }`}
        >
          <p className="text-xs text-neutral-200">{event.text}</p>
          <p className="mt-0.5 text-[10px] tracking-wider text-neutral-400">
            {when(event.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Последняя новость одной строкой.
 *
 * Стоит на главном экране, потому что новичок в семью ещё не вступил и на
 * вкладку кланов не пойдёт — а пустой мир выглядит мёртвым независимо от
 * того, сколько в нём людей.
 */
export function FeedTicker({ api }: { api: FeedApi }) {
  const latest = api.events?.[0];

  if (!latest) {
    return null;
  }

  return (
    <p className="w-full truncate text-center text-[11px] tracking-wider text-neutral-500">
      {latest.text}
    </p>
  );
}
