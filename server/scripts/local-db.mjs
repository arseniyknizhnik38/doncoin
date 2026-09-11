/**
 * Поднимает Postgres прямо в этом процессе и выставляет его в TCP-порт.
 *
 * Нужен, чтобы запустить игру целиком, когда настоящей базы под рукой нет:
 * ни докера, ни установленного Postgres, ни строки подключения к Neon.
 * PGlite — это Postgres, собранный в WASM, а pglite-socket говорит на том же
 * протоколе, что и настоящий сервер, поэтому Prisma не замечает подмены.
 *
 * Данные держатся в памяти: каждый запуск начинается с чистой базы, и это
 * ровно то, что нужно для проверки — миграции прогоняются с нуля.
 *
 *   node scripts/local-db.mjs           # порт 55432
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/postgres"
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const port = Number(process.env.LOCAL_DB_PORT ?? 55432);
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });

await server.start();
console.log(`[local-db] Postgres слушает 127.0.0.1:${port}`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
