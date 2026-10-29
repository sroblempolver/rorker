"use client";
// The wall pieces on the plan (lib/plan/walls.ts), drawn at their real thickness: a half wall lighter,
// the picked one in orange with a handle on each end and its length beside it.
import type { SketchFloor } from "@/lib/plan/sketch";
import { isOutside, wallLen, wallThickness } from "@/lib/plan/walls";
import { fmtLen, type Units } from "@/lib/plan/units";

export function WallPieces({ floor, on, px, fontMm, units, hot }: { floor: SketchFloor; on: number | null; px: number; fontMm: number; units: Units; /** a wall the pointer is on (Remove or Copy), and its colour */ hot?: { i: number; col: string } | null }) {
  const walls = floor.walls ?? [];
  if (!walls.length) return null;
  return (
    <g style={{ pointerEvents: "none" }}>
      {walls.map((w, i) => {
        const t = Math.max(wallThickness(w, isOutside(floor.rooms, w)), 3 * px), col = hot?.i === i ? hot.col : on === i ? "#ff6a1f" : w.half ? "#a49d90" : "#efe8da";
        return <line key={i} x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke={col} strokeWidth={t} strokeLinecap="square" strokeOpacity={w.half && on !== i ? 0.85 : 1} />;
      })}
      {/* where pieces meet, so a joint reads as one corner */}
      {walls.flatMap((w, i) => [w.a, w.b].map((p, k) => <circle key={`j${i}-${k}`} cx={p[0]} cy={p[1]} r={2 * px} fill="#17181b" fillOpacity={0.55} />))}
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
