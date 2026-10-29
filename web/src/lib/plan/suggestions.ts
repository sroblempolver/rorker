// Where a client's suggestions to a drawing are kept until the contractor answers them. One record per
// round: who sent it and when, their note, the plan they started from, their version, the changes, and
// the contractor's answer to each. Saved in the browser for now (the preview); shaped like a row of a
// `plan_suggestions` table in Supabase later (job_id, from, status, note, changes, answers, reply).
import { useSyncExternalStore } from "react";
import type { Sketch } from "./sketch";
import type { Change } from "./suggest";

export type SuggestionStatus = "draft" | "sent" | "answered";
export type Answer = "approved" | "declined";
export interface Suggestion {
  id: string;
  /** the drawing it's for (the job, later); the preview has one drawing */
  drawing: string;
  from: { role: "client"; name: string | null };
  status: SuggestionStatus;
  created_at: string; sent_at: string | null; answered_at: string | null;
  note: string | null;
  /** the plan as the client found it, and their version */
  base: Sketch; proposed: Sketch;
  changes: Change[];
  /** the contractor's answer to each change, by change id */
  answers: Record<string, Answer>;
  reply: string | null;
}

const STORE = "rorker.suggestions";
const listeners = new Set<() => void>();
let cache: Suggestion[] | null = null;
const read = (): Suggestion[] => {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(STORE) ?? "[]") ?? []; } catch { cache = []; }
  return cache!;
};
const write = (list: Suggestion[]) => {
  cache = list;
  try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* private window: keep it for this visit */ }
  for (const l of listeners) l();
};

export const suggestionsFor = (drawing: string) => read().filter((s) => s.drawing === drawing);
/** The client's round being written, or the last one sent and not yet answered. */
export const openSuggestion = (drawing: string, status: SuggestionStatus) => suggestionsFor(drawing).filter((s) => s.status === status).at(-1) ?? null;

export function saveSuggestion(s: Suggestion) {
  const list = read();
  write(list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s]);
}
export const dropSuggestion = (id: string) => write(read().filter((s) => s.id !== id));

export function newSuggestion(drawing: string, base: Sketch, proposed: Sketch, changes: Change[]): Suggestion {
  return {
    id: `sg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, drawing, from: { role: "client", name: null }, status: "draft",
    created_at: new Date().toISOString(), sent_at: null, answered_at: null, note: null, base, proposed, changes, answers: {}, reply: null,
  };
}

/** Re-render when suggestions change (in this tab). */
export function useSuggestions(drawing: string): Suggestion[] {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => cache ?? read(), () => cache ?? read());
  return suggestionsFor(drawing);
}
