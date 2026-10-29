"use client";
// Checks: the real rules the drawing doesn't meet yet, in plain words. Nothing here blocks anything:
// each one can be ignored right where it is, and its limit opens in Standards to be changed.
import { useState } from "react";
import type { Nudge } from "@/lib/plan/checks";
import type { Sketch } from "@/lib/plan/sketch";

export const NUDGE_COLOR = { warn: "#ffb020", info: "#55b2ff" } as const;

export function ChecksPanel({ sk, open, ignored, active, onPick, onIgnore, onUnignore, onStd, onClose }: {
  sk: Sketch; open: Nudge[]; ignored: Nudge[]; active: string | null;
  onPick: (n: Nudge) => void; onIgnore: (n: Nudge) => void; onUnignore: (n: Nudge) => void; onStd: (key: string) => void; onClose: () => void;
}) {
  const [showIgnored, setShowIgnored] = useState(false);
  const floors = [...new Set(open.map((n) => n.floor))].sort((a, b) => a - b);
  const warn = open.filter((n) => n.severity === "warn").length;
  const item = (n: Nudge, isIgnored = false) => (
    <li key={n.id} className={`rounded-md border p-2 ${active === n.id ? "border-accent" : "border-line"}`}>
      <button className="flex w-full items-start gap-2 text-left" onClick={() => onPick(n)}>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: NUDGE_COLOR[n.severity] }} aria-label={n.severity === "warn" ? "Worth fixing" : "Good to know"} />
        <span className="min-w-0">
          <span className="block font-semibold leading-snug">{n.title}</span>
          <span className="block text-muted leading-snug">{n.text}</span>
        </span>
      </button>
      <div className="mt-1.5 flex gap-3 pl-[18px] text-[12px]">
        {isIgnored ? <button className="underline text-muted" onClick={() => onUnignore(n)}>Check it again</button>
          : <button className="underline text-muted" onClick={() => onIgnore(n)}>Ignore here</button>}
        {n.std && <button className="underline text-muted" onClick={() => onStd(n.std!)}>The rule</button>}
      </div>
    </li>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="eyebrow">Checks</p>
        <button className="btn btn-sm btn-ghost ml-auto" onClick={onClose}>Done</button>
      </div>
      <p className="text-muted leading-snug">
        {open.length ? `${open.length} to look at${warn && warn < open.length ? `, ${warn} worth fixing` : ""}. ` : "Nothing to look at. "}
        Building code and good practice, checked as you draw. Ignore any that don&apos;t apply, or change the limit in Standards.
      </p>
      {floors.map((fi) => (
        <div key={fi} className="space-y-1.5">
          {sk.floors.length > 1 && <p className="label !mb-0">{sk.floors[fi]?.name || `Level ${sk.floors[fi]?.level}`}</p>}
          <ul className="space-y-1.5">{open.filter((n) => n.floor === fi).map((n) => item(n))}</ul>
        </div>
      ))}
      {ignored.length > 0 && (
        <div className="space-y-1.5 border-t border-line pt-2">
          <button className="text-[12px] text-muted underline" onClick={() => setShowIgnored((x) => !x)}>{showIgnored ? "Hide" : "Show"} ignored ({ignored.length})</button>
          {showIgnored && <ul className="space-y-1.5 opacity-75">{ignored.map((n) => item(n, true))}</ul>}
        </div>
      )}
      <p className="text-[12px] text-muted leading-snug">Not checked (the drawing can&apos;t tell): handrail details, window types, smoke alarms, fire walls to a garage, electrical clearances, and whether a wall really carries weight.</p>
    </div>
  );
}
