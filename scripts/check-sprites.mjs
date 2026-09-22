/**
 * Проверка вырезанных персонажей.
 *
 *   node scripts/check-sprites.mjs client/public/don-*.png
 *
 * Принимает PNG (WebP сначала разверните в PNG через ffmpeg).
 *
 * Ищет две беды, которые на глаз замечаешь не сразу:
 *  - дыры внутри фигуры: прозрачные пятна, не связанные с краем кадра, —
 *    это заливка прошла сквозь тёмную одежду;
 *  - мусор вокруг: отдельные кусочки, не связанные с телом, — остатки фона
 *    или тени, которые в игре читаются как грязь.
 */
import { PNG } from 'pngjs';
import fs from 'node:fs';

const FRAME = 192;

function analyse(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const frames = png.width / FRAME;
  const report = { holes: 0, holeArea: 0, islands: 0, islandArea: 0, frames };

  for (let f = 0; f < frames; f += 1) {
    const x0 = f * FRAME;
    const opaque = (x, y) => png.data[(png.width * y + x0 + x) * 4 + 3] > 16;

    // 1. Прозрачное, связанное с краем кадра, — это внешний фон.
    const outside = new Uint8Array(FRAME * FRAME);
    const queue = [];

    for (let x = 0; x < FRAME; x += 1) {
      for (const y of [0, FRAME - 1]) {
        if (!opaque(x, y) && !outside[y * FRAME + x]) {
          outside[y * FRAME + x] = 1;
          queue.push([x, y]);
        }
      }
    }

    for (let y = 0; y < FRAME; y += 1) {
      for (const x of [0, FRAME - 1]) {
        if (!opaque(x, y) && !outside[y * FRAME + x]) {
          outside[y * FRAME + x] = 1;
          queue.push([x, y]);
        }
      }
    }

    while (queue.length) {
      const [x, y] = queue.pop();

      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= FRAME || ny >= FRAME) continue;
        if (outside[ny * FRAME + nx] || opaque(nx, ny)) continue;
        outside[ny * FRAME + nx] = 1;
        queue.push([nx, ny]);
      }
    }

    // Оставшееся прозрачное — дыры внутри фигуры.
    const seenHole = new Uint8Array(FRAME * FRAME);

    for (let y = 0; y < FRAME; y += 1) {
      for (let x = 0; x < FRAME; x += 1) {
        const p = y * FRAME + x;
        if (opaque(x, y) || outside[p] || seenHole[p]) continue;

        let area = 0;
        const q = [[x, y]];
        seenHole[p] = 1;

        while (q.length) {
          const [cx, cy] = q.pop();
          area += 1;

          for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
            if (nx < 0 || ny < 0 || nx >= FRAME || ny >= FRAME) continue;
            const np = ny * FRAME + nx;
            if (seenHole[np] || outside[np] || opaque(nx, ny)) continue;
            seenHole[np] = 1;
            q.push([nx, ny]);
          }
        }

        // Дыры в один-два пикселя бывают и в рисунке (просвет между пальцами).
        // Крупный просвет — это намеренно снятый фон между ногами, а вот
        // мелкие дырки по всей фигуре означают, что заливка съела одежду.
        if (area > 3 && area <= 60) {
          report.holes += 1;
          report.holeArea += area;
        }
      }
    }

    // 2. Куски тела, не связанные с самым крупным, — мусор.
    const seen = new Uint8Array(FRAME * FRAME);
    const parts = [];

    for (let y = 0; y < FRAME; y += 1) {
      for (let x = 0; x < FRAME; x += 1) {
        const p = y * FRAME + x;
        if (!opaque(x, y) || seen[p]) continue;

        let area = 0;
        const q = [[x, y]];
        seen[p] = 1;

        while (q.length) {
          const [cx, cy] = q.pop();
          area += 1;

          for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
            if (nx < 0 || ny < 0 || nx >= FRAME || ny >= FRAME) continue;
            const np = ny * FRAME + nx;
            if (seen[np] || !opaque(nx, ny)) continue;
            seen[np] = 1;
            q.push([nx, ny]);
          }
        }

        parts.push(area);
      }
    }

    parts.sort((a, b) => b - a);

    for (const area of parts.slice(1)) {
      if (area > 2) {
        report.islands += 1;
        report.islandArea += area;
      }
    }
  }

  return report;
}

const files = process.argv.slice(2);

for (const file of files) {
  const r = analyse(file);
  console.log(
    `${file.split(/[\/]/).pop().padEnd(24)} дыр ${String(r.holes).padStart(3)} (${r.holeArea} точек) · ` +
      `мусора ${String(r.islands).padStart(3)} (${r.islandArea} точек)`,
  );
}
