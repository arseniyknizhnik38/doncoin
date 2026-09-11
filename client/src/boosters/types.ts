export interface BoosterView {
  id: string;
  title: string;
  description: string;
  /** Сколько зарядов осталось на сегодня. */
  left: number;
  perDay: number;
  /** Для «Разгона» — сколько секунд он ещё действует. */
  activeSeconds: number;
}
