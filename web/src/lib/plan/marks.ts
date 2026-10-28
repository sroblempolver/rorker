// Blinking dots the assistant puts on the plan when it talks about a place ("the south bedroom or the
// east one?"), so you can see which is which. Every plan view draws the current ones; they fade out
// after a while or when the assistant points somewhere else.
import { useSyncExternalStore } from "react";
import type { Mark } from "./pointing";

export { MARK_COLORS, type Mark } from "./pointing";
export interface Marks { marks: Mark[]; /** select this one (open it in the side panel) */ focus: string | null; n: number; /** when they went up, ms */ at: number }


/** They blink for 10 seconds, fading out over the last 1.5, and come back each time the assistant points again. */
export const MARK_LIFE = 10_000;
export const MARK_FADE = 1_500;
let state: Marks = { marks: [], focus: null, n: 0, at: 0 };
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
const emit = () => subs.forEach((f) => f());

export function showMarks(marks: Mark[], focus: string | null = null) {
  if (!marks.length && !focus) return;
  state = { marks, focus, n: state.n + 1, at: Date.now() };
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(clearMarks, MARK_LIFE);
}
export function clearMarks() {
  if (!state.marks.length) return;
  state = { marks: [], focus: null, n: state.n + 1, at: 0 };
  emit();
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const EMPTY: Marks = { marks: [], focus: null, n: 0, at: 0 };
export const getMarks = () => state;
export function useMarks(): Marks {
  return useSyncExternalStore(subscribe, getMarks, () => EMPTY);
}
/** How visible they are now: 1, then down to 0 over the last MARK_FADE ms. */
export const markFade = (now = Date.now()) => Math.max(0, Math.min(1, (state.at + MARK_LIFE - now) / MARK_FADE));
