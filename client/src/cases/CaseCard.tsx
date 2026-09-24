import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { CasesApi } from './useCases';

/** Кадры Бобби — та же лента, что в обучении. */
const BOBBY_FRAMES = 8;
const BOBBY_FRAME_MS = 125;

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** «через 12 ч», «через 3 ч» — до следующего дела. */
function untilNext(nextAt: string, t: (s: string, v?: Record<string, string | number>) => string): string {
  const left = new Date(nextAt).getTime() - Date.now();
  const hours = Math.max(1, Math.ceil(left / 3_600_000));

  return t('через {n} ч', { n: hours });
}

/**
 * Дело семьи: Бобби с репликой, шаг с прогрессом и награда в конце.
 *
 * Механически шаги — те же счётчики, что двигает вся игра; ценность
 * карточки в том, что у набора действий появляются история и рассказчик.
 * Реплики приходят с сервера уже на языке игрока.
 */
export function CaseCard({ api }: { api: CasesApi }) {
  const t = useT();
  const data = api.data;

  // Бобби говорит, пока карточка на экране и есть что говорить.
  const [tick, setTick] = useState(0);
  const talking = Boolean(
    data && (data.state === 'available' || data.state === 'active' || data.state === 'ready'),
  );

  useEffect(() => {
    if (!talking && !api.claimed) {
      return;
    }

    const timer = window.setInterval(() => setTick((value) => value + 1), BOBBY_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [talking, api.claimed]);

  if (!data) {
    return null;
  }

  // Только что закрытое дело: финальная реплика поверх любого состояния.
  if (api.claimed) {
    return (
      <section className="rounded-lg border border-don-gold/40 bg-don-ink/80 p-4 text-left">
        <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
          {t('Дело закрыто')}
        </p>
        <BobbyLine tick={tick} text={api.claimed.outro} />
        <p className="mt-2 text-sm text-don-gold-soft">
          +{formatCoins(api.claimed.reward)}
          <span className="text-neutral-400">
            {' '}· {t('+{n} билета розыгрыша', { n: api.claimed.tickets })}
          </span>
        </p>
        <button
          type="button"
          onClick={api.dismissClaimed}
          className="mt-3 w-full rounded-lg border border-don-gold/40 px-4 min-h-11 py-2 text-sm font-semibold text-don-gold active:scale-95"
        >
          {t('Понятно')}
        </button>
      </section>
    );
  }

  if (data.state === 'done_all') {
    return null;
  }

  if (data.state === 'cooldown') {
    return (
      <p className="truncate rounded-lg border border-don-edge bg-don-ink/80 px-3 py-1 text-center text-[11px] tracking-wider text-neutral-400">
        {data.nextAt
          ? t('Бобби подберёт новое дело {time}', { time: untilNext(data.nextAt, t) })
          : t('Бобби подберёт новое дело')}
      </p>
    );
  }

  const percent = data.step
    ? Math.round((data.step.progress / data.step.target) * 100)
    : 0;

  return (
    <section className="rounded-lg border border-don-gold/40 bg-don-ink/80 p-4 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
          {t('Дело семьи')}
        </p>
        {data.step && (
          <span className="shrink-0 text-[11px] tracking-wider text-neutral-400">
            {t('шаг {a} из {b}', { a: data.step.index, b: data.step.total })}
          </span>
        )}
      </div>

      {data.title && (
        <h3 className="mt-1 font-pixel text-base leading-relaxed text-don-gold uppercase">
          {data.title}
        </h3>
      )}

      {data.text && <BobbyLine tick={tick} text={data.text} />}

      {data.state === 'active' && data.step && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-don-gold transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-neutral-400 tabular-nums">
            {formatCoins(data.step.progress)} / {formatCoins(data.step.target)}
          </p>
        </div>
      )}

      {data.reward && (
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
          {t('Награда за дело: +{n} и {k} билета розыгрыша', {
            n: formatCoins(data.reward.donc),
            k: data.reward.tickets,
          })}
        </p>
      )}

      {data.state === 'available' && (
        <button
          type="button"
          disabled={api.busy}
          onClick={api.start}
          className="mt-3 w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 min-h-11 py-2.5 text-sm font-semibold text-don-gold-soft active:scale-95 disabled:opacity-50"
        >
          {api.busy ? t('Берём…') : t('Взять дело')}
        </button>
      )}

      {data.state === 'ready' && (
        <button
          type="button"
          disabled={api.busy}
          onClick={api.claim}
          className="mt-3 w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 min-h-11 py-2.5 text-sm font-semibold text-don-gold-soft active:scale-95 disabled:opacity-50"
        >
          {api.busy ? t('Закрываем…') : t('Закрыть дело')}
        </button>
      )}

      {api.error && (
        <p className="mt-2 text-xs tracking-wider text-don-blood-light">{t(api.error)}</p>
      )}
    </section>
  );
}

/** Бобби с репликой: маленькая фигура и плашка текста. */
function BobbyLine({ tick, text }: { tick: number; text: string }) {
  const t = useT();

  return (
    <div className="mt-3 flex items-end gap-3">
      <span
        aria-hidden
        className="don-frame relative block aspect-square h-20 shrink-0 select-none"
      >
        <span
          className="don-strip block"
          style={{
            backgroundImage: 'url(/bobby.webp)',
            transform: `translateX(-${((tick % BOBBY_FRAMES) * 100) / BOBBY_FRAMES}%)`,
          }}
        />
      </span>

      <div className="min-w-0 flex-1 rounded-lg border border-don-edge bg-black/40 p-3">
        <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
          {t('Толстый Бобби')}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-don-bone">{text}</p>
      </div>
    </div>
  );
}
