-- Уведомления от бота.
-- notificationsBlocked ставится, когда Telegram отвечает, что бот заблокирован
-- или чат недоступен — чтобы не долбиться в закрытую дверь на каждом прогоне.

ALTER TABLE "User" ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notificationsBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastNotifiedAt" TIMESTAMP(3);
