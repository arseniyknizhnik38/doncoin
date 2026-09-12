-- Фоны за монеты: первая трата, которая не возвращает деньги.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "equippedBackdrop" TEXT;

-- CreateTable
CREATE TABLE "BackdropPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "backdropId" TEXT NOT NULL,
    "price" BIGINT NOT NULL DEFAULT 0,
    "boughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackdropPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackdropPurchase_userId_backdropId_key" ON "BackdropPurchase"("userId", "backdropId");

-- AddForeignKey
ALTER TABLE "BackdropPurchase" ADD CONSTRAINT "BackdropPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
