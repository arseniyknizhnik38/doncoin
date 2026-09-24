import { useEffect, useState } from 'react';
import { useLang, useT } from '../i18n';
import { canShareStory, shareItemStory } from '../telegram/story';
import { PixelIcon } from '../ui/PixelIcon';
import type { RaffleApi, RaffleItem } from './useRaffle';

/**
 * Ярусы редкости.
 *
 * Слова свои, не «common/rare» и не игровые «эпики»: вещи этого мира
 * описываются языком этого мира. Цвета из палитры игры: обычное — кость,
 * дальше теплеет к золоту, единственная вещь — кровь.
 */
const RARITY: Record<RaffleItem['rarity'], { title: string; className: string }> = {
  common: { title: 'Ходовая вещь', className: 'text-don-bone' },
  rare: { title: 'Редкая вещь', className: 'text-don-gold-soft' },
  epic: { title: 'Именная вещь', className: 'text-don-gold' },
  legendary: { title: 'Единственная', className: 'text-don-blood-light' },
};

/** «2 дн 14 ч», «5 ч 12 мин», «до тиража меньше часа». */
function untilDraw(endsAt: string, t: (s: string, v?: Record<string, string | number>) => string): string {
  const left = new Date(endsAt).getTime() - Date.now();

  if (left <= 0) {
    return t('тираж вот-вот');
  }

  const hours = Math.floor(left / 3_600_000);

  if (hours >= 48) {
    return t('{d} дн {h} ч', { d: Math.floor(hours / 24), h: hours % 24 });
  }

  if (hours >= 1) {
    return t('{h} ч {m} мин', { h: hours, m: Math.floor((left % 3_600_000) / 60_000) });
  }

  return t('{m} мин', { m: Math.max(1, Math.floor(left / 60_000)) });
}

/**
 * Розыгрыш генезис-коллекции: вещь, билеты, тираж — и сейф под ними.
 *
 * Карточка живёт в «Заданиях» рядом с источниками билетов: бонус дня и
 * подписки выдают их прямо на этом же экране, и связь «сделал — получил
 * билет» видна без объяснений.
 *
 * Никаких обещаний цены и «иксов» здесь нет и быть не должно: вещь —
 * это редкость и серийный номер, остальное игроки решают сами.
 */
export function RaffleCard({ api }: { api: RaffleApi }) {
  const t = useT();
  const lang = useLang();
  const raffle = api.raffle;

  // Счётчик до тиража оживает раз в минуту: точнее не нужно, тираж
  // проводится рукой владельца, а не по секундомеру.
  const [, setMinute] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setMinute((value) => value + 1), 60_000);

    return () => window.clearInterval(timer);
  }, []);

  if (!raffle || (!raffle.active && raffle.vault.length === 0 && raffle.history.length === 0)) {
    return null;
  }

  const active = raffle.active;
  const rarity = active ? RARITY[active.item.rarity] : null;

  return (
    <section className="rounded-lg border border-don-gold/40 bg-don-ink/80 p-4 text-left">
      <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
        {t('Розыгрыш')}
      </p>

      {active && rarity && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <PixelIcon id={active.item.icon} className="h-12 w-12" />
            <div className="min-w-0">
              <h3 className="font-pixel text-base leading-relaxed text-don-gold uppercase">
                {t(active.item.name)}
              </h3>
              <p className={`text-[11px] tracking-wider uppercase ${rarity.className}`}>
                {t(rarity.title)} · {active.item.minted + 1} {t('из')} {active.item.supply}
              </p>
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            {t(active.item.description)}
          </p>

          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-sm text-don-bone">
              {t('Твоих билетов: {n}', { n: active.myTickets })}
              {active.totalTickets > 0 && (
                <span className="text-neutral-400"> · {t('в тираже {n}', { n: active.totalTickets })}</span>
              )}
            </span>
            <span className="shrink-0 text-xs text-don-gold-soft tabular-nums">
              {untilDraw(active.endsAt, t)}
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            {t('Билет — за бонус дня и за подписку. Кент в деле — сразу три.')}
          </p>
        </>
      )}

      {raffle.history.length > 0 && (
        <div className="mt-3 border-t border-don-edge pt-3">
          <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
            {t('Прошлые тиражи')}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {raffle.history.map((draw) => (
              <li key={draw.id} className="flex items-center gap-3">
                <PixelIcon id={draw.icon} className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm text-don-bone">
                  {t(draw.itemName)}
                </span>
                <span className="min-w-0 shrink-0 text-right text-xs text-neutral-400">
                  <span className="text-don-gold-soft">{draw.winner}</span>
                  {' · '}
                  {t('билетов {n}', { n: draw.totalTickets })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {raffle.vault.length > 0 && (
        <div className="mt-3 border-t border-don-edge pt-3">
          <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
            {t('Твой сейф')}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {raffle.vault.map((owned) => (
              <li key={owned.id} className="flex items-center gap-3">
                <PixelIcon id={owned.icon} className="h-6 w-6" />
                <span className="min-w-0 flex-1 truncate text-sm text-don-bone">{t(owned.name)}</span>
                <span className={`shrink-0 text-xs tabular-nums ${RARITY[owned.rarity].className}`}>
                  № {owned.serial}/{owned.supply}
                </span>
                {canShareStory() && (
                  <button
                    type="button"
                    onClick={() =>
                      shareItemStory(owned.itemId, t(owned.name), owned.serial, owned.supply, lang)
                    }
                    className="min-h-11 shrink-0 rounded-lg border border-don-gold/40 px-2.5 text-[11px] font-semibold text-don-gold active:scale-95"
                  >
                    {t('В сторис')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            {t('Вывод вещи в TON — напиши в {channel}', { channel: '@doncoin_ru' })}
          </p>
        </div>
      )}
    </section>
  );
}
