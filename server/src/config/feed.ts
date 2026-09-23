import type { FeedEvent } from '../generated/prisma/client.js';

/**
 * Лента «Что слышно».
 *
 * Новичок заходит в мир, где не видно никого. Для игры, которая живёт на
 * ощущении «все в теме», это дыра прямо на первом экране: пустая игра
 * выглядит мёртвой независимо от того, сколько в ней людей на самом деле.
 *
 * Лента в основном про семьи — так в этом мире и устроено: на слуху не
 * личные успехи, а кто с кем сошёлся и кто поднялся. Про отдельных игроков
 * сюда попадает только то, чему завидуют. Лента из «такой-то заработал пять
 * сотен» читается как шум и перестаёт читаться на второй день.
 */

export type FeedKind =
  /** Семьи. */
  | 'clan_created'
  | 'clan_level'
  | 'war_started'
  | 'war_won'
  /** Игроки — только редкое. */
  | 'rank_up'
  | 'retired'
  | 'fat_envelope'
  | 'raffle_won';

/**
 * С какой ступени ранга повышение попадает в ленту.
 *
 * Девятая — «Капо ★». Ниже повышения идут каждые несколько часов у каждого
 * игрока: лента превратилась бы в бегущую строку, в которой ничего не видно.
 */
export const FEED_RANK_FROM_STEP = 9;

/** Сколько событий отдаём. */
export const FEED_LIMIT = 30;

/** Склонение суммы не требуется — числа показываем как есть. */
const coins = (value: bigint | null) => (value ?? 0n).toLocaleString('ru-RU');

/**
 * Текст события.
 *
 * Формулируется здесь, а не при записи: события хранятся разобранными на
 * части, поэтому формулировку можно переписать, не трогая уже случившееся.
 */
export function feedText(event: Pick<FeedEvent, 'kind' | 'actor' | 'rival' | 'amount' | 'rank'>): string {
  switch (event.kind as FeedKind) {
    case 'clan_created':
      return `Семья «${event.actor}» заявила о себе`;
    case 'clan_level':
      return `«${event.actor}» набрала силу: уровень ${event.amount ?? 1}`;
    case 'war_started':
      return `«${event.actor}» сошлись с «${event.rival}»`;
    case 'war_won':
      return event.amount && event.amount > 0n
        ? `«${event.actor}» взяли с «${event.rival}» ${coins(event.amount)}`
        : `«${event.actor}» разобрались с «${event.rival}»`;
    case 'rank_up':
      return `${event.actor} теперь ${event.rank}`;
    case 'retired':
      return `${event.actor} отошёл от дел`;
    case 'fat_envelope':
      return `${event.actor} получил толстый конверт: ${coins(event.amount)}`;
    case 'raffle_won':
      return `${event.actor} забрал из розыгрыша «${event.rival}»`;
    default:
      return event.actor;
  }
}

/** Про семьи или про человека — клиент разводит их по оформлению. */
export function isClanEvent(kind: string): boolean {
  return kind.startsWith('clan_') || kind.startsWith('war_');
}
