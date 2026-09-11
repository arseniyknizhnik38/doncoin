import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy server/.env.example to server/.env and paste your Neon connection string.',
  );
}

/**
 * На Vercel каждый инстанс функции держит свой пул. Дефолтные 10 соединений
 * на инстанс при десятке тёплых инстансов быстро упрутся в лимит Neon,
 * поэтому держим пул маленьким: запросы всё равно короткие, а пулер Neon
 * стоит перед базой. Локально можно позволить больше.
 */
const isServerless = Boolean(process.env.VERCEL);

/**
 * Размер пула можно переопределить переменной окружения.
 *
 * Во-первых, лимит Neon зависит от тарифа, и подбирать его перевыкладкой
 * кода — плохая идея. Во-вторых, локальный стенд (scripts/local-db.mjs)
 * держит ровно одно соединение, и без этой переменной поднять на нём игру
 * нельзя вовсе.
 */
const poolMax = Number(process.env.DATABASE_POOL_MAX) || (isServerless ? 3 : 10);

// Prisma 7 общается с PostgreSQL через driver adapter (здесь node-postgres).
const adapter = new PrismaPg({
  connectionString,
  max: poolMax,
  // Не держим простаивающие соединения дольше, чем живёт тёплый инстанс.
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
});

export const prisma = new PrismaClient({ adapter });
