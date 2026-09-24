import { useEffect, useState } from 'react';
import { hapticFeedback } from '@telegram-apps/sdk-react';
import { useT } from '../i18n';
import { PixelIcon } from '../ui/PixelIcon';
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
  const t = useT();
  const envelope = api.envelope;

  // Вскрытие в два такта: конверт трясётся, потом сумма влетает. Написать
  // куш сразу — значит выбросить единственный момент неизвестности в игре.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!api.justOpened) {
      setRevealed(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setRevealed(true);
      hapticFeedback.notificationOccurred.ifAvailable('success');
    }, 700);

    return () => window.clearTimeout(timer);
  }, [api.justOpened]);

  if (!envelope) {
    return null;
  }

  if (api.justOpened && !revealed) {
    return (
      <div className="flex min-h-11 w-full items-center justify-center rounded-lg border border-don-gold/40 bg-don-ink py-1.5">
        <span className="animate-env-shake inline-flex">
          <PixelIcon id="envelope" className="h-6 w-6" />
        </span>
      </div>
    );
  }

  if (api.justOpened) {
    return (
      <button
        type="button"
        onClick={api.dismiss}
        className="animate-pop-in w-full truncate rounded-lg border border-don-gold/40 bg-don-ink px-3 min-h-11 inline-flex items-center justify-center py-1.5 text-center text-sm font-semibold text-don-gold-soft active:scale-95"
      >
        {t(api.justOpened.title)}: +{formatCoins(api.justOpened.amount)}
      </button>
    );
  }

  // Ранг ещё не дорос. Показываем всё равно: обещание того, что откроется,
  // работает лучше пустого места.
  if (!envelope.unlocked) {
    return (
      <p className="truncate rounded-lg border border-don-edge/60 px-3 py-1 text-center text-[11px] tracking-wider text-neutral-400">
        {t('Заносить начнут с ранга «{rank}»', { rank: t(envelope.unlocksAt) })}
      </p>
    );
  }

  if (!envelope.available) {
    return (
      <p className="truncate rounded-lg border border-don-edge bg-don-ink/80 px-3 py-1 text-center text-[11px] tracking-wider text-neutral-400">
        {envelope.opened
          ? `${t(envelope.opened.title)}: +${formatCoins(envelope.opened.amount)}. ${t('Следующий завтра')}`
          : t('Сегодняшний конверт уже у вас')}
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
      {t(api.opening ? 'Открываем…' : 'Вам занесли конверт')}
    </button>
  );
}
