/**
 * Фон за персонажем — своя обстановка на каждом ранге.
 *
 * Персонажи рангов намеренно разные люди, поэтому «стал богаче» по самой
 * фигуре не прочитывается. Это и берёт на себя фон: подворотня, ресторан,
 * кабинет. Повышение видно до того, как игрок прочитает надпись.
 *
 * Ранга нет в списке — показывается прежнее оформление, и это не выглядит
 * поломкой: просто тёмный экран, как было.
 */
const RANK_BACKDROPS: Record<string, string> = {
  // Заполняется по мере готовности: outsider: '/bg-outsider.webp',
};

interface RankBackdropProps {
  rankId: string;
  /** Вне вкладки «Игра» фон не нужен: там списки, он мешает читать. */
  visible: boolean;
}

export function RankBackdrop({ rankId, visible }: RankBackdropProps) {
  const src = RANK_BACKDROPS[rankId];

  if (!src || !visible) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={src}
        alt=""
        // Пиксель-арт нельзя сглаживать: рядом стоит фигура с крупным
        // зерном, и мыльный фон за ней выглядит как фотография.
        className="h-full w-full object-cover [image-rendering:pixelated]"
        decoding="async"
      />

      {/* Затемнение сверху и снизу. Поверх фона лежат баланс, полоска
          обоймы и вкладки — без этого они читаются через раз, и насколько
          плохо, зависит от того, что нарисовал художник. */}
      <div className="absolute inset-0 bg-gradient-to-b from-don-black/85 via-don-black/35 to-don-black/90" />
    </div>
  );
}
