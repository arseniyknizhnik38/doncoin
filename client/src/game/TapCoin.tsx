import { useCallback, useRef, useState } from 'react';
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
  onTap: () => boolean;
}

export function TapCoin({ coinsPerTap, disabled, onTap }: TapCoinProps) {
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  const [pressed, setPressed] = useState(false);
  const nextId = useRef(0);

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
      window.setTimeout(
        () => setFloats((prev) => prev.filter((item) => item.id !== id)),
        800,
      );
    },
    [coinsPerTap, onTap],
  );

  return (
    <button
      type="button"
      onPointerDown={handleTap}
      disabled={disabled}
      aria-label="Тапнуть монету"
      className={`relative touch-manipulation select-none rounded-full transition-transform duration-75 ${
        pressed ? 'scale-95' : 'scale-100'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-don-gold/25 blur-2xl" />

      <span className="relative flex h-56 w-56 items-center justify-center rounded-full border-4 border-don-gold/70 bg-gradient-to-br from-don-gold-soft via-don-gold to-[#8a5f12] shadow-[0_10px_40px_rgba(232,180,72,0.35)] sm:h-64 sm:w-64">
        <span className="flex h-[85%] w-[85%] items-center justify-center rounded-full border-2 border-[#8a5f12]/50 bg-gradient-to-br from-[#f7e2ab] to-[#c9922c]">
          <span className="text-6xl font-black tracking-tight text-[#5a3a08] drop-shadow-sm sm:text-7xl">
            D
          </span>
        </span>
      </span>

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
