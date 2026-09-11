/**
 * Сквозная проверка игры: проходит путь живого игрока через настоящий HTTP.
 *
 * Зачем отдельно от vitest: юнит-тесты проверяют формулы, но не проверяют,
 * что сервер вообще поднимается, что Prisma видит колонки, которые ждёт код,
 * и что маршруты отвечают тем, что клиент разбирает. Собранная из этих трёх
 * вещей ошибка ловится только запуском.
 *
 * Как запускать — см. README, раздел «Проверка без настоящей базы».
 *
 *   API=http://127.0.0.1:3100 node scripts/smoke.mjs
 */
import { createHmac } from 'node:crypto';

const API = process.env.API ?? 'http://127.0.0.1:3100';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '123456:TEST_ONLY_NOT_A_REAL_TOKEN';

let failures = 0;
let checks = 0;

function check(label, condition, detail = '') {
  checks += 1;

  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  ФЕЙЛ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Подписывает initData ровно так, как это делает Telegram. */
function signInitData(user, startParam) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAF',
    user: JSON.stringify(user),
  });

  if (startParam) {
    params.set('start_param', startParam);
  }

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));

  return params.toString();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => null);

  return { status: response.status, payload };
}

async function login(id, firstName, startParam) {
  const initData = signInitData(
    { id, first_name: firstName, username: `player${id}` },
    startParam,
  );

  const response = await fetch(`${API}/api/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  return { status: response.status, payload: await response.json().catch(() => null) };
}

console.log(`Проверяем ${API}\n`);

// ——— Вход
const health = await call('/api/health');
check('сервер отвечает', health.payload?.status === 'ok');

const auth = await login(777001, 'Дон');
check('вход по initData', auth.status === 200, JSON.stringify(auth.payload));

const token = auth.payload?.session?.token;
check('выдан сессионный токен', typeof token === 'string' && token.length > 10);

if (!token) {
  console.error('\nБез токена дальше проверять нечего.');
  process.exit(1);
}

const start = auth.payload?.state;
check('стартовая обойма 600 тапов', start?.energyMax / start?.energyPerTap === 600,
  `energyMax=${start?.energyMax} energyPerTap=${start?.energyPerTap}`);
check('стартовая награда за тап 10', start?.coinsPerTap === 10, `${start?.coinsPerTap}`);
check('стартовый ранг — Аутсайдер', start?.rank?.id === 'outsider', start?.rank?.id);
check('ранг со звёздами', start?.rank?.star === 1 && start?.rank?.stars === 3);

// ——— Подделанная подпись не проходит
const forged = await fetch(`${API}/api/auth/telegram`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    initData: 'user=%7B%22id%22%3A999%7D&auth_date=1&hash=deadbeef',
  }),
});
check('поддельная подпись отвергается', forged.status === 401 || forged.status === 403,
  `статус ${forged.status}`);

// ——— Тапы
const tap = await call('/api/game/tap', { token, method: 'POST', body: { taps: 50 } });
check('тапы засчитаны', tap.payload?.accepted === 50, JSON.stringify(tap.payload?.accepted));
check('монеты начислены', tap.payload?.awarded === 500, `${tap.payload?.awarded}`);
check(
  'энергия списана по 10 за тап',
  start.energy - tap.payload?.state?.energy === 500,
  `было ${start?.energy}, стало ${tap.payload?.state?.energy}`,
);
check('Respect за 50 тапов', tap.payload?.respectAwarded === 1, `${tap.payload?.respectAwarded}`);

const overTap = await call('/api/game/tap', { token, method: 'POST', body: { taps: 5000 } });
check('пачка больше лимита отвергается', overTap.status === 400, `статус ${overTap.status}`);

// ——— Улучшения
const upgrades = await call('/api/upgrades', { token });
const tapUpgrade = upgrades.payload?.upgrades?.find((item) => item.id === 'tap');
check('каталог улучшений отдаётся', Array.isArray(upgrades.payload?.upgrades));
check('«Хватка» стоит 1000', tapUpgrade?.price === '1000', tapUpgrade?.price);

const poorBuy = await call('/api/upgrades/tap/buy', { token, method: 'POST' });
check('без денег улучшение не продаётся', poorBuy.status === 409, `статус ${poorBuy.status}`);

// ——— Бизнесы: гейт по рангу
const businesses = await call('/api/businesses', { token });
const kiosk = businesses.payload?.businesses?.find((item) => item.slug === 'street_food');
const offshore = businesses.payload?.businesses?.find((item) => item.slug === 'offshore');
check('каталог бизнесов из 12', businesses.payload?.businesses?.length === 12,
  `${businesses.payload?.businesses?.length}`);
check('ларёк доступен сразу', kiosk?.locked === false);
check('оффшор закрыт рангом', offshore?.locked === true);
check('у закрытого указан нужный ранг', typeof offshore?.requiredRank === 'string' && offshore.requiredRank.includes('Консильери'), offshore?.requiredRank);

const lockedBuy = await call(`/api/businesses/${offshore?.id}/buy`, { token, method: 'POST' });
check('закрытый бизнес не продаётся', lockedBuy.status === 409, `статус ${lockedBuy.status}`);

// ——— Бустеры
const boosters = await call('/api/boosters', { token });
check('бустеров двое', boosters.payload?.boosters?.length === 2);
check('по три заряда', boosters.payload?.boosters?.every((b) => b.left === 3));

const rush = await call('/api/boosters/rush/use', { token, method: 'POST' });
check('«Разгон» включается', rush.status === 200, JSON.stringify(rush.payload).slice(0, 120));
check('множитель виден в состоянии', rush.payload?.state?.rushUntil !== null);

const rushTap = await call('/api/game/tap', { token, method: 'POST', body: { taps: 10 } });
check('во время «Разгона» платят впятеро', rushTap.payload?.awarded === 500,
  `${rushTap.payload?.awarded}`);

const fullEnergy = await call('/api/boosters/full_energy/use', { token, method: 'POST' });
check('«Полная обойма» заливает энергию',
  fullEnergy.payload?.state?.energy === fullEnergy.payload?.state?.energyMax);

// Четвёртый заряд за сутки не должен пройти.
await call('/api/boosters/rush/use', { token, method: 'POST' });
await call('/api/boosters/rush/use', { token, method: 'POST' });
const overRush = await call('/api/boosters/rush/use', { token, method: 'POST' });
check('четвёртый заряд не даётся', overRush.status === 409, `статус ${overRush.status}`);

// ——— Задания дня
const quests = await call('/api/quests', { token });
check('выдано три задания дня', quests.payload?.quests?.length === 3,
  `${quests.payload?.quests?.length}`);
check('сундук пока не готов', quests.payload?.chest?.ready === false);
check('известно, когда обновятся', quests.payload?.resetInSeconds > 0);

const secondQuests = await call('/api/quests', { token });
check(
  'задания за день не меняются',
  JSON.stringify(quests.payload?.quests?.map((q) => q.id)) ===
    JSON.stringify(secondQuests.payload?.quests?.map((q) => q.id)),
);

// ——— Ежедневный бонус
const daily = await call('/api/daily', { token });
check('бонус доступен в первый день', daily.payload?.daily?.available === true);
check('серия считается до 30', daily.payload?.daily?.streakCap === 30);

const claimed = await call('/api/daily/claim', { token, method: 'POST' });
check('бонус выдаётся', claimed.status === 200, `статус ${claimed.status}`);

const twice = await call('/api/daily/claim', { token, method: 'POST' });
check('дважды за день не выдаётся', twice.status === 409, `статус ${twice.status}`);

// ——— Шифр дня: админка и перебор
const noCipher = await call('/api/cipher', { token });
check('без заведённого шифра карточки нет', noCipher.payload?.cipher?.available === false);

const setCipher = await call('/api/admin/cipher', {
  token,
  method: 'POST',
  body: { code: 'ОМЕРТА', hint: 'В закрепе', day: 0 },
});
check('владелец заводит шифр', setCipher.status === 200, JSON.stringify(setCipher.payload));

const withCipher = await call('/api/cipher', { token });
check('шифр появился у игрока', withCipher.payload?.cipher?.available === true);
check('подсказка видна', withCipher.payload?.cipher?.hint === 'В закрепе');
check('попыток десять', withCipher.payload?.cipher?.attemptsLeft === 10,
  `${withCipher.payload?.cipher?.attemptsLeft}`);

const wrong = await call('/api/cipher/solve', { token, method: 'POST', body: { code: 'НЕВЕРНО' } });
check('неверный код отвергается', wrong.status === 409, `статус ${wrong.status}`);

const afterWrong = await call('/api/cipher', { token });
check('неверная попытка списалась', afterWrong.payload?.cipher?.attemptsLeft === 9,
  `${afterWrong.payload?.cipher?.attemptsLeft}`);

// Выжигаем оставшиеся попытки — перебор должен упереться в лимит.
// С паузой: иначе раньше срабатывает защита от частых запросов, и проверка
// меряет не то, что нужно.
for (let i = 0; i < 9; i += 1) {
  await call('/api/cipher/solve', { token, method: 'POST', body: { code: `МИМО${i}` } });
  await wait(1100);
}

const exhausted = await call('/api/cipher/solve', { token, method: 'POST', body: { code: 'ОМЕРТА' } });
check('перебор упирается в лимит', exhausted.payload?.code === 'NO_ATTEMPTS',
  JSON.stringify(exhausted.payload));

const afterExhausted = await call('/api/cipher', { token });
check('попыток не осталось', afterExhausted.payload?.cipher?.attemptsLeft === 0,
  `${afterExhausted.payload?.cipher?.attemptsLeft}`);

// ——— Второй игрок: шифр разгадывается с первой попытки
const second = await login(777002, 'Новичок');
const token2 = second.payload?.session?.token;
const solved = await call('/api/cipher/solve', {
  token: token2,
  method: 'POST',
  body: { code: ' омерта ' },
});
check('верный код принимается без учёта регистра', solved.status === 200,
  JSON.stringify(solved.payload).slice(0, 120));
check('награда за шифр начислена', Number(solved.payload?.reward) > 0, solved.payload?.reward);

const solvedTwice = await call('/api/cipher/solve', {
  token: token2,
  method: 'POST',
  body: { code: 'ОМЕРТА' },
});
check('дважды шифр не оплачивается', solvedTwice.status === 409, `статус ${solvedTwice.status}`);

// ——— Рекламные кампании
const ad = await call('/api/admin/ads', {
  token,
  method: 'POST',
  body: {
    advertiser: 'Матрёшка',
    title: 'Подпишись на канал',
    channelName: 'Матрёшка Экспресс',
    channelUrl: 'https://t.me/matryoshkaexpress',
    channelChatId: '@matryoshkaexpress',
    rewardDonc: 50000,
    rewardHours: 3,
    slots: 2,
  },
});
check('кампания заводится', ad.status === 200, JSON.stringify(ad.payload).slice(0, 160));

const ads = await call('/api/admin/ads', { token });
check('кампания видна в админке', ads.payload?.ads?.length >= 1);
check('статус — идёт', ads.payload?.ads?.[0]?.status === 'running',
  ads.payload?.ads?.[0]?.status);
check('лимит подписок сохранён', ads.payload?.ads?.[0]?.slots === 2);

const playerAds = await call('/api/favors', { token });
check('кампания видна игроку', playerAds.payload?.favors?.length === 1);
check('осталось два места', playerAds.payload?.favors?.[0]?.slotsLeft === 2);

const badAd = await call('/api/admin/ads', {
  token,
  method: 'POST',
  body: { title: 'Без канала', channelUrl: 'https://example.com/not-telegram' },
});
check('кампания с чужой ссылкой отвергается', badAd.status === 400, `статус ${badAd.status}`);

// ——— Посторонний в админку не попадает
const outsider = await call('/api/admin/stats', { token: token2 });
check('чужому админка не отвечает', outsider.status === 404, `статус ${outsider.status}`);

const stats = await call('/api/admin/stats', { token });
check('сводка владельцу отдаётся', stats.status === 200);
check('игроков двое', stats.payload?.players?.total === 2, `${stats.payload?.players?.total}`);

// ——— Удержание и приток
check('удержание считается по четырём дням', stats.payload?.retention?.length === 4,
  `${stats.payload?.retention?.length}`);
check(
  'удержание честно молчит, пока не на ком считать',
  stats.payload?.retention?.every((point) => point.eligible === 0 && point.percent === null),
  JSON.stringify(stats.payload?.retention),
);
check('приток за две недели', stats.payload?.days?.length === 14,
  `${stats.payload?.days?.length}`);

const today = stats.payload?.days?.find((entry) => entry.ago === 0);
check('сегодняшние новички посчитаны', today?.newPlayers === 2, `${today?.newPlayers}`);
check('сегодняшние заходы посчитаны', today?.activePlayers === 2, `${today?.activePlayers}`);

// ——— Лидерборд и кланы
const board = await call('/api/leaderboard', { token });
check('лидерборд отвечает', board.status === 200, `статус ${board.status}`);

const clan = await call('/api/clans', { token, method: 'POST', body: { name: 'Корлеоне' } });
check('без ранга клан не создать', clan.status === 409 || clan.status === 403,
  `статус ${clan.status}`);

// ——— Реферал
// Свой код игрок узнаёт из /api/referrals — при входе он не отдаётся.
const referrals = await call('/api/referrals', { token });
check('свой реферальный код выдаётся', typeof referrals.payload?.code === 'string',
  JSON.stringify(referrals.payload).slice(0, 120));

const invitedBy = await login(777003, 'Приведённый', referrals.payload?.code);
check('вход по реферальной ссылке', invitedBy.status === 200);
check(
  'новичок получил стартовый бонус',
  Number(invitedBy.payload?.state?.balance) === 10_000,
  invitedBy.payload?.state?.balance,
);

const afterInvite = await call('/api/referrals', { token });
check('приглашение засчитано пригласившему', afterInvite.payload?.invitedCount === 1,
  `${afterInvite.payload?.invitedCount}`);
check(
  'за неигравшего друга не платят',
  Number(afterInvite.payload?.earned) === 0 && afterInvite.payload?.confirmedCount === 0,
  `заработано ${afterInvite.payload?.earned}, засчитано ${afterInvite.payload?.confirmedCount}`,
);
check('порог зачёта объявлен', afterInvite.payload?.qualifyTaps > 0,
  `${afterInvite.payload?.qualifyTaps}`);

// ——— Друг доигрывает до порога: без этого награда чеканилась бы скриптом.
const inviteeToken = invitedBy.payload?.session?.token;
const qualifyTaps = afterInvite.payload?.qualifyTaps ?? 2_000;
let tapped = 0;

while (tapped < qualifyTaps) {
  const batch = await call('/api/game/tap', {
    token: inviteeToken,
    method: 'POST',
    body: { taps: 50 },
  });

  const accepted = batch.payload?.accepted ?? 0;
  tapped += accepted;

  // Обойма кончилась — тратим бесплатный заряд. Их три, этого хватает
  // ровно на порог: четыре обоймы по 600 тапов.
  if (accepted < 50) {
    const refill = await call('/api/boosters/full_energy/use', {
      token: inviteeToken,
      method: 'POST',
    });

    if (refill.status !== 200) {
      break;
    }
  }

  // Ограничитель пропускает четыре запроса в секунду.
  await wait(260);
}

check('друг натапал порог', tapped >= qualifyTaps, `${tapped} из ${qualifyTaps}`);

const afterQualify = await call('/api/referrals', { token });
check('награда за друга пришла после порога',
  Number(afterQualify.payload?.earned) === 25_000, afterQualify.payload?.earned);
check('друг отмечен засчитанным', afterQualify.payload?.confirmedCount === 1,
  `${afterQualify.payload?.confirmedCount}`);

// Ещё пачка тапов не должна принести пригласившему вторую награду.
await call('/api/game/tap', { token: inviteeToken, method: 'POST', body: { taps: 10 } });
const afterExtra = await call('/api/referrals', { token });
check('дважды за одного друга не платят',
  Number(afterExtra.payload?.earned) === 25_000, afterExtra.payload?.earned);

console.log(`\nПроверок: ${checks}, провалено: ${failures}`);
process.exit(failures > 0 ? 1 : 0);
