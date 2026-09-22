import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Самый крупный кегль счёта. Меньше он становится, только если не влезает. */
const BASE = 48;

/** Ниже этого не опускаемся: нечитаемый счёт хуже обрезанного. */
const FLOOR = 14;

/** За сколько счёт докатывается до нового значения. */
const ROLL_MS = 350;

/**
 * Счёт во всю доступную ширину — и он катится, а не прыгает.
 *
 * Кегль не выбирается заранее, а вымеряется: ширина зависит от аппарата,
 * загрузившегося шрифта и системного масштаба текста, и любая заранее
 * выбранная лесенка на каком-нибудь сочетании обрезала число. Ширина строки
 * растёт с кеглем линейно, поэтому хватает одного замера при самом крупном.
 *
 * Качение — та же причина, по которой в автоматах крутятся барабаны: деньги,
 * которые досчитываются на глазах, ощущаются как деньги. Скачок цифр — как
 * опечатка.
 */
export function Balance({ value }: { value: string }) {
  const row = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const unit = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(BASE);

  // ——— Качение к пришедшему значению.
  const target = Number(value);
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    const delta = target - from;

    if (delta === 0) {
      return;
    }

    const started = performance.now();

    const step = (now: number) => {
      const part = Math.min(1, (now - started) / ROLL_MS);
      // Быстрый разгон и мягкий доезд: последние цифры видно глазами.
      const eased = 1 - (1 - part) ** 2;
      const current = Math.round(from + delta * eased);
      shownRef.current = current;
      setShown(current);

      if (part < 1) {
        raf.current = requestAnimationFrame(step);
      }
    };

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);

    // Страховка: в свёрнутом окне кадры анимации не тикают, и без неё счёт
    // застыл бы на старом числе до следующего события. Таймер тикает всегда.
    const snap = window.setTimeout(() => {
      shownRef.current = target;
      setShown(target);
    }, ROLL_MS + 100);

    return () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(snap);
    };
  }, [target]);

  const text = shown.toLocaleString('ru-RU');

  // ——— Подгонка кегля под ширину.
  const fit = () => {
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
    // пробный BASE, которым мы только что мерили.
    inner.style.fontSize = `${next}px`;
    setSize(next);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={row} className="flex w-full items-baseline justify-center gap-2">
      <span
        ref={number}
        style={{ fontSize: `${size}px` }}
        className="font-display leading-none font-bold whitespace-nowrap text-don-gold tabular-nums"
      >
        {text}
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
