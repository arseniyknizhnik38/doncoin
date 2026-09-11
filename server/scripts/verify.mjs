/**
 * Полная проверка игры на чистой базе, одной командой.
 *
 *   npm run verify -w server
 *
 * Что делает: поднимает Postgres прямо в этом процессе, накатывает на него
 * миграции тем же `prisma migrate deploy`, что и Vercel, заливает каталог
 * сидом, запускает настоящий сервер и проходит по нему путь живого игрока.
 *
 * Зачем: до этого проект ни разу не запускался целиком. Юнит-тесты
 * проверяют формулы, но не ловят ни ошибку в написанной руками миграции,
 * ни расхождение между колонкой в базе и полем, которого ждёт код, ни
 * маршрут, отвечающий не тем, что разбирает клиент. Всё это видно только
 * при запуске — а запускать было негде: ни докера, ни Postgres, ни строки
 * подключения к Neon.
 *
 * PGlite — это Postgres, собранный в WASM. Он ставится отдельно и не входит
 * в зависимости проекта: на сборку сайта он не влияет, а весит немало.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(here, '..');
const nodeModules = path.join(serverDir, '..', 'node_modules');

const PORT = Number(process.env.VERIFY_PORT ?? 3100);
const DB_PORT = Number(process.env.VERIFY_DB_PORT ?? 55432);
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;
const BOT_TOKEN = '123456:TEST_ONLY_NOT_A_REAL_TOKEN';

const env = {
  ...process.env,
  DATABASE_URL,
  // Стенд держит ровно одно соединение, поэтому пул тоже один.
  DATABASE_POOL_MAX: '1',
  TELEGRAM_BOT_TOKEN: BOT_TOKEN,
  ADMIN_TELEGRAM_IDS: '777001',
  PORT: String(PORT),
  API: `http://127.0.0.1:${PORT}`,
};

let PGlite;
let PGLiteSocketServer;

try {
  ({ PGlite } = await import('@electric-sql/pglite'));
  ({ PGLiteSocketServer } = await import('@electric-sql/pglite-socket'));
} catch {
  console.error(
    'Нет PGlite. Поставьте разово (в зависимости проекта он намеренно не входит):\n' +
      '  npm install --no-save --ignore-scripts @electric-sql/pglite @electric-sql/pglite-socket',
  );
  process.exit(1);
}

/** Запускает команду и ждёт её завершения. */
function run(label, command, args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: serverDir,
      env,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    });

    let output = '';

    if (quiet) {
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
    }

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        if (quiet) {
          console.error(output);
        }

        reject(new Error(`${label}: код выхода ${code}`));
      }
    });
  });
}

/** Ждёт, пока сервер начнёт отвечать. */
async function waitForHealth(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Сервер ещё поднимается — это ожидаемо.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error('сервер не ответил за отведённое время');
}

const db = await PGlite.create();
const socket = new PGLiteSocketServer({ db, port: DB_PORT, host: '127.0.0.1' });
await socket.start();
console.log(`[verify] Postgres в памяти на порту ${DB_PORT}`);

let api;
let code = 1;

try {
  console.log('[verify] миграции');
  await run('migrate deploy', process.execPath,
    [path.join(nodeModules, 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    { quiet: true });

  console.log('[verify] сид');
  await run('seed', process.execPath,
    [path.join(nodeModules, 'tsx', 'dist', 'cli.mjs'), 'prisma/seed.ts'],
    { quiet: true });

  console.log('[verify] сервер');
  api = spawn(
    process.execPath,
    [path.join(nodeModules, 'tsx', 'dist', 'cli.mjs'), 'src/index.ts'],
    { cwd: serverDir, env, stdio: ['ignore', 'ignore', 'inherit'] },
  );

  await waitForHealth();

  console.log('[verify] проверки\n');
  await run('smoke', process.execPath, [path.join(here, 'smoke.mjs')]);
  code = 0;
} catch (error) {
  console.error(`\n[verify] ${error.message}`);
} finally {
  api?.kill();
  await socket.stop();
  await db.close();
}

process.exit(code);
