import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticFeedback } from '@telegram-apps/sdk-react';
import { DEFAULT_LIGHT, ROOM_LIGHT } from './roomLight';

interface FloatingNumber {
  id: number;
  value: number;
  x: number;
  y: number;
}

/** Крошка золота, отлетающая от места тапа. */
interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface TapCoinProps {
  coinsPerTap: number;
  disabled: boolean;
  /** Ранг решает, кого показывать: своего персонажа или монету. */
  rankId: string;
  /** Поправка роста под комнату: её задаёт каталог фонов. */
  scale: number;
  /** Файл фона — по нему фигура получает свет своей комнаты. */
  backdrop: string | null;
  onTap: () => boolean;
}

/**
 * Персонаж вместо монеты — на тех рангах, для которых он нарисован.
 * Ранга нет в списке — показываем монету, поэтому новый спрайт добавляется
 * одной строкой.
 */
export const RANK_SPRITES: Record<string, string> = {
  outsider: '/don-outsider.webp',
  associate: '/don-associate.webp',
  soldier: '/don-soldier.webp',
  capo: '/don-capo.webp',
  consigliere: '/don-consigliere.webp',
  don: '/don-don.webp',
};

/**
 * Кадры покоя — где они есть.
 *
 * Между тапами персонаж замирает на первом кадре ленты, но у дона вся лента —
 * «задумался с кулаком у подбородка»: нейтральной позы в ней нет вовсе.
 * Для таких характеров покой — отдельная картинка из исходника: стоит
 * спокойно, лицо открыто, а на тапах оживает прежняя анимация.
 */
const REST_SPRITES: Record<string, string> = {
  don: '/don-don-rest.webp',
};

/** Сколько персонаж «живёт» после последнего тапа, прежде чем замереть. */
const MOTION_LINGER_MS = 600;

/** Кадров в ленте и как быстро они сменяются. */
const SPRITE_FRAMES = 8;
const FRAME_MS = 90;

export function TapCoin({ coinsPerTap, disabled, rankId, scale, backdrop, onTap }: TapCoinProps) {
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
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

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setFloats((prev) => [...prev, { id, value: coinsPerTap, x, y }]);

      // Три крошки золота в случайные стороны: монеты ощущаются монетами,
      // когда что-то звенит и разлетается, а не только меняется цифра.
      const burst = Array.from({ length: 3 }, (_, i) => ({
        id: id * 8 + i,
        x,
        y,
        dx: Math.round((Math.random() - 0.5) * 88),
        dy: -46 - Math.round(Math.random() * 44),
      }));
      setSparks((prev) => [...prev, ...burst]);
      window.setTimeout(
        () => setSparks((prev) => prev.filter((s) => !burst.some((b) => b.id === s.id))),
        500,
      );

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

  const sprite = RANK_SPRITES[rankId];

  return (
    <button
      type="button"
      onPointerDown={handleTap}
      disabled={disabled}
      aria-label="Тапнуть"
      className={`relative flex h-full max-h-full items-end justify-center touch-manipulation select-none transition-transform duration-75 ${
        sprite ? '' : 'rounded-full'
      } ${pressed ? 'scale-95' : 'scale-100'} ${disabled ? 'opacity-40' : ''}`}
    >
      {sprite ? (
        <>
          {/* Тень в две жёсткие ступени: плотная под обувью и шире — слабая.
              Ступенями, а не размытием — как весь свет в этой сцене. */}
          <span className="pointer-events-none absolute inset-x-[27%] bottom-[2.5%] h-2 rounded-[50%] bg-black/20" />
          <span className="pointer-events-none absolute inset-x-[34%] bottom-[3%] h-1.5 rounded-[50%] bg-black/40" />
          {/* Размер задаёт место, оставшееся от плашек, но не больше своей доли экрана.
              Потолок нужен из-за фонов: мебель на них нарисована под человека
              примерно такого роста, и на длинном телефоне фигура без предела
              становится выше стола, за которым должна сидеть. */}
          <span
            className="don-frame relative block aspect-square h-full"
            style={{ maxHeight: `${46 * scale}vh` }}
          >
            <span
              className="don-strip block"
              style={{
                ...(REST_SPRITES[rankId] && !moving
                  ? {
                      // Покой: одиночный кадр вместо ленты.
                      backgroundImage: `url(${REST_SPRITES[rankId]})`,
                      width: '100%',
                      transform: 'none',
                    }
                  : {
                      backgroundImage: `url(${sprite})`,
                      // Сдвиг в процентах от ширины самой ленты: 1 кадр = 12.5%.
                      transform: `translateX(-${(frame * 100) / SPRITE_FRAMES}%)`,
                    }),
                // Свет своей комнаты: посчитан по картинке фона. Фон без
                // записи в карте получает прежний общий фильтр.
                filter: (backdrop && ROOM_LIGHT[backdrop]) || DEFAULT_LIGHT,
              }}
            />
          </span>
        </>
      ) : (
        <>

          <span className="relative flex h-[min(14rem,32vh)] w-[min(14rem,32vh)] items-center justify-center rounded-full border-4 border-don-gold/70 bg-don-gold sm:h-64 sm:w-64">
            <span className="flex h-[85%] w-[85%] items-center justify-center rounded-full border-2 border-[#8a5f12]/50 bg-don-gold-soft">
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
          className="pointer-events-none absolute z-10 -translate-x-1/2 animate-float-up font-display text-3xl font-bold text-don-gold [text-shadow:1px_1px_0_#16100b,-1px_1px_0_#16100b,1px_-1px_0_#16100b,-1px_-1px_0_#16100b]"
          style={{ left: item.x, top: item.y }}
        >
          +{item.value}
        </span>
      ))}

      {sparks.map((spark) => (
        <span
          key={spark.id}
          aria-hidden
          className="animate-coin-pop pointer-events-none absolute z-10 h-1.5 w-1.5 bg-don-gold"
          style={{
            left: spark.x,
            top: spark.y,
            '--dx': `${spark.dx}px`,
            '--dy': `${spark.dy}px`,
          } as React.CSSProperties}
        />
      ))}
    </button>
  );
}
