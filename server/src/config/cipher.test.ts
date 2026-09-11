import { describe, expect, it } from 'vitest';
import {
  CIPHER_ATTEMPTS_PER_DAY,
  attemptsLeft,
  attemptsUsed,
  isValidCipher,
  normalizeCipher,
} from './cipher.js';

const TODAY = 20_708;

describe('попытки угадать шифр', () => {
  it('считает потраченные сегодня', () => {
    expect(attemptsUsed({ cipherDay: TODAY, cipherAttempts: 3 }, TODAY)).toBe(3);
  });

  it('не переносит вчерашние попытки на сегодня', () => {
    // Счётчик не обнуляется фоновой задачей — он протухает вместе с днём.
    // Если бы вчерашние попытки считались, игрок, потративший их вчера,
    // сегодня не смог бы ввести код вовсе.
    expect(attemptsUsed({ cipherDay: TODAY - 1, cipherAttempts: 10 }, TODAY)).toBe(0);
    expect(attemptsLeft({ cipherDay: TODAY - 1, cipherAttempts: 10 }, TODAY)).toBe(
      CIPHER_ATTEMPTS_PER_DAY,
    );
  });

  it('доходит до нуля и не уходит в минус', () => {
    expect(attemptsLeft({ cipherDay: TODAY, cipherAttempts: 0 }, TODAY)).toBe(
      CIPHER_ATTEMPTS_PER_DAY,
    );
    expect(
      attemptsLeft({ cipherDay: TODAY, cipherAttempts: CIPHER_ATTEMPTS_PER_DAY }, TODAY),
    ).toBe(0);
    expect(
      attemptsLeft(
        { cipherDay: TODAY, cipherAttempts: CIPHER_ATTEMPTS_PER_DAY + 5 },
        TODAY,
      ),
    ).toBe(0);
  });

  it('оставляет перебор безнадёжным', () => {
    // Ради этого лимит и заведён: десять попыток в сутки против даже
    // трёхбуквенного кода — это годы.
    const combinations = 33 ** 3;

    expect(combinations / CIPHER_ATTEMPTS_PER_DAY).toBeGreaterThan(3_000);
  });
});

describe('нормализация кода', () => {
  it('прощает регистр и пробелы', () => {
    expect(normalizeCipher('  омерта ')).toBe('ОМЕРТА');
    expect(normalizeCipher('don coin')).toBe('DONCOIN');
  });

  it('принимает буквы и цифры, отвергает остальное', () => {
    expect(isValidCipher('ОМЕРТА')).toBe(true);
    expect(isValidCipher('DON2026')).toBe(true);
    expect(isValidCipher('ОК')).toBe(false);
    expect(isValidCipher('КОД-С-ДЕФИСОМ')).toBe(false);
    expect(isValidCipher('')).toBe(false);
  });
});
