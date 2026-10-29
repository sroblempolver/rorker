"use client";
// One wall of a room seen from the side, standing in the room and facing it: its doors and windows at
// their real size and height, dragged along the wall to where they really are. Doors and windows can be
// added and resized here. Everything is written back to the sketch, so the plan above moves with it.
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Pt } from "@/lib/plan/types";
import type { SketchFloor } from "@/lib/plan/sketch";
import { fmtLen, parseLength, type Units } from "@/lib/plan/units";
import { doorSpot, doorWall, doorWidth, edgesOf, outsidePieces, param, pointInPoly, sameLine, segLen, sideOf, wallAt, windowSpots, windowWall, type Seg } from "@/lib/plan/sketchEdit";

const DOOR_H = 2100, WIN_SILL = 900, WIN_H = 1200;
type Item = { t: "door"; i: number; x0: number; x1: number } | { t: "window"; i: number; k: number; x0: number; x1: number };

/** The wall's two ends as seen from inside the room: left end first. */
export function wallFromInside(poly: Pt[], e: number): Seg {
  const [a, b] = edgesOf(poly)[e];
  const L = segLen([a, b]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  // the way you face, looking at the wall from inside
  let ox = uy, oy = -ux;
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (pointInPoly([mid[0] + ox * 30, mid[1] + oy * 30], poly)) { ox = -ox; oy = -oy; }
  // your right hand, with y pointing down the page
  const rx = -oy, ry = ox;
  return ux * rx + uy * ry >= 0 ? [a, b] : [b, a];
}

export function WallView({ floor, room, edge, height = 2700, units = "m", onChange, onClose, onEdge }: {
  floor: SketchFloor; room: number; edge: number; height?: number; units?: Units;
  /** `history`: false while dragging (the change before the drag was already kept for undo) */
  onChange: (f: SketchFloor, history?: boolean) => void; onClose: () => void; onEdge: (e: number) => void;
}) {
  const r = floor.rooms[room];
  const m = (mm: number) => fmtLen(mm, units);
  const wall = useMemo(() => wallFromInside(r.polygon, edge), [r.polygon, edge]);
  const L = segLen(wall);
  const at = (x: number): Pt => [wall[0][0] + ((wall[1][0] - wall[0][0]) * x) / L, wall[0][1] + ((wall[1][1] - wall[0][1]) * x) / L];
  const xOf = (p: Pt) => param(p, wall) * L;
  const side = sideOf(r.polygon, edgesOf(r.polygon)[edge]);

  // what is on this wall
  const items = useMemo(() => {
    const out: Item[] = [];
    const on = (s: Seg | null) => !!s && sameLine(s, wall) && (() => { const c = (xOf(s[0]) + xOf(s[1])) / 2; return c > 0 && c < L; })();
    (floor.doors ?? []).forEach((d, i) => { const s = doorSpot(floor, d); if (s && on(s)) { const [p, q] = [xOf(s[0]), xOf(s[1])].sort((a, b) => a - b); out.push({ t: "door", i, x0: p, x1: q }); } });
    (floor.windows ?? []).forEach((w, i) => windowSpots(floor, w).forEach((s, k) => { if (on(s)) { const [p, q] = [xOf(s[0]), xOf(s[1])].sort((a, b) => a - b); out.push({ t: "window", i, k, x0: p, x1: q }); } }));
    return out;
  }, [floor, wall]); // eslint-disable-line react-hooks/exhaustive-deps
  // who is on the other side, along the wall
  const outside = useMemo(() => outsidePieces(floor, room).filter((s) => sameLine(s, wall)).map((s) => [xOf(s[0]), xOf(s[1])].sort((a, b) => a - b) as [number, number]), [floor, room, wall]); // eslint-disable-line react-hooks/exhaustive-deps
  const beyond = useMemo(() => {
    const mid = at(L / 2), probe = wallAt(floor, mid, 40);
    if (!probe || probe.rooms[1] == null) return outside.length ? "outside" : "";
    return floor.rooms[probe.rooms[1]].name;
  }, [floor, wall]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sel, setSel] = useState<Item | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ item: Item; from: number; c0: number; moved: boolean } | null>(null);
  const pad = 400, H = height + 700, W = Math.max(L + pad * 2, H * 4);
  // the picture keeps its shape: work out the drawn width from the box's height
  const toX = (e: { clientX: number }) => { const b = svg.current!.getBoundingClientRect(); const k = Math.max(W / b.width, H / b.height); return L / 2 + (e.clientX - (b.left + b.width / 2)) * k; };

  // move an item so its centre sits `c` mm from the left end
  const moveTo = (it: Item, c: number, history: boolean) => {
    const P = at(Math.max(0, Math.min(L, c)));
    if (it.t === "door") {
      const d = floor.doors![it.i], ref = doorWall(floor, d);
      if (!ref) return;
      const t = Math.round(Math.max(0, Math.min(1, param(P, ref))) * 1000) / 1000;
      onChange({ ...floor, doors: floor.doors!.map((x, i) => (i === it.i ? { ...x, at: t } : x)) }, history);
    } else {
      const w = floor.windows![it.i], ref = windowWall(floor, w);
      if (!ref) return;
      const n = Math.max(1, Math.min(4, w.count ?? 1));
      const list = Array.from({ length: n }, (_, k) => w.at?.[k] ?? (k + 1) / (n + 1));
      list[it.k] = Math.round(Math.max(0, Math.min(1, param(P, ref))) * 1000) / 1000;
      onChange({ ...floor, windows: floor.windows!.map((x, i) => (i === it.i ? { ...x, at: list } : x)) }, history);
    }
  };
  const down = (e: RPointerEvent<SVGElement>, it: Item) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSel(it);
    drag.current = { item: it, from: toX(e), c0: (it.x0 + it.x1) / 2, moved: false };
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = toX(e) - d.from;
    if (!d.moved && Math.abs(dx) < 30) return;
    if (!d.moved) { d.moved = true; moveTo(d.item, d.c0, true); } // keep the start for undo
    moveTo(d.item, Math.round((d.c0 + dx) / 10) * 10, false);
  };
  const up = () => { drag.current = null; };

  // the middle of the widest stretch of wall with nothing on it, within [lo, hi]
  const freeAt = (lo: number, hi: number) => {
    const taken = items.map((x) => [x.x0, x.x1] as [number, number]).filter(([a, b]) => b > lo && a < hi).sort((a, b) => a[0] - b[0]);
    let best: [number, number] = [lo, lo], cur = lo;
    for (const [a, b] of [...taken, [hi, hi] as [number, number]]) { if (a - cur > best[1] - best[0]) best = [cur, a]; cur = Math.max(cur, b); }
    return (best[0] + best[1]) / 2;
  };
  const add = (kind: "door" | "window") => {
    setNote(null);
    if (kind === "window") {
      const free = outside.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
      if (!free) { setNote("Windows go on outside walls. This wall is between two rooms."); return; }
      const list = floor.windows ?? [];
      const j = list.findIndex((w) => w.room.toLowerCase() === r.name.toLowerCase() && w.side === side);
      if (j >= 0) {
        const w = list[j], n = Math.max(1, Math.min(4, w.count ?? 1));
        if (n >= 4) { setNote("Four windows is the most on one wall."); return; }
        const spots = Array.from({ length: n }, (_, k) => w.at?.[k] ?? (k + 1) / (n + 1));
        const ref = windowWall(floor, w), t = ref ? Math.max(0, Math.min(1, param(at(freeAt(free[0], free[1])), ref))) : 0.5;
        onChange({ ...floor, windows: list.map((x, i) => (i === j ? { ...x, count: n + 1, at: [...spots, Math.round(t * 1000) / 1000] } : x)) });
        setSel({ t: "window", i: j, k: n, x0: 0, x1: 0 });
      } else {
        onChange({ ...floor, windows: [...list, { room: r.name, side, count: 1 }] });
        setSel({ t: "window", i: list.length, k: 0, x0: 0, x1: 0 });
      }
      return;
    }
    // a door in the middle of the free stretch: to the room next door, or outside
    const mid = at(freeAt(0, L)), w = wallAt(floor, mid, 40);
    if (!w) { setNote("Couldn't find this wall. Try again from the plan."); return; }
    const t = Math.round(w.t * 100) / 100;
    const door = w.rooms[1] == null ? { rooms: [r.name, "outside"] as [string, string], side, at: t, kind: "door" as const }
      : { rooms: [r.name, floor.rooms[w.rooms[1]].name] as [string, string], at: t, kind: "door" as const };
    onChange({ ...floor, doors: [...(floor.doors ?? []), door] });
    setSel({ t: "door", i: (floor.doors ?? []).length, x0: 0, x1: 0 });
  };
  const remove = () => {
    if (!sel) return;
    if (sel.t === "door") onChange({ ...floor, doors: floor.doors!.filter((_, i) => i !== sel.i) });
    else {
      const w = floor.windows![sel.i], n = Math.max(1, Math.min(4, w.count ?? 1));
      if (n <= 1) onChange({ ...floor, windows: floor.windows!.filter((_, i) => i !== sel.i) });
      else {
        const spots = Array.from({ length: n }, (_, k) => w.at?.[k] ?? (k + 1) / (n + 1)).filter((_, k) => k !== sel.k);
        onChange({ ...floor, windows: floor.windows!.map((x, i) => (i === sel.i ? { ...x, count: n - 1, at: spots } : x)) });
      }
    }
    setSel(null);
  };
  const width = sel ? (sel.t === "door" ? doorWidth(floor.doors![sel.i]) : floor.windows![sel.i].width_mm ?? 1200) : 0;
  const setWidth = (v: number) => {
    if (!sel || !(v > 200)) return;
    if (sel.t === "door") onChange({ ...floor, doors: floor.doors!.map((x, i) => (i === sel.i ? { ...x, width_mm: v } : x)) }, false);
    else onChange({ ...floor, windows: floor.windows!.map((x, i) => (i === sel.i ? { ...x, width_mm: v } : x)) }, false);
  };
  const cur = sel && items.find((x) => x.t === sel.t && x.i === sel.i && (x.t === "door" || (sel.t === "window" && x.k === sel.k)));
  const n = edgesOf(r.polygon).length;
  const fs = Math.max(110, Math.max(L + 800, (height + 700) * 4) / 40);

  return (
    <section className="border-t border-line bg-panel" aria-label="Wall view">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
        <p className="eyebrow !mb-0">Wall view</p>
        <span>{r.name}, {side} wall · {m(L)}{beyond ? ` · ${beyond === "outside" ? "outside" : `${beyond}`} on the other side` : ""}</span>
        <span className="ml-auto flex gap-1.5">
          <button className="btn btn-sm btn-ghost" onClick={() => onEdge((edge - 1 + n) % n)} aria-label="Wall to the left">◀</button>
          <button className="btn btn-sm btn-ghost" onClick={() => onEdge((edge + 1) % n)} aria-label="Wall to the right">▶</button>
          <button className="btn btn-sm" onClick={() => add("door")}>+ Door</button>
          <button className="btn btn-sm" onClick={() => add("window")}>+ Window</button>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close the wall view">✕</button>
        </span>
      </div>
      <svg ref={svg} viewBox={`${L / 2 - W / 2} ${-H + 350} ${W} ${H}`} className="w-full h-[220px] touch-none select-none bg-ink" onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerDown={() => setSel(null)}>
        <rect x={0} y={-height} width={L} height={height} fill="#e3d9c6" stroke="#0a0a0b" strokeWidth={20} />
        {outside.map(([a, b], k) => <rect key={k} x={a} y={-height} width={b - a} height={height} fill="#d6c9b0" />)}
        <line x1={-pad} y1={0} x2={L + pad} y2={0} stroke="#9c978d" strokeWidth={20} />
        {items.map((it, k) => {
          const on = sel && sel.t === it.t && sel.i === it.i && (it.t === "door" || (sel.t === "window" && it.k === sel.k));
          const w = it.x1 - it.x0;
          return it.t === "door" ? (
            <g key={k} onPointerDown={(e) => down(e, it)} style={{ cursor: "ew-resize" }}>
              <rect x={it.x0} y={-DOOR_H} width={w} height={DOOR_H} fill={floor.doors![it.i].kind === "opening" ? "#2a2c30" : "#8a6a48"} stroke={on ? "#ff6a1f" : "#0a0a0b"} strokeWidth={on ? 40 : 16} />
              {floor.doors![it.i].kind !== "opening" && <circle cx={it.x1 - 90} cy={-1000} r={30} fill="#efe8da" />}
            </g>
          ) : (
            <g key={k} onPointerDown={(e) => down(e, it)} style={{ cursor: "ew-resize" }}>
              <rect x={it.x0} y={-(WIN_SILL + WIN_H)} width={w} height={WIN_H} fill="#8fd3f0" stroke={on ? "#ff6a1f" : "#0a0a0b"} strokeWidth={on ? 40 : 16} />
              <line x1={(it.x0 + it.x1) / 2} y1={-(WIN_SILL + WIN_H)} x2={(it.x0 + it.x1) / 2} y2={-WIN_SILL} stroke="#0a0a0b" strokeWidth={12} />
            </g>
          );
        })}
        {/* the wall's length, and where the picked door or window sits */}
        <text x={L / 2} y={260} fontSize={fs} textAnchor="middle" fill="#9c978d">{m(L)}</text>
        {cur && (
          <g fill="#ff6a1f" fontSize={fs}>
            <text x={cur.x0 / 2} y={-height - 80} textAnchor="middle">{m(cur.x0)}</text>
            <text x={(cur.x0 + cur.x1) / 2} y={-height - 80} textAnchor="middle">{m(cur.x1 - cur.x0)} wide</text>
            <text x={(cur.x1 + L) / 2} y={-height - 80} textAnchor="middle">{m(L - cur.x1)}</text>
          </g>
        )}
        {!items.length && <text x={L / 2} y={-height / 2} fontSize={fs} textAnchor="middle" fill="#6e6a62">No doors or windows on this wall</text>}
      </svg>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px] min-h-[44px]">
        {note && <span className="text-amber">{note}</span>}
        {!sel && !note && <span className="text-muted">Drag a door or window along the wall. Pick one to change its width or remove it.</span>}
        {sel && (
          <>
            <span>{sel.t === "door" ? "Door" : "Window"} width</span>
            <input key={`w${sel.t}${sel.i}${Math.round(width)}${units}`} className="input !h-8 !w-24" defaultValue={fmtLen(width, units, true)} onFocus={() => onChange(floor)}
              onBlur={(e) => { const v = parseLength(e.target.value, units); if (v) setWidth(Math.round(v / 10) * 10); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Width" />
            {cur && (
              <>
                <span>from the left</span>
                <input key={`p${sel.t}${sel.i}${Math.round(cur.x0)}${units}`} className="input !h-8 !w-24" defaultValue={fmtLen(cur.x0, units, true)} onFocus={() => onChange(floor)}
                  onBlur={(e) => { const v = parseLength(e.target.value, units); if (v != null) moveTo(cur, Math.round(v / 10) * 10 + (cur.x1 - cur.x0) / 2, false); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Distance from the left end of the wall" />
              </>
            )}
            <span className="text-muted">{units === "m" ? "m" : "ft in"}{sel.t === "window" && (floor.windows![sel.i].count ?? 1) > 1 ? " (all windows of this room on this side)" : ""}</span>
            <button className="btn btn-sm btn-ghost text-red ml-auto" onClick={remove}>Remove</button>
          </>
        )}
      </div>
    </section>
  );
}
