"use client";
// Build mode on the floor map: every wall can be grabbed. Drag a wall straight out or in to make the
// room bigger or smaller, drag the end of the picked wall to make it longer or shorter, and right-click
// a wall to cut it in two so each piece moves on its own. The house is only changed on letting go.
import { useMemo } from "react";
import type { Floor, Pt, Room } from "@/lib/plan/types";
import { sidesOf, type BuildSide } from "@/lib/plan/house";
import { fmtLen, INCH } from "@/lib/plan/units";
import type { useWorldDrag } from "./svg";

export interface BuildMap {
  /** Pick or Move wall in hand: walls can be grabbed (with another tool, clicks go to that tool) */
  walls: boolean;
  /** the wall picked, as the plan stands now */
  picked: { roomId: string; key: string } | null;
  onPick: (room: Room, side: BuildSide) => void;
  onMove: (room: Room, side: BuildSide, by: number) => void;
  onEnd: (room: Room, side: BuildSide, end: "a" | "b", by: number) => void;
  onCut: (p: Pt) => void;
}

type Drag = ReturnType<typeof useWorldDrag>;
const ACCENT = "#ff6a1f", CHALK = "#f4efe6";
/** to the inch, or free with Shift */
const snap = (v: number, free: boolean) => (free ? v : Math.round(v / INCH) * INCH);
const label = (by: number) => `${by > 0 ? "+" : "−"}${fmtLen(Math.abs(by), "ft")}`;

export function BuildLayer({ floor, room, lw, map, drag, start, toWorld }: {
  floor: Floor; room: Room | null; lw: number; map: BuildMap; drag: Drag["drag"]; start: Drag["start"];
  toWorld: (cx: number, cy: number) => { x: number; y: number };
}) {
  const sides = useMemo(() => floor.rooms.flatMap((r) => sidesOf(floor, r).map((s) => ({ r, s }))), [floor]);
  const picked = map.picked ? sides.find((x) => x.r.id === map.picked!.roomId && x.s.key === map.picked!.key) ?? null : null;
  const joints = (floor.joints ?? []).filter((j) => sides.some(({ s }) => (s.cutA && near(s.a, j)) || (s.cutB && near(s.b, j))));
  if (!map.walls) return null;

  const grab = (r: Room, s: BuildSide, e: React.PointerEvent) => {
    const w = toWorld(e.clientX, e.clientY), u = dir(s), o: Pt = [-s.inward[0], -s.inward[1]];
    // held by the spot on the wall's face under the pointer; it follows the pointer straight across, never along
    const t = (w.x - s.a[0]) * u[0] + (w.y - s.a[1]) * u[1], p0 = { x: s.a[0] + u[0] * t, y: s.a[1] + u[1] * t };
    const across = (q: { x: number; y: number }) => (q.x - p0.x) * o[0] + (q.y - p0.y) * o[1];
    start(`w|${r.id}|${s.key}`, e, p0, (x, y) => {
      const by = across({ x, y });
      if (Math.abs(by) >= 10) map.onMove(r, s, by);
    }, (q, free) => {
      const by = snap(across(q), free);
      return { x: p0.x + o[0] * by, y: p0.y + o[1] * by };
    });
  };
  const grabEnd = (r: Room, s: BuildSide, end: "a" | "b", e: React.PointerEvent) => {
    const p = end === "a" ? s.a : s.b, u = dir(s), out: Pt = end === "b" ? u : [-u[0], -u[1]];
    start(`e|${r.id}|${s.key}|${end}`, e, { x: p[0], y: p[1] }, (x, y) => {
      const by = snap((x - p[0]) * out[0] + (y - p[1]) * out[1], false);
      if (Math.abs(by) >= 10) map.onEnd(r, s, end, by);
    }, (q, free) => {
      // never shorter than a foot
      const by = Math.max(-(s.length - 300), snap((q.x - p[0]) * out[0] + (q.y - p[1]) * out[1], free));
      return { x: p[0] + out[0] * by, y: p[1] + out[1] * by };
    });
  };

  // the wall being dragged, where it would go
  const live = drag && (drag.id.startsWith("w|") || drag.id.startsWith("e|")) ? (() => {
    const [kind, rid, key, end] = drag.id.split("|");
    const hit = sides.find((x) => x.r.id === rid && x.s.key === key);
    if (!hit) return null;
    const { s } = hit, u = dir(s);
    if (kind === "w") {
      const o: Pt = [-s.inward[0], -s.inward[1]];
      const k = Math.round((drag.x - s.a[0]) * o[0] + (drag.y - s.a[1]) * o[1]);
      const pa: Pt = [s.a[0] + o[0] * k, s.a[1] + o[1] * k], pb: Pt = [s.b[0] + o[0] * k, s.b[1] + o[1] * k];
      return { from: [s.a, s.b] as [Pt, Pt], to: [pa, pb] as [Pt, Pt], text: Math.abs(k) >= 10 ? label(k) : "", at: mid(pa, pb), o };
    }
    const p = end === "a" ? s.a : s.b, out: Pt = end === "b" ? u : [-u[0], -u[1]];
    const by = Math.round((drag.x - p[0]) * out[0] + (drag.y - p[1]) * out[1]);
    const q: Pt = [drag.x, drag.y], other = end === "a" ? s.b : s.a;
    return { from: [s.a, s.b] as [Pt, Pt], to: [other, q] as [Pt, Pt], text: `${fmtLen(s.length + by, "ft")} long`, at: q, o: [-s.inward[0], -s.inward[1]] as Pt };
  })() : null;

  const hitW = 16 * lw;
  return (
    <g>
      {sides.map(({ r, s }) => {
        const on = picked?.s.key === s.key && picked.r.id === r.id;
        const dim = room && room.id !== r.id;
        const vertical = Math.abs(s.inward[0]) > 0.5;
        return (
          <g key={`${r.id}:${s.key}`} className={`build-wall ${vertical ? "cursor-ew-resize" : "cursor-ns-resize"}`} opacity={dim ? 0.5 : 1}
            onPointerDown={(e) => grab(r, s, e)}
            onClick={(e) => { e.stopPropagation(); map.onPick(r, s); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const w = toWorld(e.clientX, e.clientY); map.onCut([w.x, w.y]); }}>
            {/* a wide invisible band to grab, just inside the room's face */}
            <path d={`M${s.a[0] + s.inward[0] * hitW * 0.3} ${s.a[1] + s.inward[1] * hitW * 0.3}L${s.b[0] + s.inward[0] * hitW * 0.3} ${s.b[1] + s.inward[1] * hitW * 0.3}`}
              stroke="transparent" strokeWidth={hitW} />
            <path className="build-wall-line" d={`M${s.a[0]} ${s.a[1]}L${s.b[0]} ${s.b[1]}`} stroke={on ? ACCENT : CHALK} strokeWidth={(on ? 4 : 2.5) * lw}
              strokeOpacity={on ? 1 : 0} strokeLinecap="round" pointerEvents="none" />
          </g>
        );
      })}
      {joints.map((j, i) => (
        <rect key={i} x={j[0] - 5 * lw} y={j[1] - 5 * lw} width={10 * lw} height={10 * lw} transform={`rotate(45 ${j[0]} ${j[1]})`} fill={ACCENT} stroke="#141310" strokeWidth={1.5 * lw} pointerEvents="none" />
      ))}
      {/* the picked wall's two ends: drag along the wall to make it longer or shorter */}
      {picked && !live && (["a", "b"] as const).map((end) => {
        const p = end === "a" ? picked.s.a : picked.s.b, vertical = Math.abs(picked.s.inward[0]) > 0.5;
        const sz = 13 * lw;
        return (
          <rect key={end} x={p[0] - sz / 2} y={p[1] - sz / 2} width={sz} height={sz} rx={2 * lw} fill={CHALK} stroke={ACCENT} strokeWidth={2.5 * lw}
            className={vertical ? "cursor-ns-resize" : "cursor-ew-resize"}
            onPointerDown={(e) => grabEnd(picked.r, picked.s, end, e)} onClick={(e) => e.stopPropagation()}>
            <title>Drag to make this wall longer or shorter</title>
          </rect>
        );
      })}
      {live && (
        <g pointerEvents="none">
          <path d={`M${live.from[0][0]} ${live.from[0][1]}L${live.from[1][0]} ${live.from[1][1]}`} stroke={CHALK} strokeOpacity={0.5} strokeWidth={2 * lw} strokeDasharray={`${6 * lw} ${4 * lw}`} />
          <path d={`M${live.to[0][0]} ${live.to[0][1]}L${live.to[1][0]} ${live.to[1][1]}`} stroke={ACCENT} strokeWidth={5 * lw} strokeLinecap="round" />
          {live.text && (
            <g transform={`translate(${live.at[0] + live.o[0] * 26 * lw} ${live.at[1] + live.o[1] * 26 * lw})`}>
              <rect x={-44 * lw} y={-12 * lw} width={88 * lw} height={24 * lw} rx={3 * lw} fill="#141310" stroke={ACCENT} strokeWidth={1.5 * lw} />
              <text textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-mono)" fontSize={13 * lw} fill={CHALK}>{live.text}</text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

const near = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 30;
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dir = (s: BuildSide): Pt => { const L = s.length || 1; return [(s.b[0] - s.a[0]) / L, (s.b[1] - s.a[1]) / L]; };
