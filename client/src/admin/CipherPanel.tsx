import { useState } from 'react';
import type { CiphersApi } from './useCiphers';

/** Как назвать день по смещению: «сегодня», «завтра», «через 3 дня». */
function dayLabel(day: number): string {
  if (day < 0) {
    return 'вчера';
  }

  if (day === 0) {
    return 'сегодня';
  }

  if (day === 1) {
    return 'завтра';
  }

  return `через ${day} дн.`;
}

/**
 * Шифр дня в админке.
 *
 * Без этой панели код можно было задать только запросом к API — то есть
 * ежедневная механика требовала разработчика каждый день.
 */
export function CipherPanel({ api }: { api: CiphersApi }) {
  const [day, setDay] = useState(1);
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');

  const submit = async () => {
    if (await api.save(day, code, hint)) {
      setCode('');
      setHint('');
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
        Шифр дня
      </h3>

      <div className="rounded-lg border border-don-blood/50 bg-don-ink/80 p-3">
        <div className="flex gap-2">
          <select
            value={day}
            onChange={(event) => setDay(Number(event.target.value))}
            aria-label="На какой день"
            className="rounded-lg border border-don-blood/50 bg-black/40 px-2 py-2 text-sm text-neutral-100"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((value) => (
              <option key={value} value={value}>
                {dayLabel(value)}
              </option>
            ))}
          </select>

          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={32}
            placeholder="КОД"
            aria-label="Код шифра"
            className="min-w-0 flex-1 rounded-lg border border-don-blood/50 bg-black/40 px-3 py-2 text-sm tracking-[0.2em] text-neutral-100 uppercase placeholder:tracking-normal placeholder:text-neutral-400"
          />
        </div>

        <input
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          maxLength={120}
          placeholder="Подсказка: где искать"
          aria-label="Подсказка"
          className="mt-2 w-full rounded-lg border border-don-blood/50 bg-black/40 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-400"
        />

        <button
          type="button"
          onClick={submit}
          disabled={api.saving || code.trim().length < 3}
          className="mt-2 w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 min-h-11 inline-flex items-center justify-center py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
        >
          {api.saving ? 'Сохраняем…' : 'Задать шифр'}
        </button>

        <p className="mt-2 text-[11px] text-neutral-400">
          Код должен появиться в канале раньше, чем игроки пойдут его искать,
          поэтому удобнее готовить на завтра.
        </p>

        {api.error && (
          <p className="mt-2 text-xs tracking-wider text-don-blood-light">{api.error}</p>
        )}
      </div>

      {(api.ciphers ?? []).map((cipher) => (
        <div
          key={cipher.dayNumber}
          className="rounded-lg border border-don-blood/40 bg-don-ink/60 px-3 py-2 text-left"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold tracking-[0.2em] text-don-gold-soft">
              {cipher.code}
            </span>
            <span className="text-[11px] tracking-wider text-neutral-500">
              {dayLabel(cipher.day)} · разгадали {cipher.solves}
            </span>
          </div>

          {cipher.hint && (
            <p className="mt-0.5 text-xs text-neutral-500">{cipher.hint}</p>
          )}
        </div>
      ))}

      {api.ciphers?.length === 0 && !api.loading && (
        <p className="text-xs text-neutral-400">
          Шифров нет. Пока их нет, карточка в игре не показывается.
        </p>
      )}
    </section>
  );
}
