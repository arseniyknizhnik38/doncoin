import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticFeedback } from '@telegram-apps/sdk-react';

interface FloatingNumber {
  id: number;
  value: number;
  x: number;
  y: number;
}

interface TapCoinProps {
  coinsPerTap: number;
  disabled: boolean;
  /** На ранге «Аутсайдер» вместо монеты — персонаж. */
  rankId: string;
  onTap: () => boolean;
}

/** Сколько персонаж «живёт» после последнего тапа, прежде чем замереть. */
const MOTION_LINGER_MS = 600;

/** Кадров в ленте и как быстро они сменяются. */
const SPRITE_FRAMES = 8;
const FRAME_MS = 90;

export function TapCoin({ coinsPerTap, disabled, rankId, onTap }: TapCoinProps) {
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  const [pressed, setPressed] = useState(false);
  const [moving, setMoving] = useState(false);
  const [frame, setFrame] = useState(0);
  const nextId = useRef(0);
  const stopTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(stopTimer.current), []);

  // Пока идут тапы — крутим кадры; остановились — замираем на первом.
  useEffect(() => {
    if (!moving) {
      setFrame(0);
      return;
    }

    const timer = window.setInterval(
      () => setFrame((value) => (value + 1) % SPRITE_FRAMES),
      FRAME_MS,
    );

    return () => window.clearInterval(timer);
  }, [moving]);

  const handleTap = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!onTap()) {
        return;
      }

      hapticFeedback.impactOccurred.ifAvailable('light');

      const rect = event.currentTarget.getBoundingClientRect();
      const id = nextId.current++;

      setFloats((prev) => [
        ...prev,
        {
          id,
          value: coinsPerTap,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
      ]);

      setPressed(true);
      window.setTimeout(() => setPressed(false), 90);

      // Пока тапают — персонаж двигается; через паузу после последнего тапа
      // анимация выключается, и он просто стоит.
      setMoving(true);
      window.clearTimeout(stopTimer.current);
      stopTimer.current = window.setTimeout(() => setMoving(false), MOTION_LINGER_MS);

      window.setTimeout(
        () => setFloats((prev) => prev.filter((item) => item.id !== id)),
        800,
      );
    },
    [coinsPerTap, onTap],
  );

  const isOutsider = rankId === 'outsider';

  return (
    <button
      type="button"
      onPointerDown={handleTap}
      disabled={disabled}
      aria-label="Тапнуть"
      className={`relative touch-manipulation select-none transition-transform duration-75 ${
        isOutsider ? '' : 'rounded-full'
      } ${pressed ? 'scale-95' : 'scale-100'} ${disabled ? 'opacity-40' : ''}`}
    >
      {isOutsider ? (
        <>
          {/* Мягкое свечение под ногами, чтобы фигура не висела в пустоте */}
          <span className="pointer-events-none absolute inset-x-6 bottom-2 h-6 rounded-[50%] bg-don-gold/20 blur-xl" />
          <span className="don-frame relative block h-[min(16rem,36vh)] w-[min(16rem,36vh)]">
            <span
              className="don-strip block"
              style={{
                backgroundImage: 'url(/don-outsider.webp)',
                // Сдвиг в процентах от ширины самой ленты: 1 кадр = 12.5%.
                transform: `translateX(-${(frame * 100) / SPRITE_FRAMES}%)`,
              }}
            />
          </span>
        </>
      ) : (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-full bg-don-gold/25 blur-2xl" />

          <span className="relative flex h-[min(14rem,32vh)] w-[min(14rem,32vh)] items-center justify-center rounded-full border-4 border-don-gold/70 bg-gradient-to-br from-don-gold-soft via-don-gold to-[#8a5f12] shadow-[0_10px_40px_rgba(232,180,72,0.35)] sm:h-64 sm:w-64">
            <span className="flex h-[85%] w-[85%] items-center justify-center rounded-full border-2 border-[#8a5f12]/50 bg-gradient-to-br from-[#f7e2ab] to-[#c9922c]">
              <span className="text-[min(3.75rem,9vh)] leading-none font-black tracking-tight text-[#5a3a08] drop-shadow-sm sm:text-7xl">
                D
              </span>
            </span>
          </span>
        </>
      )}

      {floats.map((item) => (
        <span
          key={item.id}
          className="pointer-events-none absolute z-10 -translate-x-1/2 animate-float-up text-2xl font-bold text-don-gold-soft drop-shadow"
          style={{ left: item.x, top: item.y }}
        >
          +{item.value}
        </span>
      ))}
    </button>
  );
}
