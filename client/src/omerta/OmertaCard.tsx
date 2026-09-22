import { useState } from 'react';
import { useT } from '../i18n';
import type { OmertaApi } from './useOmerta';

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * Шифр Омерты: разложить предметы в правильном порядке.
 *
 * Тап по предмету кладёт его в первую свободную ячейку, тап по ячейке —
 * убирает. Перетаскивание в Telegram на телефоне конфликтует с жестом
 * закрытия приложения, поэтому только тапы.
 */
export function OmertaCard({ api }: { api: OmertaApi }) {
  const t = useT();
  const omerta = api.omerta;
  const [slots, setSlots] = useState<(string | null)[]>([]);

  if (!omerta) {
    return null;
  }

  const cells = Array.from({ length: omerta.length }, (_, index) => slots[index] ?? null);
  const byId = new Map(omerta.items.map((item) => [item.id, item]));
  const full = cells.every(Boolean);

  const place = (id: string) => {
    if (cells.includes(id)) {
      setSlots(cells.map((cell) => (cell === id ? null : cell)));
      return;
    }

    const free = cells.indexOf(null);

    if (free !== -1) {
      setSlots(cells.map((cell, index) => (index === free ? id : cell)));
    }
  };

  const header = (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
        🤫 {t('Шифр Омерты')}
      </p>
      {!omerta.solved && (
        <span className="text-xs text-don-gold-soft tabular-nums">
          +{formatCoins(omerta.rewardCoins)}
        </span>
      )}
    </div>
  );

  if (omerta.solved) {
    return (
      <div className="rounded-lg border border-don-gold/50 bg-don-ink/80 px-4 py-3 text-left">
        {header}
        <p className="mt-2 text-center text-3xl tracking-[0.3em]">
          {(omerta.answer ?? []).map((id) => byId.get(id)?.emoji).join('')}
        </p>
        <p className="mt-2 text-sm text-neutral-300">
          {t('Разгадан')}
          {api.justSolved && (
            <span className="text-don-gold-soft"> · +{formatCoins(api.justSolved)}</span>
          )}
          . {t('Новый шифр — завтра.')}
        </p>
      </div>
    );
  }

  if (omerta.attemptsLeft <= 0) {
    return (
      <div className="rounded-lg border border-don-blood/40 bg-don-ink/60 px-4 py-3 text-left">
        {header}
        <p className="mt-1 text-sm text-neutral-400">
          {t('Попытки на сегодня кончились. Новый шифр — завтра.')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-don-blood/50 bg-don-ink/80 px-4 py-3 text-left">
      {header}

      <p className="mt-1 text-xs text-neutral-400">
        {t('Разложи предметы в правильном порядке. Кто знает — тот молчит. Почти.')}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {cells.map((id, index) => (
          <button
            key={index}
            type="button"
            onClick={() => id && place(id)}
            aria-label={id ? byId.get(id)?.title : t('Пустая ячейка')}
            className={`flex aspect-square items-center justify-center rounded-lg border text-3xl ${
              id ? 'border-don-gold/60 bg-black/50' : 'border-dashed border-don-blood/50 bg-black/20'
            }`}
          >
            {id ? byId.get(id)?.emoji : <span className="text-sm text-neutral-400">{index + 1}</span>}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {omerta.items.map((item) => {
          const used = cells.includes(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => place(item.id)}
              title={item.title}
              aria-label={item.title}
              className={`flex aspect-square items-center justify-center rounded-lg border text-2xl transition-opacity ${
                used ? 'border-don-gold/40 opacity-30' : 'border-don-blood/40 bg-black/30'
              }`}
            >
              {item.emoji}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] tracking-wider text-neutral-400">
        <span>{t('Попыток осталось: {n}', { n: omerta.attemptsLeft })}</span>
        {omerta.lastHits !== null && (
          <span className="text-don-gold-soft">
            {t('На своих местах: {hits} из {total}', {
              hits: omerta.lastHits,
              total: omerta.length,
            })}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={!full || api.sending}
        onClick={() => {
          api.guess(cells as string[]);
          setSlots([]);
        }}
        className="mt-3 min-h-11 w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
      >
        {api.sending ? '…' : t('Проверить')}
      </button>

      {api.error && (
        <p className="mt-2 text-xs tracking-wider text-don-blood-light">{api.error}</p>
      )}
    </div>
  );
}
