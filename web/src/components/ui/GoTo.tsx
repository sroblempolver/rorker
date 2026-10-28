"use client";
// Go to anything: one search box (Ctrl/⌘+K or /) that jumps to a job, a floor, a room, a pin, a person's
// tasks, a tab or an action. Screens add what they know with useGoTo; the box shows what was picked
// last at the top, so the usual places are one key and Enter away.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { recall, remember } from "@/lib/remember";
import { useEscape, useHotkeys } from "./hotkeys";

export interface GoItem {
  /** stable across visits (job:hadley, room:G-R04), so Recent can find it again */
  id: string;
  group: string;
  label: string;
  sub?: string;
  /** extra words it answers to (people tagged, the element ID) */
  keywords?: string;
  /** a shortcut shown on the right */
  keys?: string;
  run: () => void;
}

// what each screen has added, newest screen first (the job's rooms before the app's pages)
const sources = new Map<string, { at: number; items: GoItem[] }>();
let version = 0;
const subs = new Set<() => void>();
const changed = () => { version++; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Add these places and actions to the Go to box while the screen is open. */
export function useGoTo(key: string, items: GoItem[]) {
  const at = useRef(Date.now());
  useEffect(() => { sources.set(key, { at: at.current, items }); changed(); }, [key, items]);
  useEffect(() => () => { sources.delete(key); changed(); }, [key]);
}

export function openGoTo() { window.dispatchEvent(new Event("rorker-goto")); }

const RECENT = "goto.recent";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function search(all: GoItem[], q: string): GoItem[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return all;
  const scored: { it: GoItem; s: number }[] = [];
  for (const it of all) {
    const label = norm(it.label), hay = `${label} ${norm(it.sub ?? "")} ${norm(it.keywords ?? "")} ${norm(it.group)}`;
    if (!words.every((w) => hay.includes(w))) continue;
    // the name itself beats the small print; the start of a word beats the middle
    let s = 0;
    for (const w of words) s += label.startsWith(w) ? 4 : new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(label) ? 3 : label.includes(w) ? 2 : 1;
    scored.push({ it, s });
  }
  // best first, but each kind kept together (the group with the best hit leads)
  const sorted = scored.sort((a, b) => b.s - a.s).map((x) => x.it);
  const order = [...new Set(sorted.map((it) => it.group))];
  return order.flatMap((g) => sorted.filter((it) => it.group === g));
}

/** The box itself. Put it once near the top of the app. */
export function GoToHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("rorker-goto", on);
    return () => window.removeEventListener("rorker-goto", on);
  }, []);
  useHotkeys({ "/": () => setOpen(true) });
  // Ctrl+K also works from inside a text box (single keys like / never do)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, []);
  return open ? <GoToBox onClose={() => setOpen(false)} /> : null;
}

function GoToBox({ onClose }: { onClose: () => void }) {
  useSyncExternalStore(subscribe, () => version, () => version);
  const all = [...sources.values()].sort((a, b) => b.at - a.at).flatMap((s) => s.items);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => back?.focus?.();
  }, []);

  const shown = useMemo(() => {
    if (q.trim()) return search(all, q).slice(0, 40);
    // nothing typed: what was picked lately, then a few of each kind
    const byId = new Map(all.map((it) => [it.id, it]));
    const recent = (recall<string[]>(RECENT) ?? []).map((id) => byId.get(id)).filter(Boolean).map((it) => ({ ...it!, group: "Recent" }));
    const seen = new Set(recent.map((r) => r.id));
    const per = new Map<string, number>();
    const rest = all.filter((it) => { if (seen.has(it.id)) return false; const n = per.get(it.group) ?? 0; per.set(it.group, n + 1); return n < 5; });
    return [...recent.slice(0, 5), ...rest];
  }, [q, all]);
  useEffect(() => setAt(0), [q]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" }); }, [at]);

  const pick = (it: GoItem) => {
    remember(RECENT, [it.id, ...(recall<string[]>(RECENT) ?? []).filter((x) => x !== it.id)].slice(0, 8));
    onClose();
    // after the box has gone, so whatever opens gets the focus
    setTimeout(it.run, 0);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && shown[at]) { e.preventDefault(); pick(shown[at]); }
    else if (e.key === "Tab") e.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/55 flex justify-center items-start p-3 pt-[12vh] fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Go to" onKeyDown={onKey}
        className="w-full max-w-[600px] bg-panel border border-line border-t-[3px] border-t-accent rounded-[6px] shadow-2xl overflow-hidden pop-in">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-muted shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to a job, room, pin or person…" aria-label="Go to"
            role="combobox" aria-expanded aria-controls="goto-list" aria-activedescendant={shown[at] ? `goto-${at}` : undefined}
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] placeholder:text-muted" />
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="w-8 h-8 -mr-2 grid place-items-center text-muted hover:text-text shrink-0">✕</button>
        </div>
        <div ref={list} id="goto-list" role="listbox" className="max-h-[min(60vh,460px)] overflow-y-auto scroll-thin py-1.5">
          {!shown.length && <p className="px-4 py-6 text-center text-muted">Nothing called “{q}”. Try a room, a pin number or a name.</p>}
          {shown.map((it, i) => (
            <div key={`${it.group}-${it.id}`}>
              {(i === 0 || shown[i - 1].group !== it.group) && <p className="eyebrow !text-[11.5px] px-4 pt-2.5 pb-1">{it.group}</p>}
              <button id={`goto-${i}`} data-i={i} role="option" aria-selected={i === at} onMouseMove={() => setAt(i)} onClick={() => pick(it)}
                className={`w-full flex items-center gap-3 px-4 h-11 text-left border-l-[3px] ${i === at ? "bg-panel-2 border-l-accent" : "border-l-transparent"}`}>
                <span className="flex-1 min-w-0 flex items-baseline gap-2">
                  <span className="truncate text-[14.5px]">{it.label}</span>
                  {it.sub && <span className="truncate text-[12.5px] text-muted">{it.sub}</span>}
                </span>
                {it.keys && <kbd className="kbd !h-5 !text-[10.5px] shrink-0">{it.keys}</kbd>}
                {i === at && <span className="text-[12px] text-muted shrink-0 hidden sm:inline">Enter</span>}
              </button>
            </div>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-4 px-4 h-9 border-t border-line text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><kbd className="kbd !h-5 !min-w-5 !text-[10.5px]">↑</kbd><kbd className="kbd !h-5 !min-w-5 !text-[10.5px]">↓</kbd> move</span>
          <span className="inline-flex items-center gap-1.5"><kbd className="kbd !h-5 !text-[10.5px]">Enter</kbd> open</span>
          <span className="inline-flex items-center gap-1.5"><kbd className="kbd !h-5 !text-[10.5px]">Esc</kbd> close</span>
        </div>
      </section>
    </div>
  );
}

/** The search button for a top bar: opens the Go to box and shows its shortcut. */
export function GoToButton({ className = "" }: { className?: string }) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iP(hone|ad)/.test(navigator.platform)), []);
  return (
    <button onClick={openGoTo} title={`Go to anything (${mac ? "⌘" : "Ctrl"}+K)`} aria-label="Go to anything"
      className={`h-9 inline-flex items-center gap-2 px-2.5 rounded-[3px] border border-line bg-ink/40 text-muted hover:text-text hover:border-[#4a4b50] ${className}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span className="hidden lg:inline text-[13px] pr-6">Go to…</span>
      <kbd className="kbd !h-5 !text-[10.5px] hidden lg:inline-grid">{mac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}
