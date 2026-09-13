-- Кента подозревают в стукачестве: когда написали и ждёт ли куш возвращения.
ALTER TABLE "User" ADD COLUMN "snitchCalledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "snitchPending" BOOLEAN NOT NULL DEFAULT false;
