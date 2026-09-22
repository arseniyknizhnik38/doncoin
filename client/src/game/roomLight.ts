/**
 * Свет комнаты — на персонажа.
 *
 * Фигура рисовалась отдельно от комнат и выходит из генератора нейтральной,
 * а свет в комнатах разный: винный полумрак, закат, дневной зал. С одним
 * фильтром на всех человек в тёмном ресторане светился, а в светлом зале
 * выглядел закопчённым — и читался наклейкой.
 *
 * Числа не подбирались на глаз — они посчитаны по самим картинкам
 * (scripts-заметка в истории): средний цвет полосы, где стоит фигура, даёт
 * яркость, теплоту и насыщенность фильтра. Новый фон без записи здесь
 * получает прежний общий фильтр — выглядит как раньше, а не сломанно.
 */
export const ROOM_LIGHT: Record<string, string> = {
  '/bg-associate.webp': 'sepia(0.19) saturate(1.1) brightness(0.96)',
  '/bg-capo.webp': 'sepia(0.14) saturate(1.04) brightness(0.88)',
  '/bg-consigliere.webp': 'sepia(0.11) saturate(0.99) brightness(0.88)',
  '/bg-don.webp': 'sepia(0.16) saturate(1.09) brightness(0.93)',
  '/bg-outsider.webp': 'sepia(0.14) saturate(1.05) brightness(0.91)',
  '/bg-pool.webp': 'sepia(0.13) saturate(1.04) brightness(0.93)',
  '/bg-racetrack.webp': 'sepia(0.14) saturate(1.05) brightness(0.88)',
  '/bg-soldier.webp': 'sepia(0.18) saturate(1.1) brightness(0.91)',
  '/bg-villa.webp': 'sepia(0.17) saturate(1.1) brightness(0.95)',
  '/bg-yacht.webp': 'sepia(0.13) saturate(1.02) brightness(0.88)',
};

/** Прежний общий фильтр — для фонов, которых нет в карте. */
export const DEFAULT_LIGHT = 'sepia(0.14) saturate(0.95) brightness(0.94)';
