-- Язык интерфейса. Существующие игроки пришли из русскоязычного запуска,
-- поэтому им остаётся русский.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ru';
