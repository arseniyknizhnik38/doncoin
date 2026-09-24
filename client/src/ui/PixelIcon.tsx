/**
 * Пиксельная иконка предмета — вместо системного эмодзи.
 *
 * Эмодзи на каждом телефоне свои и всегда глянцево-объёмные: рядом с плоской
 * пиксельной графикой они читаются как чужеродный материал. Иконки нарисованы
 * той же палитрой и с тем же тёмным контуром, что персонажи и комнаты.
 *
 * Рисунок есть не для всякого предмета: сервер волен добавить новый раньше,
 * чем появится картинка, — тогда показываем присланный эмодзи, и это выглядит
 * как старое поведение, а не как дыра.
 */

/** Для каких предметов нарисованы картинки (client/public/icons). */
const DRAWN = new Set([
  'cigar', 'steak', 'ring', 'bourbon', 'revolver', 'envelope',
  'duck', 'payphone', 'shades', 'prosciutto', 'dice', 'car_keys',
  'full_energy', 'rush', 'trophy', 'badge', 'cash',
  // Бизнесы.
  'street_food', 'pizzeria', 'car_wash', 'pawnshop', 'restaurant',
  'night_club', 'casino', 'construction', 'union', 'private_club',
  'port', 'offshore',
  // Эмблемы рангов.
  'rank-outsider', 'rank-associate', 'rank-soldier', 'rank-capo',
  'rank-consigliere', 'rank-don',
]);

interface PixelIconProps {
  /** Идентификатор предмета из каталога. */
  id: string;
  /** Запасной эмодзи, если рисунка нет. */
  emoji?: string;
  /** Класс размера. 24 точки держат целое умножение на плотных экранах. */
  className?: string;
}

export function PixelIcon({ id, emoji, className = 'h-6 w-6' }: PixelIconProps) {
  if (!DRAWN.has(id)) {
    return <span aria-hidden>{emoji ?? '·'}</span>;
  }

  return (
    <img
      src={`/icons/${id}.png`}
      alt=""
      aria-hidden
      draggable={false}
      className={`${className} select-none [image-rendering:pixelated]`}
    />
  );
}
