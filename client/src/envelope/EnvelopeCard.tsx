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
        className="w-full truncate rounded-lg border border-don-gold/60 bg-don-ink px-3 min-h-11 inline-flex items-center justify-center py-1.5 text-center text-sm font-semibold text-don-gold-soft active:scale-95"
      >
        {api.justOpened.title}: +{formatCoins(api.justOpened.amount)}
      </button>
    );
  }

  // Ранг ещё не дорос. Показываем всё равно: обещание того, что откроется,
  // работает лучше пустого места.
  if (!envelope.unlocked) {
    return (
      <p className="truncate rounded-lg border border-dashed border-don-blood/40 px-3 py-1 text-center text-[11px] tracking-wider text-neutral-400">
        Заносить начнут с ранга «{envelope.unlocksAt}»
      </p>
    );
  }

  if (!envelope.available) {
    return (
      <p className="truncate rounded-lg border border-don-blood/40 bg-don-ink/60 px-3 py-1 text-center text-[11px] tracking-wider text-neutral-400">
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
      className="w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-3 min-h-11 inline-flex items-center justify-center py-2 text-sm font-semibold text-don-gold-soft active:scale-95 disabled:opacity-50"
    >
      {api.opening ? 'Открываем…' : 'Вам занесли конверт'}
    </button>
  );
}
