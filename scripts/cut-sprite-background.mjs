import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/**
 * Вырезает фон заливкой от краёв кадра.
 *
 * Прошлый подход убирал ВСЕ пиксели, похожие на цвет фона, — вместе с ними
 * исчезли белки глаз и майка. Заливка идёт только по связной области от
 * границы и останавливается на тёмном контуре персонажа, поэтому светлые
 * места внутри фигуры не трогаются.
 */

const dir = process.argv[2];
const outFile = process.argv[3];
const TOLERANCE = 42;

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const frames = files.map((f) => PNG.sync.read(fs.readFileSync(path.join(dir, f))));
const { width, height } = frames[0];

const near = (data, i, r, g, b) =>
  Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b) <= TOLERANCE;

let removedTotal = 0;

for (const frame of frames) {
  const { data } = frame;
  // Цвет фона берём из угла — он же служит образцом для заливки.
  const [br, bg, bb] = [data[0], data[1], data[2]];

  const visited = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    if (!near(data, p * 4, br, bg, bb)) return;
    visited[p] = 1;
    queue.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    data[p * 4 + 3] = 0;
    removedTotal += 1;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

// Склеиваем в горизонтальную ленту.
const strip = new PNG({ width: width * frames.length, height });

for (let index = 0; index < frames.length; index += 1) {
  PNG.bitblt(frames[index], strip, 0, 0, width, height, index * width, 0);
}

fs.writeFileSync(outFile, PNG.sync.write(strip));

const perFrame = Math.round(removedTotal / frames.length);
console.log(`кадров: ${frames.length}, лента ${strip.width}x${strip.height}`);
console.log(`убрано фона: ${perFrame} пикселей на кадр из ${width * height} (${Math.round((perFrame / (width * height)) * 100)}%)`);
