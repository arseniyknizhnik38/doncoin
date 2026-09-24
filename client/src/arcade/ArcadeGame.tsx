import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticFeedback } from '@telegram-apps/sdk-react';
import { useLang, useT } from '../i18n';
import { canShareStory, shareArcadeStory } from '../telegram/story';
import { PixelIcon } from '../ui/PixelIcon';
import type { ArcadeApi } from './useArcade';

/** Длительность забега. */
const RUN_MS = 30_000;
/** Как часто падает новый предмет. */
const SPAWN_MS = 420;
/** Сколько предмет летит сверху вниз. */
const FALL_MS = 2_600;

/**
 * Что падает. Жетон — единственная «плохая» цель: тапнул — минус очки.
 * Веса подобраны так, чтобы жетоны были частыми ровно настолько, чтобы
 * нельзя было тапать не глядя.
 */
const DROPS = [
  { icon: 'rank-capo', value: 10, weight: 55 },
  { icon: 'casino', value: 25, weight: 20 },
  { icon: 'ring', value: 50, weight: 5 },
  { icon: 'badge', value: -30, weight: 20 },
] as const;

const TOTAL_WEIGHT = DROPS.reduce((sum, drop) => sum + drop.weight, 0);

function rollDrop() {
  let roll = Math.random() * TOTAL_WEIGHT;

  for (const drop of DROPS) {
    roll -= drop.weight;

    if (roll <= 0) {
      return drop;
    }
  }

  return DROPS[0];
}

interface FallingItem {
  id: number;
  icon: string;
  value: number;
  /** Горизонтальная позиция в процентах ширины поля. */
  x: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  text: string;
  bad: boolean;
}

interface ArcadeGameProps {
  api: ArcadeApi;
  onClose: () => void;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * «Сбор выручки» — единственная скилловая минута в игре.
 *
 * Тапай по пачкам, фишкам и перстням, не трогай жетоны. Тридцать секунд,
 * раз в день. Очки превращаются в монеты по цене тапа — награда растёт
 * вместе с прокачкой.
 */
export function ArcadeGame({ api, onClose }: ArcadeGameProps) {
  const t = useT();
  const lang = useLang();

  const [items, setItems] = useState<FallingItem[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(RUN_MS);
  // Забег начинается не сразу: сначала инструктаж. Что тапать, а что
  // нет, игрок должен узнать до первого жетона, а не после.
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [flash, setFlash] = useState(false);

  const nextId = useRef(1);
  const scoreRef = useRef(0);

  // Спавн и часы живут на интервалах: точность в полсекунды здесь не
  // важна, а два таймера читаются проще игрового цикла на rAF.
  useEffect(() => {
    if (phase !== 'run') {
      return;
    }

    const spawner = window.setInterval(() => {
      const drop = rollDrop();

      setItems((prev) => [
        ...prev.slice(-14),
        {
          id: nextId.current++,
          icon: drop.icon,
          value: drop.value,
          x: 8 + Math.random() * 76,
        },
      ]);
    }, SPAWN_MS);

    const clock = window.setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1_000) {
          setPhase('done');
          return 0;
        }

        return prev - 1_000;
      });
    }, 1_000);

    return () => {
      window.clearInterval(spawner);
      window.clearInterval(clock);
    };
  }, [phase]);

  const catchItem = useCallback(
    (item: FallingItem, clientX: number, clientY: number) => {
      setItems((prev) => prev.filter((other) => other.id !== item.id));
      scoreRef.current = Math.max(0, scoreRef.current + item.value);
      setScore(scoreRef.current);

      const bad = item.value < 0;

      if (bad) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 220);
        hapticFeedback.notificationOccurred.ifAvailable('error');
      } else {
        hapticFeedback.impactOccurred.ifAvailable('light');
      }

      const id = nextId.current++;
      setBursts((prev) => [
        ...prev.slice(-6),
        { id, x: clientX, y: clientY, text: bad ? String(item.value) : `+${item.value}`, bad },
      ]);
      window.setTimeout(
        () => setBursts((prev) => prev.filter((burst) => burst.id !== id)),
        700,
      );
    },
    [],
  );

  const perPoint = api.status?.perPoint ?? 1;
  const record = api.status && score > api.status.best;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-don-black">
      {/* Красная вспышка за тап по жетону. */}
      {flash && <div className="pointer-events-none absolute inset-0 z-20 bg-don-blood/30" />}

      <header className="relative z-10 flex items-center justify-between border-b border-don-edge bg-don-black px-4 py-3">
        <p className="font-pixel text-base leading-relaxed text-don-gold uppercase">
          {t('Сбор выручки')}
        </p>
        <div className="flex items-baseline gap-4 tabular-nums">
          <span className="font-display text-2xl font-semibold text-don-gold-soft">{score}</span>
          <span className={`text-sm ${left <= 5_000 ? 'text-don-blood-light' : 'text-neutral-400'}`}>
            0:{String(Math.ceil(left / 1_000)).padStart(2, '0')}
          </span>
        </div>
      </header>

      {phase === 'intro' ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6">
          <p className="text-center text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
            {t('Как это работает')}
          </p>

          <div className="rounded-lg border border-don-edge bg-don-ink/80 p-4">
            <ul className="flex flex-col gap-3">
              {[
                { icon: 'rank-capo', label: t('Пачка наличных'), value: '+10' },
                { icon: 'casino', label: t('Фишка казино'), value: '+25' },
                { icon: 'ring', label: t('Перстень'), value: '+50' },
              ].map((row) => (
                <li key={row.icon} className="flex items-center gap-3">
                  <PixelIcon id={row.icon} className="h-8 w-8 shrink-0" />
                  <span className="min-w-0 flex-1 text-sm text-don-bone">{row.label}</span>
                  <span className="shrink-0 font-display text-lg font-semibold text-don-gold-soft tabular-nums">
                    {row.value}
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-3 border-t border-don-edge pt-3">
                <PixelIcon id="badge" className="h-8 w-8 shrink-0" />
                <span className="min-w-0 flex-1 text-sm text-don-bone">
                  {t('Жетон копа — не тапай')}
                </span>
                <span className="shrink-0 font-display text-lg font-semibold text-don-blood-light tabular-nums">
                  −30
                </span>
              </li>
            </ul>
          </div>

          <p className="text-center text-xs leading-relaxed text-neutral-400">
            {t('30 секунд. Каждое очко — монеты по цене твоего тапа: сейчас +{n} за очко.', {
              n: perPoint,
            })}
          </p>

          <p className="text-center text-xs leading-relaxed text-neutral-400">
            {t('Бобби: «Собирай всё, что плохо лежит. Увидел жетон — руки в карманы».')}
          </p>

          <button
            type="button"
            onClick={() => setPhase('run')}
            className="w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-3.5 text-base font-semibold tracking-wider text-don-gold-soft active:scale-95"
          >
            {t('Начать забег')}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-xs tracking-wider text-neutral-400"
          >
            {t('Не сейчас')}
          </button>
        </div>
      ) : phase === 'run' ? (
        <div className="relative flex-1 select-none touch-none">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.value > 0 ? `+${item.value}` : t('Жетон')}
              onPointerDown={(event) =>
                catchItem(item, event.clientX, event.clientY)
              }
              onAnimationEnd={() =>
                setItems((prev) => prev.filter((other) => other.id !== item.id))
              }
              className="arcade-fall absolute -top-16 flex h-14 w-14 items-center justify-center"
              style={{ left: `${item.x}%`, animationDuration: `${FALL_MS}ms` }}
            >
              <PixelIcon id={item.icon} className="h-11 w-11" />
            </button>
          ))}

          {bursts.map((burst) => (
            <span
              key={burst.id}
              className={`animate-coin-pop pointer-events-none fixed z-30 font-display text-xl font-semibold ${
                burst.bad ? 'text-don-blood-light' : 'text-don-gold'
              }`}
              style={{ left: burst.x - 16, top: burst.y - 40 }}
            >
              {burst.text}
            </span>
          ))}

          <p className="pointer-events-none absolute bottom-6 w-full text-center text-[11px] tracking-wider text-neutral-400">
            {t('Тапай по деньгам. Жетоны не трогай.')}
          </p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
            {t('Забег окончен')}
          </p>
          <p className="font-pixel text-[40px] leading-tight text-don-gold">{score}</p>

          {api.result ? (
            <>
              <p className="text-sm text-don-gold-soft">
                {t('Выручка сдана: +{n}', { n: formatCoins(api.result.reward) })}
              </p>
              {api.result.isRecord && (
                <p className="text-xs tracking-wider text-don-gold">{t('Новый рекорд!')}</p>
              )}
              {api.result.isRecord && canShareStory() && (
                <button
                  type="button"
                  onClick={() => shareArcadeStory(api.result?.best ?? score, lang)}
                  className="w-full rounded-lg border border-don-gold/40 px-4 py-2.5 text-sm font-semibold text-don-gold active:scale-95"
                >
                  {t('В сторис')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-3.5 text-base font-semibold tracking-wider text-don-gold-soft active:scale-95"
              >
                {t('Готово')}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-400">
                {t('К сдаче: +{n}', { n: formatCoins(score * perPoint) })}
                {record && <span className="text-don-gold"> · {t('это рекорд')}</span>}
              </p>
              <button
                type="button"
                disabled={api.claiming}
                onClick={() => api.claim(score)}
                className="w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-3.5 text-base font-semibold tracking-wider text-don-gold-soft active:scale-95 disabled:opacity-50"
              >
                {api.claiming ? t('Сдаём…') : t('Сдать выручку')}
              </button>
              {api.error && (
                <p className="text-xs tracking-wider text-don-blood-light">{t(api.error)}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
