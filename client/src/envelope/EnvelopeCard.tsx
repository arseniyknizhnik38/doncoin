import type { EnvelopeApi } from './useEnvelope';

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * Конверт дня.
 *
 * Единственная награда в игре, размер которой заранее неизвестен, — поэтому
 * сумма не показывается до открытия. Написать её заранее значило бы убить
 * всю механику: открывать нечего, если уже знаешь, что внутри.
 */
export function EnvelopeCard({ api }: { api: EnvelopeApi }) {
  const envelope = api.envelope;

  if (!envelope) {
    return null;
  }

  // Только что открыли — показываем результат крупно, пока не закроют.
  if (api.justOpened) {
    return (
      <button
        type="button"
        onClick={api.dismiss}
        className="w-full rounded-xl border border-don-gold/60 bg-don-ink px-4 py-3 text-left active:scale-95"
      >
        <p className="text-[10px] tracking-[0.25em] text-don-gold uppercase">
          {api.justOpened.title}
        </p>
        <p className="mt-1 text-xl font-bold text-don-gold-soft tabular-nums">
          +{formatCoins(api.justOpened.amount)}
        </p>
      </button>
    );
  }

  // Ранг ещё не дорос. Показываем всё равно: обещание того, что откроется,
  // работает лучше пустого места.
  if (!envelope.unlocked) {
    return (
      <p className="rounded-xl border border-dashed border-don-blood/40 px-4 py-2.5 text-center text-[11px] tracking-wider text-neutral-600">
        Заносить начнут с ранга «{envelope.unlocksAt}»
      </p>
    );
  }

  if (!envelope.available) {
    return (
      <p className="rounded-xl border border-don-blood/40 bg-don-ink/60 px-4 py-2.5 text-center text-[11px] tracking-wider text-neutral-500">
        {envelope.opened
          ? `${envelope.opened.title}: +${formatCoins(envelope.opened.amount)}. Следующий завтра`
          : 'Сегодняшний конверт уже у вас'}
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={api.opening}
      onClick={api.open}
      className="w-full rounded-xl bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-2.5 text-sm font-semibold text-don-gold-soft active:scale-95 disabled:opacity-50"
    >
      {api.opening ? 'Открываем…' : 'Вам занесли конверт'}
    </button>
  );
}
