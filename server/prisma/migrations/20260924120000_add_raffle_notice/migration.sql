-- Отметка «об этом розыгрыше игроку уже написали»: анонс уходит один раз за тираж.
ALTER TABLE "User" ADD COLUMN "raffleNotifiedId" TEXT;
