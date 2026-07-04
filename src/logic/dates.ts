import type { DateString } from '@/types';

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDateString(date: Date): DateString {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(): DateString {
  return toDateString(new Date());
}

export function monthKey(date: DateString): string {
  return date.slice(0, 7);
}

export function yearKey(date: DateString): string {
  return date.slice(0, 4);
}

export function monthRange(key: string): { from: DateString; to: DateString } {
  const [y, m] = key.split('-').map(Number);
  if (y === undefined || m === undefined || m < 1 || m > 12) {
    throw new RangeError(`Некоректний ключ місяця: ${key}`);
  }
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

export function yearRange(key: string): { from: DateString; to: DateString } {
  const y = Number(key);
  if (!Number.isInteger(y) || y < 2000 || y > 2200) {
    throw new RangeError(`Некоректний ключ року: ${key}`);
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function currentMonthKey(): string {
  return monthKey(today());
}

export function currentYearKey(): string {
  return yearKey(today());
}

export function formatDateForDisplay(date: DateString): string {
  const [y, m, d] = date.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return date;
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}
