/** Today's date where the user is, as YYYY-MM-DD (what a date input holds). */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A YYYY-MM-DD date moved by `n` days (negative goes back). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return today(d);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD): 1 is tomorrow, -1 yesterday. */
export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);
}
