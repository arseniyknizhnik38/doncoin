import { shareStory } from '@telegram-apps/sdk-react';
import { MINI_APP_LINK } from '../config';
import type { Lang } from '../i18n';

/**
 * Карточки в сторис: хвастовство как канал привлечения.
 *
 * Карточки статические (client/public/cards), по одной на ранг и вещь на
 * каждом языке — Telegram забирает картинку по публичному адресу, поэтому
 * серийники и имена не на картинке, а в подписи. Ссылка тоже в подписи:
 * виджет-ссылки в сторис Telegram отдаёт только премиум-подписчикам,
 * а подпись видят все.
 */

/** Идентификаторы рангов, для которых нарисованы карточки. */
const RANK_CARDS = new Set([
  'outsider', 'associate', 'soldier', 'capo', 'consigliere', 'don',
]);

const ITEM_CARDS = new Set([
  'cigar', 'dice', 'shades', 'car_keys', 'revolver', 'ring',
]);

/** Кнопку показываем только там, где Telegram умеет сторис. */
export function canShareStory(): boolean {
  return shareStory.isAvailable();
}

const cardUrl = (file: string) => `${window.location.origin}/cards/${file}`;

export function shareRankStory(rankId: string, title: string, lang: Lang): void {
  if (!RANK_CARDS.has(rankId)) {
    return;
  }

  const text =
    lang === 'en'
      ? `I made ${title} in DONCOIN. ${MINI_APP_LINK}`
      : `Я теперь ${title} в DONCOIN. ${MINI_APP_LINK}`;

  shareStory.ifAvailable(cardUrl(`rank-${rankId}-${lang}.png`), { text });
}

export function shareArcadeStory(score: number, lang: Lang): void {
  const text =
    lang === 'en'
      ? `My Collection Run record in DONCOIN: ${score}. Beat it: ${MINI_APP_LINK}`
      : `Мой рекорд в «Сборе выручки» DONCOIN: ${score}. Побей: ${MINI_APP_LINK}`;

  shareStory.ifAvailable(cardUrl(`arcade-${lang}.png`), { text });
}

export function shareItemStory(
  itemId: string,
  name: string,
  serial: number,
  supply: number,
  lang: Lang,
): void {
  if (!ITEM_CARDS.has(itemId)) {
    return;
  }

  const text =
    lang === 'en'
      ? `My DONCOIN genesis piece: ${name}, No. ${serial} of ${supply}. ${MINI_APP_LINK}`
      : `Моя вещь из генезис-коллекции DONCOIN: «${name}», № ${serial} из ${supply}. ${MINI_APP_LINK}`;

  shareStory.ifAvailable(cardUrl(`item-${itemId}-${lang}.png`), { text });
}
