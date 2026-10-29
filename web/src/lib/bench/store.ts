// The test plans, kept in this browser (IndexedDB): each one is what an upload sends to the plan reader,
// the right answer for it, and every reading so far with its score. Shared test plans (the ones in the
// repo) load from the site and are copied here once you change them. A file export moves them around.
import type { IntakePart } from "@/lib/intake/files";
import type { Sketch } from "@/lib/plan/sketch";
import type { Backdrop } from "@/components/newjob/SketchEditor";

export interface BenchRun {
  at: string; reader: string; seconds: number; sketch: Sketch | null; summary: string; score: number | null;
  /** what went wrong, from the scorer, so a run can be read later without the answer */
  misses?: string[]; error?: string;
}
export interface BenchCase {
  id: string; name: string; created: string; parts: IntakePart[];
  /** what the contractor would say with the upload (often nothing) */
  description?: string;
  answer?: Sketch | null; backdrops?: Record<number, Backdrop>; answerNote?: string;
  runs: BenchRun[];
  /** came from the shared set on the site */
  shared?: boolean;
}

const DB = "rorker-bench", STORE = "cases";
function open(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((ok, fail) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

export const listCases = () => tx<BenchCase[]>("readonly", (s) => s.getAll() as IDBRequest<BenchCase[]>).catch(() => [] as BenchCase[]);
export const saveCase = (c: BenchCase) => tx("readwrite", (s) => s.put(c));
export const deleteCase = (id: string) => tx("readwrite", (s) => s.delete(id));

/** The shared test plans published beside the page: cases/index.json lists folders, each with a case.json. */
export async function sharedCases(base = "cases/"): Promise<BenchCase[]> {
  try {
    const list: string[] = await fetch(`${base}index.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : []));
    const got = await Promise.all(list.map((id) => fetch(`${base}${id}/case.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    return got.filter(Boolean).map((c) => ({ runs: [], ...c, shared: true }));
  } catch { return []; }
}

export function downloadCases(cases: BenchCase[], name: string) {
  const blob = new Blob([JSON.stringify({ rorker_bench: 1, cases }, null, 0)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function readCaseFile(f: File): Promise<BenchCase[]> {
  const j = JSON.parse(await f.text());
  const list: BenchCase[] = Array.isArray(j?.cases) ? j.cases : j?.id && j?.parts ? [j] : [];
  return list.filter((c) => c.id && Array.isArray(c.parts)).map((c) => ({ ...c, runs: c.runs ?? [], shared: false }));
}
