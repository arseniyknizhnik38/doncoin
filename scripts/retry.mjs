/**
 * Запускает команду с повторами: до трёх попыток с паузой.
 *
 * Нужен сборке на Vercel: она перед клиентом применяет миграции и сидит
 * каталог в боевую базу, и когда база не отвечает мгновение — падает вся
 * выкладка. Локально всё зелёное, а деплой красный; серия таких отказов
 * лечилась пустыми коммитами, то есть повтором вручную. Повторяем машинно.
 *
 *   node scripts/retry.mjs npm run db:deploy -w server
 */
import { spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
const ATTEMPTS = 3;
const PAUSE_MS = 8_000;

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });

  if (result.status === 0) {
    process.exit(0);
  }

  console.error(`[retry] попытка ${attempt} из ${ATTEMPTS} не удалась (код ${result.status})`);

  if (attempt < ATTEMPTS) {
    const until = Date.now() + PAUSE_MS;
    while (Date.now() < until) {
      // Пауза без таймеров: скрипт одноразовый, блокировка безвредна.
    }
  }
}

process.exit(1);
