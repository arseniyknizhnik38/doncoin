/**
 * Поднимает Postgres прямо в этом процессе и выставляет его в TCP-порт.
 *
 *   node scripts/local-db.mjs
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/postgres" npm run dev
 *
 * Нужен, чтобы запустить игру, когда настоящей базы под рукой нет: ни
 * докера, ни установленного Postgres, ни строки подключения к Neon. PGlite —
 * это Postgres, собранный в WASM, а pglite-socket говорит на том же
 * протоколе, что и настоящий сервер, поэтому Prisma не замечает подмены.
 *
 * Миграции накатываются сразу при старте: база живёт в памяти, каждый запуск
 * начинается с чистой, и без этого она бесполезна.
 *
 * PGlite ставится отдельно и в зависимости проекта не входит:
 *   npm install --no-save --ignore-scripts @electric-sql/pglite @electric-sql/pglite-socket
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { applyMigrations } from './lib/apply-migrations.mjs';

const port = Number(process.env.LOCAL_DB_PORT ?? 55432);
const db = await PGlite.create();

const applied = await applyMigrations(db);
console.log(`[local-db] применено миграций: ${applied}`);

const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });

await server.start();
console.log(`[local-db] Postgres слушает 127.0.0.1:${port}`);
console.log('[local-db] каталог пуст — залейте его: npm run db:seed -w server');

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
