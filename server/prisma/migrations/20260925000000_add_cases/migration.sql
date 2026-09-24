-- Дела семьи: взятое дело, текущий шаг и точка отсчёта шага.
CREATE TABLE "UserCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseIndex" INTEGER NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "baseline" BIGINT NOT NULL DEFAULT 0,
    "stepStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserCase_userId_completedAt_idx" ON "UserCase"("userId", "completedAt");

ALTER TABLE "UserCase" ADD CONSTRAINT "UserCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
