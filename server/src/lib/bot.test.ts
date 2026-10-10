import { describe, expect, it } from 'vitest';
import { greetingFor, startPayload } from './bot.js';

describe('startPayload', () => {
  it('достаёт метку из команды', () => {
    expect(startPayload('/start ad_adsgram_412-99071_abc')).toBe('ad_adsgram_412-99071_abc');
  });

  it('пустой /start без метки', () => {
    expect(startPayload('/start')).toBeNull();
    expect(startPayload('/start   ')).toBeNull();
  });

  it('чужие команды и болтовню не трогает', () => {
    expect(startPayload('/help')).toBeNull();
    expect(startPayload('привет')).toBeNull();
    expect(startPayload(undefined)).toBeNull();
  });

  it('не пропускает то, чего Telegram в метке не допускает', () => {
    expect(startPayload('/start <script>')).toBeNull();
    expect(startPayload(`/start ${'x'.repeat(65)}`)).toBeNull();
  });
});

describe('greetingFor', () => {
  it('метка уезжает в кнопку, а не теряется', () => {
    const greeting = greetingFor('ru', 'ad_adsgram_412-99071_abc');
    const button = greeting.reply_markup.inline_keyboard[0]![0]!;

    expect(button.web_app.url).toContain('tag=ad_adsgram_412-99071_abc');
    expect(button.text).toContain('Играть');
  });

  it('без метки кнопка ведёт просто в игру', () => {
    const button = greetingFor('ru', null).reply_markup.inline_keyboard[0]![0]!;

    expect(button.web_app.url).not.toContain('tag=');
  });

  it('говорит на языке игрока', () => {
    expect(greetingFor('en', null).text).toContain('family');
    expect(greetingFor('zh-hans', null).text).toContain('家族');
    expect(greetingFor('ru', null).text).toContain('Семья');
    // Незнакомый язык получает английский, а не русский.
    expect(greetingFor('pt-br', null).text).toContain('family');
  });

  it('экранирует метку: в адресе не должно появиться лишних параметров', () => {
    const button = greetingFor('ru', 'abc').reply_markup.inline_keyboard[0]![0]!;

    expect(button.web_app.url.split('?')[1]).toBe('tag=abc');
  });
});
