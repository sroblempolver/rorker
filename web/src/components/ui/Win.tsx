"use client";
// The moment something gets finished: a short banner over the map, like a game marking an objective done.
// A check draws itself, the progress bar fills from where it was to where it is now, then it gets out of
// the way. No sound, nothing to click; a stage or the whole job gets the bigger version.
import { useEffect } from "react";

export interface WinInfo {
  kind: "task" | "item" | "stage" | "job";
  /** "Task done", "Kitchen done", "Stage complete" */
  head: string;
  title: string;
  sub?: string;
  done: number;
  total: number;
  /** what the count is of: "closed", "stages" */
  unit: string;
  /** a new one each time, so the same win twice still plays */
  n: number;
}

const COLOR = { task: "var(--green)", item: "var(--green)", stage: "var(--accent)", job: "var(--accent)" } as const;

export function WinBanner({ win, onDone }: { win: WinInfo; onDone: () => void }) {
  const big = win.kind === "stage" || win.kind === "job";
  useEffect(() => {
    const t = setTimeout(onDone, big ? 3600 : 2600);
    return () => clearTimeout(t);
  }, [win.n, big, onDone]);
  const total = Math.max(1, win.total);
  const from = Math.max(0, win.done - 1) / total, to = Math.min(1, win.done / total);
  const c = COLOR[win.kind];
  return (
    <div key={win.n} role="status" aria-live="polite"
      style={{ ["--win-life" as string]: big ? "3.6s" : "2.6s" }} className={`win-in pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 ${big ? "top-[22%] w-[min(460px,calc(100%-24px))]" : "top-24 w-[min(360px,calc(100%-24px))]"}`}>
      <div className="relative overflow-hidden bg-[#17181b]/95 backdrop-blur-sm border border-line rounded-[4px] shadow-2xl" style={{ borderLeft: `4px solid ${c}` }}>
        <div className="win-sweep absolute inset-0" style={{ background: `linear-gradient(100deg, transparent 30%, ${c} 50%, transparent 70%)` }} aria-hidden />
        <div className={`relative flex items-center gap-3 ${big ? "px-5 py-4" : "px-4 py-3"}`}>
          <svg width={big ? 40 : 30} height={big ? 40 : 30} viewBox="0 0 32 32" className="shrink-0" aria-hidden>
            <rect x="1.5" y="1.5" width="29" height="29" rx="3" fill="none" stroke={c} strokeWidth="2.5" />
            <path className="win-check" d="M8.5 16.5l5 5 10-11" fill="none" stroke={c} strokeWidth="3.2" strokeLinecap="square" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold uppercase tracking-[0.12em] leading-none" style={{ color: c, fontSize: big ? 15 : 12.5 }}>{win.head}</p>
            <p className={`truncate ${big ? "font-display font-extrabold uppercase text-[24px] leading-tight mt-1" : "text-[14.5px] mt-1"}`}>{win.title}</p>
            {win.sub && <p className="text-[12px] text-muted truncate">{win.sub}</p>}
          </div>
        </div>
        <div className="relative px-4 pb-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-panel-3 rounded-[1px] overflow-hidden">
            <div className="h-full win-fill origin-left" style={{ background: c, width: `${to * 100}%`, ["--from" as string]: String(to ? from / to : 0) }} />
          </div>
          <span className="font-mono text-[12px] shrink-0"><span style={{ color: c }}>{win.done}</span><span className="text-muted">/{win.total} {win.unit}</span></span>
        </div>
      </div>
    </div>
  );
}
