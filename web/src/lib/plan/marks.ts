// Blinking dots the assistant puts on the plan when it talks about a place ("the south bedroom or the
// east one?"), so you can see which is which. Every plan view draws the current ones; they fade out
// after a while or when the assistant points somewhere else.
import { useSyncExternalStore } from "react";
import type { Mark } from "./pointing";

export { MARK_COLORS, type Mark } from "./pointing";
export interface Marks { marks: Mark[]; /** select this one (open it in the side panel) */ focus: string | null; n: number }


const LIFE = 45_000;
let state: Marks = { marks: [], focus: null, n: 0 };
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
const emit = () => subs.forEach((f) => f());

export function showMarks(marks: Mark[], focus: string | null = null) {
  if (!marks.length && !focus) return;
  state = { marks, focus, n: state.n + 1 };
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(clearMarks, LIFE);
}
export function clearMarks() {
  if (!state.marks.length) return;
  state = { marks: [], focus: null, n: state.n + 1 };
  emit();
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const EMPTY: Marks = { marks: [], focus: null, n: 0 };
export const getMarks = () => state;
export function useMarks(): Marks {
  return useSyncExternalStore(subscribe, getMarks, () => EMPTY);
}
