import 'dotenv/config';
import { BUSINESS_CATALOG } from '../src/config/businesses.js';
import { FAVOR_CATALOG, weekNumber } from '../src/config/favors.js';
import { prisma } from '../src/lib/prisma.js';

/**
 * Наполняет каталог бизнесов. Запускается сколько угодно раз: записи
 * обновляются по slug, поэтому дублей не появляется, а правка баланса
 * в config/businesses.ts доезжает до базы одним запуском.
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

  // Поручения заводим на текущую неделю. Ключ (неделя + канал) уникален,
  // поэтому повторный запуск обновляет записи, а не плодит их.
  const week = weekNumber(new Date());

  for (const favor of FAVOR_CATALOG) {
    await prisma.favor.upsert({
      where: {
        weekNumber_channelName: { weekNumber: week, channelName: favor.channelName },
      },
      update: { ...favor, active: true },
      create: { ...favor, weekNumber: week, active: true },
    });
  }

  // Убранные из каталога поручения гасим, а не удаляем: у игроков могли
  // остаться отметки о выполнении, и внешний ключ на них не пустит DELETE.
  const retired = await prisma.favor.updateMany({
    where: {
      weekNumber: week,
      active: true,
      channelName: { notIn: FAVOR_CATALOG.map((favor) => favor.channelName) },
    },
    data: { active: false },
  });

  console.log(
    `поручения: ${FAVOR_CATALOG.length} активных на неделю ${week}` +
      (retired.count > 0 ? `, отключено лишних: ${retired.count}` : ''),
  );

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
