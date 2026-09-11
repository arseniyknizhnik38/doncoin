-- Ограничение попыток угадать шифр дня: без него код подбирается перебором,
-- и смысл шифра — привести игрока в канал — пропадает.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cipherDay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cipherAttempts" INTEGER NOT NULL DEFAULT 0;
