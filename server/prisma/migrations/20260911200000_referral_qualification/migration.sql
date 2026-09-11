-- Награда за друга платится не при регистрации, а после того, как
-- приглашённый реально поиграл.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralRewarded" BOOLEAN NOT NULL DEFAULT false;

-- Тем, за кого уже заплачено по старым правилам, ставим отметку: иначе при
-- первом же заходе пригласивший получил бы награду повторно.
UPDATE "User" SET "referralRewarded" = true WHERE "referredById" IS NOT NULL;
