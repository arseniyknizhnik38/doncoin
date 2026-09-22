import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Самый крупный кегль счёта. Меньше он становится, только если не влезает. */
const BASE = 48;

/** Ниже этого не опускаемся: нечитаемый счёт хуже обрезанного. */
const FLOOR = 14;

/**
 * Счёт во всю доступную ширину.
 *
 * Кегль здесь не выбирается заранее, а вымеряется. Раньше он выбирался по
 * длине записи — лесенкой «до десяти знаков крупно, дальше мельче», — и это
 * промахивалось: длина в знаках не равна ширине на экране. Ширина зависит
 * ещё и от того, какой шрифт успел загрузиться, насколько узок аппарат и
 * какой системный масштаб текста выставлен в телефоне. На каком-нибудь
 * сочетании число вылезало за плашку, и у дона от счёта оставалась середина.
 *
 * Ширина строки растёт вместе с кеглем линейно, поэтому хватает одного
 * замера: меряем при самом крупном и делим на то, что не поместилось.
 */
export function Balance({ value }: { value: string }) {
  const row = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const unit = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(BASE);

  const fit = useCallback(() => {
    const outer = row.current;
    const inner = number.current;
    const label = unit.current;

    if (!outer || !inner || !label) {
      return;
    }

    // Меряем всегда от одного и того же кегля, иначе замер поедет от
    // предыдущего результата.
    inner.style.fontSize = `${BASE}px`;
    const natural = inner.scrollWidth;

    if (!natural) {
      return;
    }

    const gap = Number.parseFloat(getComputedStyle(outer).columnGap) || 0;
    const room = outer.clientWidth - label.offsetWidth - gap;
    const next = Math.max(FLOOR, Math.min(BASE, Math.floor((BASE * room) / natural)));

    // Ставим сразу, а не только через состояние. Когда новый кегль совпал с
    // прежним, React перерисовывать не станет — и на элементе остался бы
    // пробный BASE, которым мы только что мерили. Ровно так счёт и вылезал
    // за плашку после того, как догрузится шрифт.
    inner.style.fontSize = `${next}px`;
    setSize(next);
  }, []);

  // После каждой перерисовки: число меняется на каждом тапе, и подгонка
  // должна успеть до того, как кадр покажут.
  useLayoutEffect(fit);

  useEffect(() => {
    // Поворот аппарата и смена размера окна. Только на наблюдателя за
    // размером полагаться нельзя: он живёт в цикле отрисовки, и в свёрнутом
    // окне его вызовов может не быть вовсе, а событие приходит всегда.
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);

    // Телеграм меняет высоту окна сам — по своей рамке, без события resize.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);

    if (observer && row.current) {
      observer.observe(row.current);
    }

    // Заголовочный шрифт догружается после первой отрисовки, и цифры в нём
    // уже, чем в запасном. Без этого счёт остался бы подогнан под запасной.
    document.fonts?.ready.then(fit).catch(() => {});

    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      observer?.disconnect();
    };
  }, [fit]);

  return (
    <div ref={row} className="flex w-full items-baseline justify-center gap-2">
      <span
        ref={number}
        style={{ fontSize: `${size}px` }}
        className="font-display leading-none font-bold whitespace-nowrap text-don-gold tabular-nums"
      >
        {value}
      </span>
      <span
        ref={unit}
        className="shrink-0 text-xs tracking-[0.2em] text-neutral-400 uppercase"
      >
        DONC
      </span>
    </div>
  );
}
