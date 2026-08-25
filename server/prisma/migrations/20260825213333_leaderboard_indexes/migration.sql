-- Индексы под лидерборд: сортировка топа и подсчёт позиции игрока.
-- Без них каждый запрос читал бы таблицу целиком.

CREATE INDEX "User_totalEarned_idx" ON "User"("totalEarned");
CREATE INDEX "Clan_treasury_idx" ON "Clan"("treasury");
