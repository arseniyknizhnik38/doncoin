/**
 * Общие состояния экранов: заглушка загрузки и ошибка с повтором.
 * Раньше каждый экран показывал голый текст «Загружаем…», а при сбое сети
 * игроку оставалось только перезапускать приложение.
 */

/** Мерцающие плашки вместо текста — экран не «прыгает» при появлении данных. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex w-full flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-xl border border-don-blood/20 bg-don-ink/50"
        />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-don-blood/50 bg-don-ink/70 px-4 py-6">
      <p className="text-center text-sm text-don-blood-light">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-don-gold/40 px-4 py-2 text-sm text-don-gold active:scale-95"
        >
          Повторить
        </button>
      )}
    </div>
  );
}
