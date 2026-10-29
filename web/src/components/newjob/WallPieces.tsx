"use client";
// The walls on the plan, drawn at their real thickness: the walls rooms drawn as shapes make and the wall
// pieces (lib/plan/walls.ts) look the same. A half wall is lighter, the picked piece orange with a handle
// on each end and its length beside it.
import type { SketchFloor } from "@/lib/plan/sketch";
import { isOutside, roomWalls, wallLen, wallThickness } from "@/lib/plan/walls";
import { fmtLen, type Units } from "@/lib/plan/units";

export function WallPieces({ floor, on, px, fontMm, units, hot }: { floor: SketchFloor; on: number | null; px: number; fontMm: number; units: Units; /** a wall the pointer is on (Remove or Copy), and its colour */ hot?: { i: number; col: string } | null }) {
  const walls = floor.walls ?? [], fromRooms = roomWalls(floor.rooms);
  if (!walls.length && !fromRooms.length) return null;
  return (
    <g style={{ pointerEvents: "none" }}>
      {fromRooms.map((w, i) => <line key={`r${i}`} x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke="#efe8da" strokeWidth={Math.max(w.t, 3 * px)} strokeLinecap="square" />)}
      {walls.map((w, i) => {
        const t = Math.max(wallThickness(w, isOutside(floor.rooms, w)), 3 * px), col = hot?.i === i ? hot.col : on === i ? "#ff6a1f" : w.half ? "#a49d90" : "#efe8da";
        return <line key={i} x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke={col} strokeWidth={t} strokeLinecap="square" strokeOpacity={w.half && on !== i ? 0.85 : 1} />;
      })}
      {walls.flatMap((w, i) => {
        // doors (a gap with a dark sill) and windows (a blue pane) set in the piece
        const L = wallLen(w) || 1, u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], t = wallThickness(w, isOutside(floor.rooms, w));
        const seg = (at: number, wd: number) => { const c = L * at, h = Math.min(wd, L) / 2; return [w.a[0] + u[0] * (c - h), w.a[1] + u[1] * (c - h), w.a[0] + u[0] * (c + h), w.a[1] + u[1] * (c + h)]; };
        return [
          ...(w.doors ?? []).map((d, k) => { const [x1, y1, x2, y2] = seg(d.at, d.width_mm ?? 813); return <g key={`d${i}-${k}`}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a2723" strokeWidth={t + 2 * px} /><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ff6a1f" strokeWidth={2 * px} strokeDasharray={`${6 * px} ${4 * px}`} /></g>; }),
          ...(w.windows ?? []).map((d, k) => { const [x1, y1, x2, y2] = seg(d.at, d.width_mm ?? 914); return <line key={`w${i}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7cc4ff" strokeWidth={Math.max(t * 0.45, 2 * px)} />; }),
        ];
      })}
      {on != null && walls[on] && (() => {
        const w = walls[on], L = wallLen(w) || 1, n = [-(w.b[1] - w.a[1]) / L, (w.b[0] - w.a[0]) / L], off = wallThickness(w) / 2 + fontMm * 0.9;
        const m = [(w.a[0] + w.b[0]) / 2 + n[0] * off, (w.a[1] + w.b[1]) / 2 + n[1] * off];
        return (
          <>
            {[w.a, w.b].map((p, k) => <circle key={`e${k}`} cx={p[0]} cy={p[1]} r={7 * px} fill="#ff6a1f" stroke="#fff" strokeWidth={1.5 * px} />)}
            <text x={m[0]} y={m[1]} fontSize={fontMm * 1.1} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill="#ff6a1f" stroke="#000" strokeWidth={fontMm * 0.16} paintOrder="stroke">{fmtLen(wallLen(w), units, true)}</text>
          </>
        );
      })()}
    </g>
  );
}
