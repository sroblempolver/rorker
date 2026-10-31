"use client";
// Stairs in the drawing tool: the plan symbol (a line at every tread, a break line where the plan is cut,
// the walking line with an arrow and UP), the opening they cut in the floor above, and the side panel
// for a picked stair. The numbers come from lib/plan/stairs.ts.
import type { Pt } from "@/lib/plan/types";
import type { SketchStair } from "@/lib/plan/sketch";
import { STAIR_SHAPES, isRound, stairGeom, type StairGeom } from "@/lib/plan/stairs";
import { centroid } from "@/lib/plan/geometry";
import { std, useStandards } from "@/lib/plan/standards";
import { says } from "@/lib/plan/checks";
import { parseLength, type Units } from "@/lib/plan/units";

const pts = (p: Pt[]) => p.map((q) => q.join(",")).join(" ");
// a plan is cut about 4' above the floor: steps higher than that are drawn dashed past the break line
const CUT = 1200;

/** The stair seen from above, on its own floor. */
export function StairSymbol({ g, px, fontMm, on, ghost }: { g: StairGeom; px: number; fontMm: number; on?: boolean; ghost?: boolean }) {
  const cut = Math.max(1, g.steps.findIndex((s) => s.top > CUT));
  const line = on ? "#ff6a1f" : "#efe8da";
  const brk = g.steps[cut];
  const end = g.path[g.path.length - 1], prev = g.path[g.path.length - 2];
  const L = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1, ux = (end[0] - prev[0]) / L, uy = (end[1] - prev[1]) / L, ah = Math.max(120, 9 * px);
  const head: Pt[] = [[end[0] - ux * ah - uy * ah * 0.6, end[1] - uy * ah + ux * ah * 0.6], end, [end[0] - ux * ah + uy * ah * 0.6, end[1] - uy * ah - ux * ah * 0.6]];
  const f0 = g.path[0], f1 = g.path[1];
  const fl = Math.hypot(f1[0] - f0[0], f1[1] - f0[1]) || 1;
  const up: Pt = [f0[0] + ((f1[0] - f0[0]) / fl) * fontMm * 0.9, f0[1] + ((f1[1] - f0[1]) / fl) * fontMm * 0.9];
  return (
    <g opacity={ghost ? 0.55 : 1}>
      <polygon points={pts(g.footprint)} fill="#17181b" fillOpacity={0.55} stroke={line} strokeWidth={(on ? 3 : 1.6) * px} />
      {g.steps.map((s, i) => (
        <polygon key={i} points={pts(s.polygon)} fill="none" stroke={line} strokeOpacity={i >= cut && brk ? 0.45 : 0.85} strokeWidth={px}
          strokeDasharray={i >= cut && brk ? `${4 * px} ${3 * px}` : undefined} />
      ))}
      {brk && (() => {
        // the break line: corner to corner across the cut tread, with a zigzag in the middle
        const a = brk.polygon[0], c = brk.polygon[Math.floor(brk.polygon.length / 2)], m: Pt = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1;
        const k = Math.min(d * 0.12, 14 * px), nx = -dy / d, ny = dx / d;
        const z: Pt[] = [a, [m[0] - (dx / d) * k, m[1] - (dy / d) * k], [m[0] + nx * k, m[1] + ny * k], [m[0] - nx * k, m[1] - ny * k], [m[0] + (dx / d) * k, m[1] + (dy / d) * k], c];
        return <polyline points={pts(z)} fill="none" stroke={line} strokeWidth={1.6 * px} />;
      })()}
      {g.round?.pole && <circle cx={g.round.centre[0]} cy={g.round.centre[1]} r={g.round.inner} fill={line} fillOpacity={0.5} stroke={line} strokeWidth={px} />}
      <polyline points={pts(g.path)} fill="none" stroke="#ff6a1f" strokeWidth={1.6 * px} />
      <polyline points={pts(head)} fill="none" stroke="#ff6a1f" strokeWidth={1.6 * px} strokeLinejoin="round" />
      <circle cx={f0[0]} cy={f0[1]} r={3 * px} fill="#ff6a1f" />
      <text x={up[0]} y={up[1]} fontSize={fontMm * 0.75} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="#000" strokeWidth={fontMm * 0.12} paintOrder="stroke" style={{ pointerEvents: "none" }}>UP</text>
    </g>
  );
}

/** Upstairs: the opening the stairs below come up through, with those stairs seen faintly through it. */
export function StairHole({ g, px, fontMm }: { g: StairGeom; px: number; fontMm: number }) {
  const c = centroid(g.hole);
  return (
    <g style={{ pointerEvents: "none" }}>
      <polygon points={pts(g.hole)} fill="#0c0d0b" fillOpacity={0.7} stroke="#55b2ff" strokeWidth={2 * px} strokeDasharray={`${8 * px} ${5 * px}`} />
      {g.steps.map((s, i) => <polygon key={i} points={pts(s.polygon)} fill="none" stroke="#55b2ff" strokeOpacity={0.3} strokeWidth={px} />)}
      <text x={c[0]} y={c[1]} fontSize={fontMm * 0.8} textAnchor="middle" dominantBaseline="middle" fill="#55b2ff" stroke="#000" strokeWidth={fontMm * 0.12} paintOrder="stroke">Open to below</text>
    </g>
  );
}

/** Whether a point is on the stair (for picking it). */
export function onStair(g: StairGeom, p: Pt) {
  let inside = false;
  const poly = g.footprint;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The side panel for a picked stair: its shape and size, and what that works out to. */
export function StairPanel({ st, rise, units, onChange, onStart, onDelete, onStd }: {
  st: SketchStair; rise: number; units: Units; onChange: (s: SketchStair, keepHistory?: boolean) => void; onStart: () => void; onDelete: () => void; onStd: (key: string) => void;
}) {
  useStandards();
  const g = stairGeom(st, rise);
  const round = isRound(st.shape), turns = st.shape !== "straight";
  const len = (k: "width_mm" | "tread_mm" | "landing_mm" | "inner_mm", value: number, lbl: string) => (
    <div><label className="label !mb-1" htmlFor={`st-${k}`}>{lbl}</label>
      <input id={`st-${k}`} key={`${k}-${Math.round(value)}`} className="input !h-9" defaultValue={says(value)} onFocus={onStart}
        onBlur={(e) => { const v = parseLength(e.target.value, units); if (v && v > (k === "inner_mm" ? 20 : 100)) onChange({ ...st, [k]: Math.round(v * 10) / 10 }, false); else e.target.value = says(value); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></div>
  );
  const flip = () => {
    if (turns) return onChange({ ...st, turn: st.turn === "left" ? "right" : "left" });
    const end = g.path[1];
    onChange({ ...st, at: end, rotation: (st.rotation + 180) % 360 });
  };
  const row = (k: string, v: string, key?: string) => (
    <div className="flex justify-between gap-2"><span className="text-muted">{k}</span>
      {key ? <button className="font-mono underline decoration-dotted" title="See the standard" onClick={() => onStd(key)}>{v}</button> : <span className="font-mono">{v}</span>}</div>
  );
  return (
    <div className="space-y-2">
      <p className="eyebrow">Stairs</p>
      <div className="flex flex-wrap gap-1">{STAIR_SHAPES.map(([k, l]) => <button key={k} onClick={() => onChange({ ...st, shape: k, split: undefined, ...(isRound(k) !== round || (round && k !== st.shape) ? { width_mm: undefined, tread_mm: undefined, risers: undefined, inner_mm: undefined } : {}) })} className={`chip !h-7 ${st.shape === k ? "!text-accent !border-accent" : ""}`}>{l}</button>)}</div>
      {turns && (
        <div className="flex items-center gap-1.5"><span className="text-muted">{round ? "Curves" : "Turns"}</span>
          {(["left", "right"] as const).map((t) => <button key={t} onClick={() => onChange({ ...st, turn: t })} className={`chip !h-7 ${(st.turn ?? "right") === t ? "!text-accent !border-accent" : ""}`}>{t}</button>)}</div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted">Goes up</span>
        <button className="chip !h-7" onClick={() => onChange({ ...st, rotation: (st.rotation + 270) % 360 })} title="Turn a quarter to the left">⟲</button>
        <button className="chip !h-7" onClick={() => onChange({ ...st, rotation: (st.rotation + 90) % 360 })} title="Turn a quarter to the right">⟳</button>
        <button className="chip !h-7" onClick={flip}>{st.shape === "straight" ? "Other way" : "Mirror"}</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {len("width_mm", g.width, "Width")}
        {len("tread_mm", g.tread, round ? "Tread (walk line)" : "Tread")}
        {turns && !round && len("landing_mm", g.landing, "Landing depth")}
        {round && len("inner_mm", g.round!.inner, st.shape === "spiral" ? "Pole radius" : "Inner radius")}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted flex-1">Steps</span>
        <button className="chip !h-7" onClick={() => onChange({ ...st, risers: Math.max(3, g.risers - 1) })} aria-label="One step less">−</button>
        <span className="font-mono w-8 text-center">{g.risers}</span>
        <button className="chip !h-7" onClick={() => onChange({ ...st, risers: g.risers + 1 })} aria-label="One step more">+</button>
        {st.risers != null && <button className="text-[12px] text-muted underline" onClick={() => onChange({ ...st, risers: undefined })}>From the height</button>}
      </div>
      {turns && !round && g.flight1 + g.flight2 > 0 && (
        <div><label className="label !mb-1">Treads before the landing: {g.flight1} of {g.flight1 + g.flight2}</label>
          <input type="range" className="w-full" min={0} max={g.flight1 + g.flight2} step={1} value={g.flight1} onPointerDown={onStart} onChange={(e) => onChange({ ...st, split: +e.target.value }, false)} /></div>
      )}
      <div className="space-y-0.5 text-[13px]">
        {row("Floor to floor", says(rise))}
        {row("Each step", says(g.riser), st.shape === "spiral" ? "stair.spiralRiserMax" : "stair.riserMax")}
        {row("Tread", says(g.tread), st.shape === "spiral" ? "stair.spiralTreadMin" : "stair.treadMin")}
        {g.round ? <>
          {st.shape === "curved" && row("Narrow end", says(g.round.narrow), "stair.windNarrow")}
          {row("Goes round", `${Math.round(g.round.sweep)}°`)}
          {row("Across", says(2 * g.round.outer))}
        </> : row("Run", says(g.run))}
        {row("Headroom", says(g.headroom), st.shape === "spiral" ? "stair.spiralHeadroom" : "stair.headroom")}
      </div>
      <p className="text-[12px] text-muted leading-snug">Steps come from the floor height and your standards ({says(std(st.shape === "spiral" ? "stair.spiralRiser" : "stair.riser"))} a step).{round ? " More steps go further round; a bigger tread or radius makes them gentler." : ""} The floor above gets an opening that leaves the headroom.</p>
      <button className="btn btn-sm btn-ghost text-red" onClick={onDelete}>Delete stairs</button>
    </div>
  );
}
