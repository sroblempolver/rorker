"use client";
// The basics every screen leans on, the way good apps and games do them: one place for toasts (with an
// Undo right on them), a confirm that looks like the app instead of the browser's grey box, a dialog
// shell that always has an X, closes on Esc or a click outside and gives focus back, and the
// keyboard shortcuts sheet behind "?".
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useEscape } from "./hotkeys";

export interface ToastAction { label: string; run: () => void }
export interface ToastOptions { action?: ToastAction; tone?: "info" | "error"; ms?: number }
export interface ConfirmOptions { title: string; body?: ReactNode; confirm?: string; cancel?: string; danger?: boolean }

interface Feedback {
  toast: (message: string, opts?: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

// without a provider (a bare page) it still works: plain browser confirm, toasts go nowhere
const Fallback: Feedback = {
  toast: () => {},
  confirm: async (o) => (typeof window === "undefined" ? false : window.confirm([o.title, typeof o.body === "string" ? o.body : ""].filter(Boolean).join("\n\n"))),
};
const Ctx = createContext<Feedback>(Fallback);
export const useFeedback = () => useContext(Ctx);

interface Toast extends ToastOptions { id: number; message: string }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<(ConfirmOptions & { done: (ok: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const drop = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback((message: string, opts: ToastOptions = {}) => {
    const id = ++seq.current;
    // the newest three; one with an Undo stays long enough to reach it
    setToasts((l) => [...l.filter((t) => t.message !== message), { id, message, ...opts }].slice(-3));
    setTimeout(() => drop(id), opts.ms ?? (opts.action ? 6000 : opts.tone === "error" ? 5000 : 3200));
  }, [drop]);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((done) => setAsk({ ...o, done })), []);
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const answer = (ok: boolean) => { ask?.done(ok); setAsk(null); };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed z-[70] left-1/2 -translate-x-1/2 top-16 flex flex-col items-center gap-2 pointer-events-none w-[min(440px,calc(100vw-24px))]" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-in pointer-events-auto w-full flex items-center gap-3 pl-4 pr-1.5 min-h-10 py-1.5 rounded-[3px] bg-panel-2 border border-line border-l-[3px] shadow-lg text-[14px] ${t.tone === "error" ? "border-l-red" : "border-l-accent"}`}>
            <span className="flex-1 min-w-0">{t.message}</span>
            {t.action && <button className="btn btn-sm btn-ghost !text-accent" onClick={() => { t.action!.run(); drop(t.id); }}>{t.action.label}</button>}
            <button onClick={() => drop(t.id)} aria-label="Dismiss" title="Dismiss" className="w-7 h-7 grid place-items-center text-muted hover:text-text shrink-0">✕</button>
          </div>
        ))}
      </div>
      {ask && (
        <Dialog title={ask.title} onClose={() => answer(false)} narrow>
          {ask.body && <div className="text-muted text-[14.5px] leading-relaxed">{ask.body}</div>}
          <div className="flex gap-2 justify-end mt-5">
            {/* on anything that can't be taken back, Enter lands on the safe choice */}
            <button className="btn btn-ghost" onClick={() => answer(false)} data-autofocus={ask.danger || undefined}>{ask.cancel ?? "Cancel"}</button>
            <button className={`btn ${ask.danger ? "!bg-red !border-red !text-white" : "btn-primary"}`} onClick={() => answer(true)} data-autofocus={!ask.danger || undefined}>{ask.confirm ?? "OK"}</button>
          </div>
        </Dialog>
      )}
    </Ctx.Provider>
  );
}

/** A modal: X top right, Esc and a click outside close it, focus goes in and comes back after. */
export function Dialog({ title, onClose, children, narrow }: { title: string; onClose: () => void; children: ReactNode; narrow?: boolean }) {
  const box = useRef<HTMLElement>(null);
  useEscape(onClose);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>("button, input, select, textarea, a[href]");
    first?.focus();
    return () => back?.focus?.();
  }, []);
  // keep Tab inside the dialog
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const f = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, select, textarea, a[href]")];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={box} role="dialog" aria-modal="true" aria-label={title} onKeyDown={trap}
        className={`w-full ${narrow ? "max-w-[420px]" : "max-w-[560px]"} max-h-[calc(100vh-24px)] overflow-y-auto scroll-thin bg-panel border border-line border-t-[3px] border-t-accent rounded-[6px] shadow-2xl p-5`}>
        <div className="flex items-start gap-3 mb-3">
          <h2 className="font-display text-[22px] font-extrabold uppercase tracking-[0.02em] leading-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" className="ml-auto -mr-2 -mt-1 w-8 h-8 grid place-items-center text-muted hover:text-text shrink-0">✕</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export interface Shortcut { keys: string[]; does: string }

/** The "?" sheet: every shortcut on this screen. */
export function ShortcutsDialog({ groups, onClose }: { groups: { title: string; items: Shortcut[] }[]; onClose: () => void }) {
  const mac = typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);
  const key = (k: string) => (k === "Mod" ? (mac ? "⌘" : "Ctrl") : k);
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="eyebrow mb-2">{g.title}</p>
            <ul className="space-y-1.5">
              {g.items.map((s) => (
                <li key={s.does} className="flex items-center gap-3 text-[14px]">
                  <span className="flex-1 text-muted">{s.does}</span>
                  <span className="flex gap-1 shrink-0">{s.keys.map((k) => <kbd key={k} className="kbd">{key(k)}</kbd>)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
