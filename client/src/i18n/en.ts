/**
 * Английские строки интерфейса.
 *
 * Не перевод, а пересказ. Дословно переведённая мафиозная интонация
 * рассыпается: «Вам занесли конверт» буквально по-английски звучит как
 * канцелярия, а не как то, что говорят в этом мире. Поэтому английский
 * текст писался заново от смысла — короче и суше, как оно и звучит
 * по-английски.
 *
 * Чего здесь нет — того, что ещё не переведено. Такая строка останется
 * русской: это заметно и чинится, в отличие от пустого места на экране.
 */
export const EN: Record<string, string> = {
  // ——— Вкладки
  'Игра': 'Play',
  'Дело': 'Business',
  'Клан': 'Family',
  'Топ': 'Top',
  'Семья': 'Crew',

  // ——— Объяснение новичку
  'Шаг 1': 'Step 1',
  'Шаг 2': 'Step 2',
  'Шаг 3': 'Step 3',
  'Шаг 4': 'Step 4',
  'Ты никто': 'You are nobody',
  'Толстый Бобби': 'Fat Bobby',
  'Слушай сюда. Тапай — каждый тап кладёт монеты в карман. Я тоже так начинал. Правда, я до сих пор не ушёл дальше, но у тебя-то получится.':
    'Listen up. Tap — every tap puts coins in your pocket. I started the same way. Never got much further, truth be told, but you will do better.',
  'Обойма кончается': 'The clip runs out',
  'За заход выбьешь одну полную обойму, дальше она копится сама, часа полтора. Как раз успеешь поесть. Мне-то дон велел одни салаты… короче, заходи несколько раз в день.':
    'One sitting gets you one full clip, then it refills on its own, hour and a half or so. Just enough time to eat. Me, the don has me on salads… anyway, come back a few times a day.',
  'Деньги должны работать': 'Money has to work',
  'Во вкладке «Дело» бери улучшения и бизнесы — они капают, пока тебя нет. Только касса переполняется за четыре часа. Я свою однажды на неделю забыл. Не будем об этом.':
    'Under Business, grab upgrades and businesses — they earn while you are away. But the till overflows in four hours. I once forgot mine for a week. We do not talk about it.',
  'Один в поле не воин': 'Nobody makes it alone',
  'Зови друзей, вступай в клан, забирай бонус каждый день. Пропустишь день — серия сгорит. У меня так с диетой вышло. Всё, иди работай. И это — меня здесь не было.':
    'Bring friends, join a family, grab the bonus every day. Miss a day and the streak burns. Same thing happened to my diet. Now get to work. And hey — I was never here.',
  'Повышение': 'Promotion',
  'В дело': 'Back to business',
  'Дальше': 'Next',
  'Начать': 'Start',
  'Понятно': 'Got it',
  'За работу': 'Get to work',
  'Пропустить': 'Skip',

  // ——— Главный экран
  'Дон': 'Don',
  'Обойма': 'Clip',
  'за тап': 'per tap',
  'Обойма пуста — восстанавливается {n} тапов в минуту':
    'Clip is empty — refills {n} taps per minute',
  'Тапнуть': 'Tap',
  'Высший ранг — вершина семьи': 'Top rank — the head of the family',
  'ДонКоинов до': 'DonCoins to',

  // ——— Награды
  'Пока вас не было': 'While you were away',
  'Семья заработала': 'The family earned',
  'копится не больше 8 часов': 'accrues for 8 hours at most',
  'Бонус получен': 'Bonus collected',
  'Забрать бонус дня': 'Collect day',
  'Задания': 'Jobs',
  'готово': 'ready',
  'тройной бонус': 'triple bonus',
  'день': 'day',
  'дн.': 'd',
  'Через': 'In',

  // ——— Кента подозревали
  'Не стукач': 'No rat',
  'Вернулся — {inviter} за тебя поручился. Куш обоим:':
    'You came back — {inviter} vouched for you. A cut for both:',
  'Вернулся. Куш:': 'You came back. Your cut:',

  // ——— Шифр Омерты
  'Шифр Омерты': 'Omerta Code',
  'Разгадан': 'Cracked',
  'Новый шифр — завтра.': 'A new code tomorrow.',
  'Попытки на сегодня кончились. Новый шифр — завтра.': 'No tries left today. A new code tomorrow.',
  'Разложи предметы в правильном порядке. Кто знает — тот молчит. Почти.':
    'Put the items in the right order. Those who know keep quiet. Mostly.',
  'Пустая ячейка': 'Empty slot',
  'Попыток осталось: {n}': 'Tries left: {n}',
  'На своих местах: {hits} из {total}': 'In place: {hits} of {total}',
  'Проверить': 'Check',

  // ——— Конверт
  'Вам занесли конверт': 'An envelope came for you',
  'Открываем…': 'Opening…',
  'Сегодняшний конверт уже у вас': "You already took today's envelope",
  'Заносить начнут с ранга «{rank}»': 'Envelopes start at {rank}',
  'Следующий завтра': 'Next one tomorrow',
  'Тонкий конверт': 'Thin envelope',
  'Обычный конверт': 'Regular envelope',
  'Плотный конверт': 'Fat envelope',
  'Толстый конверт': 'Heavy envelope',

  // ——— Бустеры
  'Полная обойма': 'Full clip',
  'Разгон': 'Rush',
  'Мгновенно заполнить обойму': 'Refill the clip instantly',

  // ——— Общее
  'Закрыть': 'Close',
  'Забрать': 'Collect',
  'Забираем…': 'Collecting…',
  'Покупаем…': 'Buying…',
  'Купить': 'Buy',
  'Улучшить': 'Upgrade',
  'Получено': 'Collected',
  'Ошибка сети': 'Network error',
  'Не удалось загрузить': 'Could not load',
  'Повторить': 'Retry',
};
