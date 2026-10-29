"use client";
// "Go to Level 2": the buttons that take the map to the assistant's dots when they're out of view.
// Under the assistant's answer, and on the map itself.
import { useAway, type AwayTarget } from "@/lib/plan/away";

const goLabel = (t: AwayTarget) => (t.go.kind === "exterior" ? (t.needs3d ? "Show the outside in 3D" : "Show the outside") : `Go to ${t.name}`);

export function AwayButtons({ className = "" }: { className?: string }) {
  const away = useAway();
  if (!away.targets.length) return null;
  return (
    <span className={`flex flex-wrap gap-1.5 ${className}`}>
      {away.targets.slice(0, 3).map((t) => (
        <button key={t.key} type="button" onClick={() => away.go(t)}
          className="h-8 px-3 rounded-[4px] bg-accent text-accent-ink text-[13px] font-semibold inline-flex items-center gap-1.5 hover:brightness-110">
          {t.marks.slice(0, 3).map((m, i) => <span key={i} className="w-2 h-2 rounded-full ring-1 ring-black/30" style={{ background: m.color }} />)}
          {goLabel(t)}
        </button>
      ))}
    </span>
  );
}

/** The same, as a note on the map: what's out of view and the way there. */
export function AwayChip({ glass, onClose }: { glass: string; onClose: () => void }) {
  const away = useAway();
  if (!away.targets.length) return null;
  return (
    <div role="status" className={`absolute left-1/2 -translate-x-1/2 top-24 z-10 w-max max-w-[calc(100%-24px)] px-3 py-2 rounded-[4px] ${glass} border-l-[3px] !border-l-accent flex flex-wrap items-center gap-x-3 gap-y-1.5`}>
      <span className="text-[13px] leading-snug">{away.say}</span>
      <AwayButtons />
      <button type="button" onClick={onClose} aria-label="Dismiss" className="w-6 h-6 grid place-items-center text-muted hover:text-text text-[13px]">✕</button>
    </div>
  );
}
