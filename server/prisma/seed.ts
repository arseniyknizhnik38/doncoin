import 'dotenv/config';
import { BUSINESS_CATALOG } from '../src/config/businesses.js';
import { prisma } from '../src/lib/prisma.js';

/**
 * Наполняет каталог бизнесов. Запускается сколько угодно раз: записи
 * обновляются по slug, поэтому дублей не появляется, а правка баланса
 * в config/businesses.ts доезжает до базы одним запуском.
 *
 * Рекламные кампании сид не трогает намеренно. Раньше он заводил их из
 * каталога в коде и гасил всё, чего в каталоге нет, — то есть первый же
 * деплой снёс бы кампании, заведённые через админку.
 */
async function main() {
  for (const business of BUSINESS_CATALOG) {
    const { slug, ...data } = business;

    await prisma.business.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  }

  // ——— Свои каналы игры: кампании «подпишись» рождаются вместе с базой.
  //
  // Это не возврат каталога кампаний в код: сид их только СОЗДАЁТ, если их
  // ещё нет (update пустой), и никогда не правит и не гасит — владелец
  // распоряжается ими из админки. Смысл: в день запуска секция подписок
  // полна, даже когда внешних рекламодателей ещё нет, а купленный трафик
  // сразу конвертируется в подписчиков собственных каналов.
  const OWN_CHANNELS = [
    {
      channelName: 'DonCoin',
      title: 'Шифры дня выходят там. Кто в канале — тот в деле.',
      channelUrl: 'https://t.me/doncoin_ru',
      channelChatId: '@doncoin_ru',
      sortOrder: 0,
    },
    {
      channelName: 'DonCoin EN',
      title: 'Day ciphers drop there. In the channel — in the family.',
      channelUrl: 'https://t.me/doncoin_en',
      channelChatId: '@doncoin_en',
      sortOrder: 1,
    },
  ];

  for (const channel of OWN_CHANNELS) {
    await prisma.favor.upsert({
      where: { weekNumber_channelName: { weekNumber: 0, channelName: channel.channelName } },
      update: {},
      create: {
        ...channel,
        weekNumber: 0,
        advertiser: 'DonCoin (свой канал)',
        rewardDonc: BigInt(50_000),
        rewardHours: 3,
        familyXpReward: 20,
        active: true,
      },
    });
  }

  console.log(`свои каналы: ${OWN_CHANNELS.length} кампании на месте`);

  const total = await prisma.business.count();
  console.log(`каталог бизнесов: ${BUSINESS_CATALOG.length} записей обновлено, всего в базе ${total}`);

  for (const b of BUSINESS_CATALOG) {
    const payback = Number(b.baseCost) / Number(b.baseIncomePerHour);
    console.log(
      `  ${b.name.padEnd(24)} цена ${b.baseCost.toString().padStart(10)} | доход/час ${b.baseIncomePerHour.toString().padStart(8)} | окупается за ${payback.toFixed(1)} ч`,
    );
  }
}

await main();
await prisma.$disconnect();
