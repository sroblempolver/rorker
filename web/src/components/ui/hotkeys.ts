"use client";
// Keyboard basics. Esc always means "back one step": whatever is on top (a dialog, a card, a selection)
// closes first, one press at a time, like backing out of a game menu. Single-key shortcuts never fire
// while you're typing.
import { useEffect, useRef } from "react";

/** the open Esc handlers, newest last; only the top one runs */
const stack: { current: () => void }[] = [];
let listening = false;

function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented || !stack.length) return;
  // in a text box, the first Esc just leaves the box (a card's own Esc still closes it)
  const t = e.target as HTMLElement | null;
  if (t && editable(t) && !t.closest("[role=dialog]")) { t.blur(); return; }
  e.preventDefault();
  stack[stack.length - 1].current();
}

/** Run `fn` on Esc while `on`, unless something opened later is on top of it. */
export function useEscape(fn: () => void, on = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!on) return;
    const entry = { current: () => ref.current() };
    stack.push(entry);
    if (!listening) { window.addEventListener("keydown", onKey); listening = true; }
    return () => { const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1); };
  }, [on]);
}

export function editable(el: Element) {
  const h = el as HTMLElement;
  return h.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName);
}

/**
 * Shortcuts by key: "p", "1", "?", "Mod+z", "Mod+Shift+z" (Mod is Ctrl, or ⌘ on a Mac). Ignored while
 * typing, and while a dialog is open over the screen.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, on = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!on) return;
    const k = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.key === "Escape") return;
      const t = e.target as Element | null;
      if (t && editable(t)) return;
      if (document.querySelector("[aria-modal=true]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const name = `${mod ? "Mod+" : ""}${mod && e.shiftKey ? "Shift+" : ""}${e.key.length === 1 ? e.key.toLowerCase() : e.key}`;
      const fn = ref.current[name] ?? (e.key === "?" ? ref.current["?"] : undefined);
      if (!fn) return;
      e.preventDefault();
      fn(e);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [on]);
}
