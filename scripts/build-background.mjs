/**
 * Готовит фон ранга из картинки любого размера.
 *
 *   node scripts/build-background.mjs ИСХОДНИК.png soldier
 *
 * Кладёт результат в client/public/bg-soldier.webp и печатает вес.
 *
 * Что делает и почему:
 *
 * 1. Обрезает по центру до 9:16. Телефоны бывают от 9:16 до 9:20+, экран
 *    показывает картинку по «обложке» — значит края обрежутся на каком-нибудь
 *    аппарате. Сюжет должен жить в середине.
 * 2. Уменьшает до 720×1280 ближайшим соседом. Сглаживание здесь вредно:
 *    рядом стоит фигура с крупным зерном, и мыльный фон за ней читается как
 *    фотография, приклеенная к пиксель-арту.
 * 3. Кодирует в WebP без потерь — у пиксель-арта на границах иначе
 *    появляется грязь.
 *
 * ffmpeg ставится разово и в зависимости проекта не входит:
 *   npm i -D --no-save ffmpeg-static
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [input, rank] = process.argv.slice(2);

if (!input || !rank) {
  console.error('Использование: node scripts/build-background.mjs ИСХОДНИК.png ИМЯ_РАНГА');
  console.error('Имена рангов: outsider, associate, soldier, capo, consigliere, don');
  process.exit(1);
}

if (!fs.existsSync(input)) {
  console.error(`Нет файла ${input}`);
  process.exit(1);
}

const ffmpeg = path.join('node_modules', 'ffmpeg-static', 'ffmpeg.exe');
const ffmpegUnix = path.join('node_modules', 'ffmpeg-static', 'ffmpeg');
const binary = fs.existsSync(ffmpeg) ? ffmpeg : ffmpegUnix;

if (!fs.existsSync(binary)) {
  console.error('Нет ffmpeg. Поставьте разово: npm i -D --no-save ffmpeg-static');
  process.exit(1);
}

const output = path.join('client', 'public', `bg-${rank}.webp`);

// Обрезаем до 9:16 по меньшей стороне, затем уменьшаем без сглаживания.
const frame = [
  "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'",
  'scale=720:1280:flags=neighbor',
].join(',');

/**
 * Сколько цветов оставляем.
 *
 * Вес фона задаёт палитра, а не разрешение: первый фон вышел на 616 КБ при
 * 720×1280 — вчетверо тяжелее спрайта, и это на каждый заход. После сведения
 * к 48 цветам осталось 211 КБ, причём разницу на экране найти нельзя: у
 * пиксель-арта цветов и так немного, лишние — это шум градиентов, который
 * туда добавил генератор.
 */
const COLORS = 48;

const palette = path.join(path.dirname(output), `.palette-${rank}.png`);

// Палитра считается по уже уменьшенной картинке: цвета, которые появились
// только от сглаживания исходника, в неё попасть не должны.
const pass = spawnSync(
  binary,
  ['-y', '-hide_banner', '-loglevel', 'error', '-i', input,
    '-vf', `${frame},palettegen=max_colors=${COLORS}:stats_mode=single`, palette],
  { stdio: 'inherit' },
);

if (pass.status !== 0) {
  console.error('ffmpeg не смог посчитать палитру');
  process.exit(1);
}

const result = spawnSync(
  binary,
  ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-i', palette,
    '-filter_complex', `[0]${frame}[s];[s][1]paletteuse=dither=none`,
    '-c:v', 'libwebp', '-lossless', '1', output],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error('ffmpeg не справился');
  process.exit(1);
}

fs.rmSync(palette, { force: true });

const kb = Math.round(fs.statSync(output).size / 1024);

console.log(`${output}: ${kb} КБ`);

// Фон грузится каждую сессию, поэтому вес важнее, чем кажется. Для
// сравнения: спрайт персонажа весит около 140 КБ.
if (kb > 400) {
  console.log(
    'Тяжеловато. Уменьшите детализацию исходника — у пиксель-арта вес растёт\n' +
      'от числа цветов и мелкой ряби, а не от размера картинки.',
  );
}

// Какой фон показывать, решает сервер по каталогу server/src/config/backdrops.ts —
// путь там уже записан, дописывать в клиенте ничего не нужно.
console.log('\nГотово: файл подхватится сам, путь записан в каталоге фонов.');
