/**
 * Ищет окно из восьми кадров, которое зациклится без рывка, и меряет фигуру.
 *
 * Критерий из scripts/build-sprite.md: годится окно, где разница кадров s и
 * s+8 примерно равна средней разнице соседних кадров внутри окна. Почти
 * нулевой стык обычно значит, что там ничего не происходит — персонаж замрёт.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();

const frames = files.map((file) => {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, file)));
  return { file, png };
});

/** Средняя разница по каналам между двумя кадрами. */
function diff(a, b) {
  let sum = 0;
  const data = a.data;
  const other = b.data;

  for (let i = 0; i < data.length; i += 4) {
    sum += Math.abs(data[i] - other[i])
      + Math.abs(data[i + 1] - other[i + 1])
      + Math.abs(data[i + 2] - other[i + 2]);
  }

  return sum / (data.length / 4) / 3;
}

const neighbour = [];
for (let i = 0; i + 1 < frames.length; i += 1) {
  neighbour.push(diff(frames[i].png, frames[i + 1].png));
}

console.log('Кадров:', frames.length, '| размер:', frames[0].png.width + 'x' + frames[0].png.height);
console.log('\nокно | стык s↔s+8 | средний шаг внутри | отношение');

const windows = [];

for (let s = 0; s + 8 < frames.length; s += 1) {
  const seam = diff(frames[s].png, frames[s + 8].png);
  const steps = neighbour.slice(s, s + 7);
  const avg = steps.reduce((x, y) => x + y, 0) / steps.length;
  const ratio = seam / avg;

  windows.push({ s, seam, avg, ratio });
  console.log(
    `${String(s + 1).padStart(4)} | ${seam.toFixed(3).padStart(10)} | ${avg.toFixed(3).padStart(18)} | ${ratio.toFixed(2).padStart(9)}`,
  );
}

// Идеал — отношение около 1: стык не заметнее обычного шага, но движение есть.
const best = [...windows]
  .filter((w) => w.avg > 0.05)
  .sort((a, b) => Math.abs(a.ratio - 1) - Math.abs(b.ratio - 1))[0];

console.log(`\nЛучшее окно: кадры ${best.s + 1}..${best.s + 8} (отношение ${best.ratio.toFixed(2)})`);

// ——— Габариты фигуры: фон берём из угла.
const png = frames[best.s].png;
const bg = [png.data[0], png.data[1], png.data[2]];
const near = (i) =>
  Math.abs(png.data[i] - bg[0]) + Math.abs(png.data[i + 1] - bg[1]) + Math.abs(png.data[i + 2] - bg[2]) < 40;

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

console.log(`\nЦвет фона: rgb(${bg.join(',')}) = 0x${bg.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`);
console.log(`Фигура: ${maxX - minX + 1}x${maxY - minY + 1}, слева ${minX}, сверху ${minY}, снизу ${png.height - 1 - maxY}`);
