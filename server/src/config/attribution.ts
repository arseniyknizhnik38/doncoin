/**
 * Рекламная атрибуция: метка в ссылке и пороги засчёта конверсии.
 *
 * Сети платят за «качественного» игрока, а не за открытие приложения,
 * поэтому конверсией считается первое осмысленное действие в игре. Пороги
 * держим здесь, а не в коде отправки: их придётся двигать по требованию
 * конкретной сети, и каждое такое движение должно быть видно в одном месте.
 */

/** Конверсия засчитывается с этого числа тапов. */
export const CONVERSION_TAPS = 50;

/**
 * Сколько секунд должно пройти от первого входа.
 *
 * Отсекает не живых быстрых игроков, а скрипты: человек физически не успеет
 * открыть приложение, прочитать экран и отбить полсотни тапов за полминуты,
 * а эмулятор делает это мгновенно.
 *
 * Значение вынесено в окружение: у разных сетей своё представление о
 * допустимом окне, а сквозная проверка не может ждать по сорок секунд на
 * каждого тестового игрока.
 */
export const CONVERSION_MIN_SECONDS = Number(process.env.AD_MIN_SECONDS ?? 40);

/** Моложе — аккаунт считаем свежим и конверсию не отправляем. */
export const MIN_ACCOUNT_AGE_DAYS = 7;

/** Сколько конверсий с одного адреса за час допустимо. */
export const MAX_CONVERSIONS_PER_IP_HOUR = 3;

export interface AdTag {
  /** Сеть: adsgram, telega, blogger… */
  source: string;
  /** Площадка: у AdsGram это publisher_id, кто показал рекламу. */
  placement: string | null;
  /**
   * Кампания сети. У AdsGram это обязательное поле их API подтверждения
   * конверсий: без campaignid конверсия не засчитывается.
   */
  campaign: string | null;
  /** Идентификатор клика. Сети он в postback не нужен, но по нему видно
   * повторное использование ссылки и легче разбирать спорные случаи. */
  clickId: string;
}

/** Префикс, по которому рекламная метка отличается от кода кента. */
const AD_PREFIX = 'ad_';

/** Сеть — короткое слово. */
const SOURCE = /^[a-z0-9]{1,16}$/;

/**
 * Площадка. Дефис разрешён, потому что в неё складывается пара значений
 * сети: у AdsGram это «кто показал — в какой кампании», и обе половины
 * нужны в отчёте, а отдельной колонки они не стоят.
 */
const PLACEMENT = /^[a-z0-9-]{1,32}$/;

/** Click id сети: длинный, но без экзотики — Telegram сам ограничивает набор. */
const CLICK_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Разбирает start_param рекламной ссылки.
 *
 * Формат наш, потому что сеть подставляет в ссылку свои макросы и формат
 * задаём мы же в кабинете:
 *
 *   ad_<сеть>_<площадка>_<click id>
 *   ad_<сеть>_<click id>            — если площадку сеть не отдаёт
 *
 * Площадка вида «412-99071» разбирается на пару «кто показал — в какой
 * кампании»: у AdsGram оба числа приходят разными макросами, а слот в
 * ссылке один, потому что длина start_param ограничена 64 символами.
 *
 * Click id собирается из остатка целиком: внутри него встречаются
 * подчёркивания, и терять хвост нельзя — иначе сеть не узнает свой клик.
 *
 * Не метка (код кента, мусор, пустота) — возвращаем null: вызывающий код
 * тогда считает игрока органическим.
 */
export function parseAdTag(startParam: string | null | undefined): AdTag | null {
  if (!startParam || !startParam.startsWith(AD_PREFIX)) {
    return null;
  }

  const parts = startParam.slice(AD_PREFIX.length).split('_');

  if (parts.length < 2) {
    return null;
  }

  const source = (parts[0] ?? '').toLowerCase();

  if (!SOURCE.test(source)) {
    return null;
  }

  // Две части — площадки нет, остальное целиком click id.
  if (parts.length === 2) {
    const clickId = parts[1] ?? '';

    return CLICK_ID.test(clickId)
      ? { source, placement: null, campaign: null, clickId }
      : null;
  }

  const slot = (parts[1] ?? '').toLowerCase();
  const clickId = parts.slice(2).join('_');

  if (!PLACEMENT.test(slot) || !CLICK_ID.test(clickId)) {
    return null;
  }

  const pair = slot.split('-');
  const [placement, campaign] =
    pair.length === 2 && pair[0] && pair[1] ? [pair[0]!, pair[1]!] : [slot, null];

  return { source, placement, campaign, clickId };
}

/**
 * Возраст аккаунта Telegram по его идентификатору.
 *
 * Точной даты регистрации Telegram не отдаёт, но идентификаторы выдаются по
 * возрастанию, поэтому возраст оценивается линейно между двумя опорными
 * точками «идентификатор — дата». Опоры задаются переменной окружения:
 *
 *   AD_ID_ANCHORS="1000000000:2020-11-01,7000000000:2024-01-01"
 *
 * Это оценка, а не факт: вокруг границы в неделю ошибка естественна, и
 * ставить на ней что-то важнее антифрод-фильтра нельзя. Опор нет или они
 * кривые — возвращаем null, и проверка возраста просто не применяется:
 * молча резать всю закупку из-за ненастроенного справочника хуже, чем
 * пропустить часть ботов.
 */
export function estimateAccountAgeDays(
  telegramId: string,
  now: Date,
  raw = process.env.AD_ID_ANCHORS,
): number | null {
  const id = Number(telegramId);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  const anchors = (raw ?? '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [left, right] = pair.split(':');
      const anchorId = Number(left);
      const at = new Date(right ?? '');

      return Number.isFinite(anchorId) && !Number.isNaN(at.getTime())
        ? { id: anchorId, time: at.getTime() }
        : null;
    })
    .filter((anchor): anchor is { id: number; time: number } => anchor !== null)
    .sort((a, b) => a.id - b.id);

  if (anchors.length < 2) {
    return null;
  }

  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;

  if (last.id === first.id || last.time <= first.time) {
    return null;
  }

  // Идентификатор ниже первой опоры — аккаунт заведомо старый, считать нечего.
  if (id <= first.id) {
    return Math.max(0, (now.getTime() - first.time) / 86_400_000);
  }

  const perId = (last.time - first.time) / (last.id - first.id);
  const createdAt = first.time + (id - first.id) * perId;

  return (now.getTime() - createdAt) / 86_400_000;
}
