/**
 * Ищет окно из 8 кадров, которое зациклится без рывка, и меряет фигуру.
 *
 *   node scripts/find-sprite-loop.mjs КАТАЛОГ_С_КАДРАМИ
 *
 * Анимация крутится по кругу, пока игрок тапает, поэтому последний кадр
 * должен переходить в первый незаметно. «Стык» — разница между кадрами s и
 * s+8; «шаг» — средняя разница соседних кадров внутри окна.
 *
 * Годится окно с маленьким стыком, но живым движением. Одного отношения
 * стыка к шагу мало: у «Капо» окно с лучшим отношением (1.69) имело стык
 * 14.1, а соседнее с отношением похуже (1.87) — стык 9.1, то есть прыжок
 * вдвое слабее при том же оживлении. Поэтому выбираем по величине стыка,
 * отбросив окна, где персонаж почти замер.
 *
 * Заодно печатает цвет фона и габариты фигуры — они нужны, чтобы посчитать
 * scale и pad на следующем шаге (см. scripts/build-sprite.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/** Сколько кадров в ленте. */
const WINDOW = 8;

/**
 * Окна, где движение слабее этой доли от типичного, не рассматриваем:
 * маленький стык там означает не плавность, а неподвижность.
 */
const MIN_MOTION_RATIO = 0.5;

const dir = process.argv[2];

if (!dir) {
  console.error('Укажите каталог с кадрами: node scripts/find-sprite-loop.mjs all');
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const frames = files.map((file) => PNG.sync.read(fs.readFileSync(path.join(dir, file))));

if (frames.length <= WINDOW) {
  console.error(`Кадров всего ${frames.length}, а нужно больше ${WINDOW}.`);
  process.exit(1);
}

/** Средняя разница по каналам между двумя кадрами. */
function diff(a, b) {
  let sum = 0;

  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i] - b.data[i])
      + Math.abs(a.data[i + 1] - b.data[i + 1])
      + Math.abs(a.data[i + 2] - b.data[i + 2]);
  }

  return sum / (a.data.length / 4) / 3;
}

const neighbour = [];

for (let i = 0; i + 1 < frames.length; i += 1) {
  neighbour.push(diff(frames[i], frames[i + 1]));
}

console.log(`Кадров: ${frames.length} | размер: ${frames[0].width}x${frames[0].height}`);
console.log('\nокно | стык s↔s+8 | средний шаг внутри | отношение');

const windows = [];

for (let s = 0; s + WINDOW < frames.length; s += 1) {
  const seam = diff(frames[s], frames[s + WINDOW]);
  const steps = neighbour.slice(s, s + WINDOW - 1);
  const motion = steps.reduce((x, y) => x + y, 0) / steps.length;

  windows.push({ s, seam, motion });
  console.log(
    `${String(s + 1).padStart(4)} | ${seam.toFixed(3).padStart(10)} | ${motion.toFixed(3).padStart(18)} | ${(seam / motion).toFixed(2).padStart(9)}`,
  );
}

const motions = windows.map((w) => w.motion).sort((a, b) => a - b);
const typicalMotion = motions[Math.floor(motions.length / 2)];
const lively = windows.filter((w) => w.motion >= typicalMotion * MIN_MOTION_RATIO);
const best = (lively.length > 0 ? lively : windows).sort((a, b) => a.seam - b.seam)[0];

console.log(
  `\nЛучшее окно: кадры ${best.s + 1}..${best.s + WINDOW}` +
    ` (стык ${best.seam.toFixed(2)}, шаг ${best.motion.toFixed(2)}, отношение ${(best.seam / best.motion).toFixed(2)})`,
);

if (best.seam > best.motion * 2) {
  console.log(
    'Стык заметно крупнее шага — в исходнике нет чистой петли. Рывок будет виден,\n' +
      'но выбрано наименьшее из возможного.',
  );
}

// ——— Габариты фигуры: фон берём из угла.
const png = frames[best.s];
const bg = [png.data[0], png.data[1], png.data[2]];
const near = (i) =>
  Math.abs(png.data[i] - bg[0])
    + Math.abs(png.data[i + 1] - bg[1])
    + Math.abs(png.data[i + 2] - bg[2]) < 40;

let minX = png.width;
let maxX = 0;
let minY = png.height;
let maxY = 0;

for (let y = 0; y < png.height; y += 1) {
  for (let x = 0; x < png.width; x += 1) {
    const i = (y * png.width + x) * 4;

    if (!near(i)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const hex = bg.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();

console.log(`\nЦвет фона: rgb(${bg.join(',')}) = 0x${hex}`);
console.log(
  `Фигура: ${maxX - minX + 1}x${maxY - minY + 1},` +
    ` слева ${minX}, сверху ${minY}, снизу ${png.height - 1 - maxY}`,
);

if (png.height - 1 - maxY === 0) {
  console.log('Снизу 0 — тень упирается в край кадра, в высоту фигуры она не входит.');
}
