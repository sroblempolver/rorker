"use client";
// The side panel for one wall piece (lib/plan/walls.ts): its length typed in feet and inches, growing
// from the end you pick or from both, its thickness (inside or outside wall, or your own), its height and
// whether it is a half wall. Sizes start at the company's standards.
import { useState } from "react";
import type { SketchFloor, SketchWall } from "@/lib/plan/sketch";
import { isOutside, setLength, wallHeight, wallLen, wallThickness } from "@/lib/plan/walls";
import { std } from "@/lib/plan/standards";
import { fmtLen, parseLength, roundLen, type Units } from "@/lib/plan/units";

/** What to call each end of a wall: west and east for one that runs across, north and south otherwise. */
export function endNames(w: SketchWall): [string, string] {
  const across = Math.abs(w.b[0] - w.a[0]) >= Math.abs(w.b[1] - w.a[1]);
  const aFirst = across ? w.a[0] <= w.b[0] : w.a[1] <= w.b[1];
  const [lo, hi] = across ? ["West end", "East end"] : ["North end", "South end"];
  return aFirst ? [lo, hi] : [hi, lo];
}

export function WallPanel({ floor, i, units, ceiling, onChange, onJoin, onCopy, onDelete }: {
  floor: SketchFloor; i: number; units: Units; ceiling: number;
  /** the walls with this one changed (one undo step each) */
  onChange: (walls: SketchWall[]) => void;
  /** the room this wall closes, to make it whole again; null when it closes none */
  onJoin: (() => void) | null; onCopy: () => void; onDelete: () => void;
}) {
  const walls = floor.walls ?? [], w = walls[i];
  // which end grows when a length is typed: 0 keeps a, 1 keeps b
  const [keep, setKeep] = useState<0 | 1 | "mid">(0);
  if (!w) return null;
  const out = isOutside(floor.rooms, w), t = wallThickness(w, out), h = wallHeight(w, ceiling);
  const ends = endNames(w);
  const set = (patch: Partial<SketchWall>) => onChange(walls.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const typedLen = (s: string) => { const v = parseLength(s, units); if (v && v >= 100) onChange(setLength(walls, i, roundLen(v, units), keep)); };
  const inside = std("wall.interior"), outside = std("wall.exterior");
  return (
    <div className="space-y-2">
      <p className="eyebrow">Wall</p>
      <div>
        <label className="label !mb-1" htmlFor="wlen">Length</label>
        <input id="wlen" key={`len-${i}-${Math.round(wallLen(w))}`} className="input !h-9 font-mono" defaultValue={fmtLen(wallLen(w), units)}
          onBlur={(e) => typedLen(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <span className="text-muted mr-0.5">Grows from</span>
          {([[1, ends[0]], ["mid", "Both ends"], [0, ends[1]]] as const).map(([k, l]) => (
            <button key={String(k)} onClick={() => setKeep(k)} aria-pressed={keep === k} className={`chip !h-7 ${keep === k ? "!text-accent !border-accent" : ""}`}>{l === "Both ends" ? "Both" : l.replace(" end", "")}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="label !mb-1">Thickness</p>
        <div className="flex flex-wrap items-center gap-1">
          <button onClick={() => set({ thickness_mm: inside })} className={`chip !h-7 ${Math.abs(t - inside) < 1 ? "!text-accent !border-accent" : ""}`}>Inside {fmtLen(inside, units).replace(/^0' /, "")}</button>
          <button onClick={() => set({ thickness_mm: outside })} className={`chip !h-7 ${Math.abs(t - outside) < 1 ? "!text-accent !border-accent" : ""}`}>Outside {fmtLen(outside, units).replace(/^0' /, "")}</button>
          <input key={`t-${i}-${t}`} className={`input !h-8 !w-20 font-mono ${w.thickness_mm != null ? "!border-accent" : ""}`} defaultValue={fmtLen(t, units).replace(/^0' /, "")} aria-label="Wall thickness"
            onBlur={(e) => { const v = parseLength(e.target.value.includes("'") || /[a-z"]/i.test(e.target.value) ? e.target.value : `${e.target.value}"`, units); if (v && v >= 25 && v <= 1000) set({ thickness_mm: roundLen(v, units) }); else e.target.value = fmtLen(t, units).replace(/^0' /, ""); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-muted" htmlFor="wh">Height</label>
        <input id="wh" key={`h-${i}-${h}`} className={`input !h-9 !w-24 font-mono ${w.height_mm != null ? "!border-accent" : ""}`} defaultValue={fmtLen(h, units)}
          onBlur={(e) => { const v = parseLength(e.target.value, units); if (v && v >= 150 && v <= 9000) set({ height_mm: roundLen(v, units), half: undefined }); else e.target.value = fmtLen(h, units); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        {w.height_mm != null && <button className="text-[12px] text-muted underline" onClick={() => set({ height_mm: undefined })}>To the ceiling</button>}
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!w.half} onChange={(e) => set({ half: e.target.checked || undefined, height_mm: undefined })} />
        <span>Half wall <span className="text-muted">({fmtLen(std("wall.halfHeight"), units)} high)</span></span>
      </label>
      {(w.doors?.length || w.windows?.length) ? (
        <div>
          <p className="label !mb-1">In this wall</p>
          {[...(w.doors ?? []).map((d, k) => ({ k, door: true, at: d.at, name: d.kind && d.kind !== "door" ? d.kind.replace(/_/g, " ") : "door" })),
            ...(w.windows ?? []).map((d, k) => ({ k, door: false, at: d.at, name: "window" }))].map((o) => (
            <div key={`${o.door}-${o.k}`} className="flex items-center gap-2 text-[13px]">
              <span className="flex-1 capitalize">{o.name} <span className="text-muted normal-case">{fmtLen(wallLen(w) * o.at, units)} from the {ends[0].toLowerCase()}</span></span>
              <button className="text-[12px] text-muted underline" onClick={() => set(o.door ? { doors: w.doors!.filter((_, j) => j !== o.k) } : { windows: w.windows!.filter((_, j) => j !== o.k) })}>Take out</button>
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-muted leading-snug">Drag the wall to move it, or an end to make it longer or shorter. Ends snap onto other walls. Alt-drag an end to pull it off the wall it joins.</p>
      <div className="flex flex-wrap gap-2">
        {onJoin && <button className="btn btn-sm" onClick={onJoin} title="Make the room these walls close whole again: push and pull its walls as one room">Join into a room</button>}
        <button className="btn btn-sm" onClick={onCopy}>Copy</button>
        <button className="btn btn-sm btn-ghost text-red" onClick={onDelete}>Delete wall</button>
      </div>
    </div>
  );
}
