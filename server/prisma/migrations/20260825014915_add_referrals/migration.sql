-- Реферальная система.
-- referralCode добавляем как nullable, заполняем существующим игрокам,
-- и только потом делаем обязательным — иначе ALTER упал бы на непустой таблице.

ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referralEarned" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;

UPDATE "User"
SET "referralCode" = upper(substring(md5(random()::text || "id") from 1 for 8))
WHERE "referralCode" IS NULL;

ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
