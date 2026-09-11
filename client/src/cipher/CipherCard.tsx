import { useState } from 'react';
import type { CipherApi } from './useCipher';

interface CipherCardProps {
  api: CipherApi;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * Шифр дня. Код прячется в канале, вводится здесь.
 *
 * Карточка живёт в панели заданий, а не на главном экране: искать код —
 * отдельное дело на пару минут, и оно не должно перебивать кнопку тапа.
 */
export function CipherCard({ api }: CipherCardProps) {
  const [code, setCode] = useState('');
  const cipher = api.cipher;

  // Шифра на сегодня нет — карточку не показываем вовсе, иначе она выглядит
  // как сломанная функция.
  if (!cipher?.available) {
    return null;
  }

  if (cipher.solved) {
    return (
      <div className="rounded-xl border border-don-gold/40 bg-don-ink/80 px-4 py-3 text-left">
        <p className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
          Шифр дня
        </p>
        <p className="mt-1 text-sm text-neutral-300">
          Разгадан
          {api.justSolved && (
            <span className="text-don-gold-soft"> · +{formatCoins(api.justSolved)}</span>
          )}
          . Следующий — завтра.
        </p>
      </div>
    );
  }

  // Попытки кончились — форму убираем совсем. Оставленное поле ввода, которое
  // всё равно откажет, читается как поломка, а не как правило.
  if (cipher.attemptsLeft <= 0) {
    return (
      <div className="rounded-xl border border-don-blood/40 bg-don-ink/60 px-4 py-3 text-left">
        <p className="text-[11px] tracking-[0.25em] text-neutral-500 uppercase">
          Шифр дня
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Попытки на сегодня кончились. Новый шифр — завтра.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 px-4 py-3 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
          Шифр дня
        </p>
        <span className="text-xs text-don-gold-soft tabular-nums">
          +{formatCoins(cipher.rewardCoins)}
        </span>
      </div>

      <p className="mt-1 text-xs text-neutral-500">
        {cipher.hint ?? 'Код спрятан в нашем канале'}
      </p>

      {/* Попытки ограничены, чтобы код не подбирали перебором. Молчать об
          этом нельзя: иначе игрок узнаёт о лимите, только упершись в него. */}
      <p className="mt-1 text-[11px] tracking-wider text-neutral-600">
        Попыток осталось: {cipher.attemptsLeft}
      </p>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          api.solve(code);
          setCode('');
        }}
      >
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={32}
          placeholder="Код"
          aria-label="Код шифра"
          className="min-w-0 flex-1 rounded-lg border border-don-blood/50 bg-black/40 px-3 py-2 text-sm tracking-[0.2em] text-neutral-100 uppercase placeholder:tracking-normal placeholder:text-neutral-600"
        />
        <button
          type="submit"
          disabled={api.sending || !code.trim()}
          className="shrink-0 rounded-lg bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
        >
          {api.sending ? '…' : 'Ввести'}
        </button>
      </form>

      {api.error && (
        <p className="mt-2 text-xs tracking-wider text-don-blood-light">{api.error}</p>
      )}
    </div>
  );
}
