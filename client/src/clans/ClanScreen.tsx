import { useState } from 'react';
import type { ClansApi } from './useClans';

interface ClanScreenProps {
  clans: ClansApi;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

const memberName = (member: { firstName: string | null; username: string | null }) =>
  member.firstName ?? (member.username ? `@${member.username}` : 'Аноним');

export function ClanScreen({ clans }: ClanScreenProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const { data, loading, busy, error } = clans;

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm tracking-wider text-neutral-500">
          {loading ? 'Загружаем…' : error ?? 'Нет данных'}
        </p>
      </div>
    );
  }

  const my = data.myClan;

  return (
    <div className="flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto py-6">
      <header className="text-center">
        <h2 className="text-2xl font-black tracking-[0.2em] text-don-gold uppercase">
          Клан
        </h2>
        {!data.canJoin && !my && (
          <p className="mt-2 text-xs tracking-wider text-don-blood-light">
            Открывается с ранга «{data.requiredRank.title}» —{' '}
            {formatCoins(data.requiredRank.minBalance)} ДонКоинов
          </p>
        )}
      </header>

      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
      )}

      {my ? (
        <>
          <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 p-4 text-left">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="truncate text-lg font-bold text-don-gold-soft">{my.name}</h3>
              <span className="shrink-0 text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
                {my.memberCount} в семье
              </span>
            </div>

            <p className="mt-3 text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
              Общак
            </p>
            <p className="text-2xl font-bold text-don-gold tabular-nums">
              {formatCoins(my.treasury)}
            </p>

            <div className="mt-4 flex gap-2">
              <input
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                placeholder="Сумма взноса"
                className="min-w-0 flex-1 rounded-lg border border-don-blood/40 bg-black/50 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600"
              />
              <button
                type="button"
                disabled={busy || !amount || Number(amount) <= 0}
                onClick={() => {
                  clans.donate(Number(amount));
                  setAmount('');
                }}
                className="rounded-lg bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-40"
              >
                Внести
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={clans.leave}
              className="mt-3 w-full rounded-lg border border-neutral-700 px-4 py-2 text-xs tracking-wider text-neutral-400 disabled:opacity-40"
            >
              {my.isOwner ? 'Распустить клан' : 'Выйти из клана'}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {my.members.map((member, index) => (
              <div
                key={`${member.username ?? member.firstName ?? 'member'}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-don-blood/30 bg-don-ink/60 px-4 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-200">{memberName(member)}</p>
                  <p className="text-[10px] tracking-wider text-neutral-500 uppercase">
                    {member.rank}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-don-gold-soft tabular-nums">
                  {formatCoins(member.contributed)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {data.canJoin && (
            <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 p-4 text-left">
              <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
                Основать свой
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={name}
                  maxLength={24}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Название клана"
                  className="min-w-0 flex-1 rounded-lg border border-don-blood/40 bg-black/50 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600"
                />
                <button
                  type="button"
                  disabled={busy || name.trim().length < 3}
                  onClick={() => {
                    clans.create(name);
                    setName('');
                  }}
                  className="rounded-lg bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-40"
                >
                  Создать
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {data.clans.length === 0 ? (
              <p className="rounded-xl border border-dashed border-don-blood/40 px-4 py-6 text-center text-xs tracking-wider text-neutral-500">
                Кланов пока нет. Первый основатель войдёт в историю.
              </p>
            ) : (
              data.clans.map((clan) => (
                <div
                  key={clan.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-don-blood/30 bg-don-ink/60 px-4 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-200">{clan.name}</p>
                    <p className="text-[10px] tracking-wider text-neutral-500">
                      {clan.memberCount} в семье · общак {formatCoins(clan.treasury)}
                    </p>
                  </div>
                  {data.canJoin && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => clans.join(clan.id)}
                      className="shrink-0 rounded-lg border border-don-gold/40 px-3 py-1.5 text-xs text-don-gold disabled:opacity-40"
                    >
                      Вступить
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
