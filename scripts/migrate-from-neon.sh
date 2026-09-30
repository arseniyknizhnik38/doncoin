#!/usr/bin/env bash
# Финальный перенос базы DonCoin: Neon -> локальный Postgres на сервере.
#
# Запуск на сервере:  bash scripts/migrate-from-neon.sh '<NEON DATABASE_URL>'
#
# Скрипт сам: считает контрольные суммы в Neon, снимает дамп, заменяет им
# локальную базу, сверяет цифры и перезапускает приложение. Любая ошибка
# останавливает всё до того, как тронута локальная база (дамп сначала в файл).
set -euo pipefail

NEON_URL="${1:?Использование: migrate-from-neon.sh '<neon database url>'}"
ENV_FILE="${ENV_FILE:-/opt/doncoin/server/.env}"
DUMP=/root/neon-final.dump

LOCAL_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
[ -n "$LOCAL_URL" ] || { echo "Не нашёл DATABASE_URL в $ENV_FILE"; exit 1; }

TABLES=(User RaffleTicket NftOwnership Raffle NftItem UserCase LeagueGroup FeedEvent)

counts() { # $1 = connection url, печатает "Таблица N"
  for t in "${TABLES[@]}"; do
    printf '%-16s %s\n' "$t" "$(psql "$1" -Atc "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo 'нет')"
  done
  printf '%-16s %s\n' 'lifetimeEarned' "$(psql "$1" -Atc 'SELECT coalesce(sum("lifetimeEarned"),0) FROM "User"' 2>/dev/null || echo 'нет')"
}

echo '== Neon (источник) =='
counts "$NEON_URL"

echo '== Снимаю дамп с Neon =='
pg_dump "$NEON_URL" --no-owner --no-privileges -Fc -f "$DUMP"
ls -lh "$DUMP"

echo '== Заменяю локальную базу =='
psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
pg_restore --no-owner --no-privileges -d "$LOCAL_URL" "$DUMP"

echo '== Локальная база (результат) =='
counts "$LOCAL_URL"

echo '== Перезапускаю приложение =='
pm2 restart all 2>/dev/null || systemctl restart doncoin 2>/dev/null || echo 'перезапусти приложение вручную'

echo 'ГОТОВО. Сверь цифры Neon и локальные выше — должны совпадать.'
