// Small per-device memory (last tab, last floor, 2D or 3D) so a screen opens where you left it.
// Storage can be off or full (private windows, the preview frame): then it just forgets.
export function recall<T>(key: string): T | null {
  try { const v = localStorage.getItem(`rorker.${key}`); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}

export function remember(key: string, value: unknown) {
  try { localStorage.setItem(`rorker.${key}`, JSON.stringify(value)); } catch { /* storage off */ }
}
