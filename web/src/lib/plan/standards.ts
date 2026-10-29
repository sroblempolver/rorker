// The contractor's own standards. Every default size the drawing tool uses (a door's width, a base
// cabinet's height) and every limit a check warns at (stair headroom, a step's height) is defined here
// once with the usual US value, and the company can change any of them in Standards. Lengths are
// stored in mm like the plan; `unit` only says how the value is shown and typed.
// Saved in the browser for now (the preview); a company row in Supabase later.
import { useSyncExternalStore } from "react";

export type StdUnit = "len" | "deg" | "count" | "sqft" | "pct";
export interface StdDef {
  key: string; group: string; label: string; value: number; unit: StdUnit;
  /** one plain sentence on where the number comes from, shown under it */
  help?: string;
}

const defs = new Map<string, StdDef>();
const STORE = "rorker.standards";
let overrides: Record<string, number> = (() => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "{}") ?? {}; } catch { return {}; }
})();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; for (const l of listeners) l(); };

/** Register standards (call once at module load). A key defined twice keeps the first. */
export function defineStandards(list: StdDef[]) {
  for (const d of list) if (!defs.has(d.key)) defs.set(d.key, d);
  emit();
}

/** The company's value for a standard, or its usual value. */
export function std(key: string): number {
  const o = overrides[key];
  if (typeof o === "number" && Number.isFinite(o)) return o;
  const d = defs.get(key);
  if (!d) throw new Error(`No standard called ${key}`);
  return d.value;
}

/** Change a standard for the company; null puts it back to the usual value. */
export function setStd(key: string, v: number | null) {
  const next = { ...overrides };
  if (v == null || v === defs.get(key)?.value) delete next[key]; else next[key] = v;
  overrides = next;
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* private window: keep it for this visit */ }
  emit();
}

export const isChanged = (key: string) => key in overrides;
export const allStandards = () => [...defs.values()];

/** Re-render when any standard changes. Returns a number that changes with them (for memo keys). */
export function useStandards(): number {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version, () => version);
}
