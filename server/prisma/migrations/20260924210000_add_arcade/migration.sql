-- «Сбор выручки»: день последнего забега и личный рекорд.
ALTER TABLE "User" ADD COLUMN "arcadeDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "arcadeBest" INTEGER NOT NULL DEFAULT 0;
