interface RankBackdropProps {
  /** Путь к картинке с сервера: выбранный фон или положенный по рангу. */
  file: string | null;
  /** Вне вкладки «Игра» фон не нужен: там списки, он мешает читать. */
  visible: boolean;
}

/**
 * Обстановка за спиной персонажа.
 *
 * Персонажи рангов — намеренно разные люди, поэтому «стал богаче» по самой
 * фигуре не читается. Это берёт на себя фон: подворотня, ресторан, кабинет.
 * Повышение видно раньше, чем игрок прочитает надпись.
 *
 * Какой именно фон показывать, решает сервер: он знает и ранг, и что игрок
 * купил. Пока картинки нет — остаётся прежнее оформление, и это выглядит
 * как тёмный экран, а не как поломка.
 */
export function RankBackdrop({ file, visible }: RankBackdropProps) {
  if (!file || !visible) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={file}
        alt=""
        // Пиксель-арт нельзя сглаживать: рядом стоит фигура с крупным
        // зерном, и мыльный фон за ней выглядит как фотография.
        className="h-full w-full object-cover [image-rendering:pixelated]"
        decoding="async"
      />

      {/* Затемнение сверху и снизу. Поверх фона лежат баланс, полоска обоймы
          и вкладки — без этого они читаются через раз, и насколько плохо,
          зависит от того, что нарисовал художник. */}
      <div className="absolute inset-0 bg-gradient-to-b from-don-black/85 via-don-black/35 to-don-black/90" />
    </div>
  );
}
