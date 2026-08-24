import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy server/.env.example to server/.env and paste your Neon connection string.',
  );
}

// Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres here).
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
