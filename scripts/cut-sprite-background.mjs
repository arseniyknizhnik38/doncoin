import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/**
 * Вырезает фон из кадров спрайта и склеивает их в горизонтальную ленту.
 *
 * Фон убирается заливкой от краёв кадра, а не «всё, что похоже на фон».
 * Первая версия делала именно так — и вместе с фоном исчезли белки глаз и
 * белая майка: они оказались достаточно близки к нему по цвету. Заливка идёт
 * только по связной области от границы и останавливается на тёмном контуре
 * персонажа, поэтому светлые места внутри фигуры не трогаются.
 *
 *   node scripts/cut-sprite-background.mjs frames strip.png [--shadow]
 *
 * --shadow дополнительно снимает серую тень под ногами. Нужен не всегда:
 * у первого персонажа тени в исходнике не было.
 */

const dir = process.argv[2];
const outFile = process.argv[3];
const REMOVE_SHADOW = process.argv.includes('--shadow');

/**
 * Насколько цвет может отличаться от фона, чтобы считаться фоном.
 *
 * Сорок два подходит, пока фон светлее одежды. У «Дона» фон тёмно-синий, а
 * штаны почти чёрные с синевой — заливка прошла сквозь ткань и выела в
 * штанинах дыры. Поэтому значение задаётся флагом: для тёмных исходников
 * его нужно опускать.
 */
const TOLERANCE = Number(flag('--tolerance', 42));

/** Снимать ли фон, запертый внутри фигуры. На тёмной одежде вредит. */
const CLEAR_GAPS = !process.argv.includes('--no-gaps');

/** Снимать ли светлую кайму по контуру. */
const DEFRINGE = !process.argv.includes('--no-defringe');

/**
 * Насколько далеко от фона может быть кайма.
 *
 * Это не тот же допуск, что у заливки: кайма — смесь фона с рисунком, и от
 * чистого фона она отстоит заметно дальше. У «Приближённого» белые крапины
 * по волосам оказались серыми в районе 220 при фоне 250 — втрое дальше
 * обычного допуска.
 */
const HALO = Number(flag('--halo', 0)) || TOLERANCE * 1.8;

/**
 * Яркость, выше которой краевая точка считается каймой, а не рисунком.
 *
 * На белом фоне край фигуры выходит смесью рисунка с фоном: волосы у края
 * светлеют до серого, и в игре по контуру идёт светящийся пунктир, будто
 * фигуру обвели карандашом. По цвету такую точку от рисунка не отличить —
 * отличается она тем, что лежит на самой границе и светлее всего, что рядом.
 *
 * Ноль — правило выключено; для светлых исходников ставится флагом.
 */
const LIGHT_EDGE = Number(flag('--light-edge', 0));

/**
 * Тень — нейтральная по цвету, заметно темнее фона, в самом низу кадра.
 *
 * Отличать её от обуви по близости к фону нельзя: белые кроссовки к белому
 * фону ближе, чем тень, и исчезли бы первыми. Поэтому признак другой —
 * яркость в полосе под фоном и почти нулевая насыщенность.
 *
 * Полоса задана долей от яркости фона, а не абсолютными числами. Сначала
 * числа были абсолютными (175..232) и молча подходили только светлым
 * исходникам. На тёмном фоне — а он бывает разный, это решает художник —
 * тень оказывается яркостью около 55 при фоне 90, в старую полосу не
 * попадает, и под ногами остаётся грязный мазок.
 *
 * Нижняя граница важнее верхней: под неё не должны попасть тёмный контур
 * и чёрная обувь, которые у тёмного персонажа вчетверо темнее тени.
 */
const SHADOW_LIGHT_MIN_RATIO = Number(flag('--shadow-min', 0.55));
const SHADOW_LIGHT_MAX_RATIO = 0.93;
const SHADOW_MAX_SATURATION = Number(flag('--shadow-sat', 34));
const SHADOW_FROM_Y_RATIO = 0.85;

/**
 * Значение флага из командной строки.
 *
 * Границы тени подобраны под обычный случай — нейтрально-серую тень чуть
 * темнее фона. Но художник рисует её как захочет: у «Аутсайдера» она вышла
 * тёмно-бирюзовой, вдвое темнее фона и слишком цветной, и под кроссовками
 * оставалось голубое пятно. Менять пороги для всех ради одного исходника
 * опасно — тёмная обувь у других персонажей попадёт под тот же нож, поэтому
 * они задаются флагом для конкретной сборки.
 */
function flag(name, fallback) {
  const index = process.argv.indexOf(name);

  return index === -1 ? fallback : process.argv[index + 1];
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const frames = files.map((f) => PNG.sync.read(fs.readFileSync(path.join(dir, f))));
const { width, height } = frames[0];

/** Общая обёртка обхода в ширину по маске проходимости. */
function flood(seeds, passable, visit) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p] || !passable(x, y)) return;
    visited[p] = 1;
    queue.push(p);
  };

  seeds(push);

  while (queue.length > 0) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    visit(x, y, p);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

let backgroundRemoved = 0;
let shadowRemoved = 0;

for (const frame of frames) {
  const { data } = frame;
  // Цвет фона берём из угла — он же служит образцом для заливки.
  const [br, bg, bb] = [data[0], data[1], data[2]];

  const nearBackground = (x, y) => {
    const i = (y * width + x) * 4;
    return (
      Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) <=
      TOLERANCE
    );
  };

  const fromEdges = (push) => {
    for (let x = 0; x < width; x += 1) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      push(0, y);
      push(width - 1, y);
    }
  };

  const clear = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] !== 0) {
      data[i + 3] = 0;
      backgroundRemoved += 1;
    }
  };

  flood(fromEdges, nearBackground, clear);

  if (!REMOVE_SHADOW) {
    continue;
  }

  const fromY = Math.round(height * SHADOW_FROM_Y_RATIO);
  const backgroundLight = (br + bg + bb) / 3;
  const shadowMinLight = backgroundLight * SHADOW_LIGHT_MIN_RATIO;
  const shadowMaxLight = backgroundLight * SHADOW_LIGHT_MAX_RATIO;

  const isShadow = (x, y) => {
    if (y < fromY) return false;
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128) return false;
    const light = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const saturation =
      Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    return (
      light >= shadowMinLight &&
      light <= shadowMaxLight &&
      saturation <= SHADOW_MAX_SATURATION
    );
  };

  // Затравка — уже вырезанные пиксели: тень к ним примыкает снаружи.
  const fromCleared = (push) => {
    for (let y = fromY; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] < 128) {
          push(x + 1, y);
          push(x - 1, y);
          push(x, y + 1);
          push(x, y - 1);
        }
      }
    }
  };

  flood(fromCleared, isShadow, (x, y) => {
    data[(y * width + x) * 4 + 3] = 0;
    shadowRemoved += 1;
  });

  // Тень запирала фон между ногами, и до него заливка от краёв не доставала.
  // Теперь путь открыт — проходим ещё раз, пропуская уже вырезанные пиксели.
  const nearBackgroundOrCleared = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i + 3] < 128 || nearBackground(x, y);
  };

  flood(fromEdges, nearBackgroundOrCleared, clear);
  if (CLEAR_GAPS) {
    clearTrappedGaps(data, nearBackground, clear);
  }

  if (DEFRINGE) {
    clearHalo(data, br, bg, bb, clear);
    clearSpecks(data, br, bg, bb, clear);
    despill(data, br, bg, bb);
  }

}


/**
 * Гасит зелёный отлив.
 *
 * Снять зелёную кайму по контуру мало: свет от экрана ложится на саму
 * фигуру, и в волосах остаются точки вроде (81, 101, 46) — тёмные, внутри
 * рисунка, заливкой не достать. Глаз ловит их сразу: причёска отдаёт
 * болотным.
 *
 * Лечится не удалением, а возвратом канала на место: зелёного в точке не
 * должно быть больше, чем красного или синего. Всё, что сверх этого, —
 * отсвет экрана, а не рисунок. Оттенок при этом сохраняется: тёмное
 * остаётся тёмным, светлое светлым.
 */
function despill(data, br, bg, bb) {
  if (bg - Math.max(br, bb) <= 40) {
    return;
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) {
      continue;
    }

    const ceiling = Math.max(data[i], data[i + 2]);

    if (data[i + 1] > ceiling) {
      data[i + 1] = ceiling;
    }

    // После гашения канала отсвет оставляет болотный оттенок: красного и
    // зелёного поровну, синего меньше. Внутри фигуры такие точки не
    // вырежешь — будут дыры, — поэтому просто возвращаем им нейтральный тон.
    if (
      Math.abs(data[i] - data[i + 1]) < 15 &&
      data[i + 1] - data[i + 2] > 12
    ) {
      data[i + 1] = Math.round((data[i] + data[i + 2]) / 2);
    }
  }
}

/**
 * Снимает кайму от сглаживания.
 *
 * Генератор рисует фигуру со сглаженными краями: между волосами и фоном
 * лежит полоска промежуточного цвета. Заливка её не берёт — до фона ей
 * далеко, — и на тёмной сцене она светится белыми крапинами по контуру,
 * будто персонажа вырезали ножницами по бумаге.
 *
 * Убираем только те пиксели, которые уже касаются пустоты и ближе к фону,
 * чем к фигуре: внутренние светлые места — зубы, майка, блик на цепи —
 * границы не касаются и остаются целыми.
 */
function clearHalo(data, br, bg, bb, clear) {
  const limit = HALO;

  /*
   * Хромакей отличается от обычного фона.
   *
   * Зелёный экран смешивается с рисунком по краям, и получаются точки вроде
   * (120, 200, 60): до чистого зелёного им далеко — обычная проверка на
   * близость к фону их не берёт, — но зелёного в них всё равно больше, чем
   * любого другого канала, и на тёмной сцене они светятся ядовитым контуром.
   *
   * Поэтому на зелёном фоне краевую точку судим не по расстоянию, а по
   * перекосу каналов. К рисунку это не относится: в игре нет ничего, где
   * зелёного было бы столько же.
   */
  const backgroundIsGreen = bg - Math.max(br, bb) > 40;
  const greenish = (r, g, b) => {
    if (!backgroundIsGreen) {
      return false;
    }

    // Чистый отсвет экрана: зелёного больше всех.
    if (g - Math.max(r, b) > 20) {
      return true;
    }

    // Он же после гашения канала — болотный: красного и зелёного поровну,
    // синего заметно меньше. В рисунке такого нет: кожа краснее зелёного на
    // полсотни, волосы уходят в синеву, золото — в жёлтый с большим отрывом.
    return Math.abs(r - g) < 15 && g - b > 20;
  };

  // Слоёв каймы бывает несколько: под снятым краем открывается следующий,
  // чуть менее зелёный. Проходов больше одного, и цикл сам останавливается,
  // когда снимать нечего.
  for (let pass = 0; pass < 4; pass += 1) {
    const doomed = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;

        if (data[i + 3] < 128) {
          continue;
        }

        const touchesVoid = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(
          ([nx, ny]) =>
            nx < 0 ||
            ny < 0 ||
            nx >= width ||
            ny >= height ||
            data[(ny * width + nx) * 4 + 3] < 128,
        );

        if (!touchesVoid) {
          continue;
        }

        const distance =
          Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb);
        const light = (data[i] + data[i + 1] + data[i + 2]) / 3;

        if (
          distance <= limit ||
          (LIGHT_EDGE > 0 && light >= LIGHT_EDGE) ||
          greenish(data[i], data[i + 1], data[i + 2])
        ) {
          doomed.push([x, y]);
        }
      }
    }

    if (doomed.length === 0) {
      break;
    }

    for (const [x, y] of doomed) {
      clear(x, y);
    }
  }
}

/**
 * Снимает крапины фона, застрявшие внутри фигуры.
 *
 * Уменьшение идёт «ближайшим соседом» — сглаживать пиксель-арт нельзя, — и
 * там, где сквозь волосы просвечивал белый фон, отдельные точки этого фона
 * попадают в кадр и остаются внутри причёски. Заливка до них не достаёт:
 * они со всех сторон окружены рисунком.
 *
 * Берём только крошечные пятна цвета фона — три точки и меньше. Зубы, майка
 * и блик на цепи крупнее, и ни одно из них не совпадает с фоном настолько
 * точно.
 */
function clearSpecks(data, br, bg, bb, clear) {
  const seen = new Uint8Array(width * height);
  const nearHalo = (x, y) => {
    const i = (y * width + x) * 4;

    return (
      Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) <= HALO
    );
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;

      if (seen[start] || data[start * 4 + 3] < 128 || !nearHalo(x, y)) {
        continue;
      }

      const area = [];
      const queue = [start];
      seen[start] = 1;

      while (queue.length > 0 && area.length <= 4) {
        const p = queue.pop();
        const px = p % width;
        const py = (p - px) / width;
        area.push([px, py]);

        for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (seen[q] || data[q * 4 + 3] < 128 || !nearHalo(nx, ny)) continue;
          seen[q] = 1;
          queue.push(q);
        }
      }

      if (area.length <= 3) {
        for (const [ax, ay] of area) {
          clear(ax, ay);
        }
      }
    }
  }
}

/**
 * Снимает фон, запертый внутри фигуры.
 *
 * Тень под ногами распознаётся не всегда: у «Аутсайдера» она оказалась
 * тёмно-бирюзовой — вдвое темнее фона и слишком цветной, чтобы пройти
 * проверку. Тень осталась, а вместе с ней остался и серый лоскут между ног:
 * заливка от краёв к нему не пробилась.
 *
 * Снимать всё, похожее на фон, по одному лишь цвету нельзя — на этом уже
 * обожглись: вместе с фоном исчезли белки глаз и белая майка. Поэтому
 * условий три, и каждое отсекает свой случай:
 *
 *  - ниже середины кадра — глаза и рубашка остаются выше;
 *  - уже пятой части кадра — просвет между ног узкий, а крупный кусок
 *    такого цвета означал бы, что мы ошиблись с фоном;
 *  - цвет совпадает с фоном по тому же правилу, что и заливка с краёв.
 */
function clearTrappedGaps(data, nearBackground, clear) {
  const seen = new Uint8Array(width * height);

  for (let y = Math.round(height / 2); y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;

      if (seen[start] || data[start * 4 + 3] < 128 || !nearBackground(x, y)) {
        continue;
      }

      // Собираем связную область целиком, чтобы узнать её ширину.
      const area = [];
      let left = x;
      let right = x;
      const queue = [start];
      seen[start] = 1;

      while (queue.length > 0) {
        const p = queue.pop();
        const px = p % width;
        const py = (p - px) / width;
        area.push([px, py]);
        left = Math.min(left, px);
        right = Math.max(right, px);

        for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (seen[q] || data[q * 4 + 3] < 128 || !nearBackground(nx, ny)) continue;
          seen[q] = 1;
          queue.push(q);
        }
      }

      if (right - left + 1 <= width / 5) {
        for (const [ax, ay] of area) {
          clear(ax, ay);
        }
      }
    }
  }
}

// Склеиваем в горизонтальную ленту.
const strip = new PNG({ width: width * frames.length, height });

for (let index = 0; index < frames.length; index += 1) {
  PNG.bitblt(frames[index], strip, 0, 0, width, height, index * width, 0);
}

fs.writeFileSync(outFile, PNG.sync.write(strip));

const perFrame = (total) => Math.round(total / frames.length);
console.log(`кадров: ${frames.length}, лента ${strip.width}x${strip.height}`);
console.log(
  `убрано фона: ${perFrame(backgroundRemoved)} пикселей на кадр из ${width * height} (${Math.round(
    (perFrame(backgroundRemoved) / (width * height)) * 100,
  )}%)`,
);
if (REMOVE_SHADOW) {
  console.log(`убрано тени: ${perFrame(shadowRemoved)} пикселей на кадр`);
}
