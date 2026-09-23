-- Розыгрыши генезис-коллекции: вещи, экземпляры в сейфах, билеты, тиражи.
CREATE TABLE "NftItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "supply" INTEGER NOT NULL,
    "minted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NftItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NftOwnership" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serial" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'raffle',
    "wonAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnTo" TEXT,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "NftOwnership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Raffle" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "winnerId" TEXT,
    "drawnAt" TIMESTAMP(3),
    "totalTickets" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaffleTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NftOwnership_itemId_serial_key" ON "NftOwnership"("itemId", "serial");

CREATE INDEX "NftOwnership_userId_idx" ON "NftOwnership"("userId");

CREATE INDEX "RaffleTicket_userId_createdAt_idx" ON "RaffleTicket"("userId", "createdAt");

CREATE INDEX "RaffleTicket_createdAt_idx" ON "RaffleTicket"("createdAt");

ALTER TABLE "NftOwnership" ADD CONSTRAINT "NftOwnership_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "NftItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NftOwnership" ADD CONSTRAINT "NftOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "NftItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
