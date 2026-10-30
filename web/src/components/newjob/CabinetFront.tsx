"use client";
// A cabinet seen from the front in the wall view: its toe kick, box, doors and drawers by configuration
// (the dashed lines point to the hinge side, as on a cabinet elevation), the countertop on a base, crown
// on top and light rail under a wall cabinet, and its code. Wall view frame: x mm along the wall, y up is
// negative.
import type { SketchFixture } from "@/lib/plan/sketch";
import { bottomOf } from "@/lib/plan/catalog";
import { cabCode, defaults, famOf, frontsOf, handlesLow, isStock, toeOf } from "@/lib/plan/cabinets";
import { std } from "@/lib/plan/standards";

const INK = "#0a0a0b", BOX = "#d9d0bf", FRONT = "#efe8da", KICK = "#2f2d2a", TOP = "#4a4844", HANDLE = "#6d6a63";

export function CabinetFront({ f, x0, x1, on, fs }: { f: SketchFixture; x0: number; x1: number; on: boolean; fs: number }) {
  const c = f.cab!;
  const def = defaults(c.fam), w = x1 - x0, h = f.height_mm ?? def.h, b = bottomOf(f), toe = toeOf(c);
  const bath = c.fam === "vanity" || c.fam === "vanity_drawer";
  const y = (up: number) => -(b + up); // height above the floor -> svg y
  const code = cabCode(c, f.width_mm ?? w, f.depth_mm ?? def.d, h);
  const custom = !isStock(c.fam, f.width_mm ?? w, f.depth_mm ?? def.d, h);
  const line = { stroke: INK, strokeWidth: 10, strokeLinejoin: "round" as const };
  const fronts = c.fam.startsWith("filler") || c.fam.startsWith("panel") || c.fam === "valance" ? [] : frontsOf(c, w, h - toe);
  const counter = c.counter ? std("cab.counter.thick") : 0, crown = c.crown ? std("cab.crown") : 0, rail = c.rail && famOf(c.fam).zone === "wall" ? std("cab.lightrail") : 0;
  const label = Math.min(fs * 0.6, w / Math.max(3, code.length * 0.62));
  return (
    <g>
      {toe > 0 && <rect x={x0 + 8} y={y(toe)} width={w - 16} height={toe} fill={KICK} />}
      <rect x={x0} y={y(h)} width={w} height={h - toe} fill={bath ? "#b48a5e" : c.fam === "valance" ? FRONT : BOX} {...line} />
      {fronts.map((fr, k) => {
        const fx = x0 + fr.x, fy = y(toe + fr.y + fr.h), low = handlesLow(c);
        const fill = fr.t === "glass" ? "#8fb8c9" : fr.t === "mirror" ? "#cfe6ee" : fr.t === "open" || fr.t === "oven" ? "#2a2b2e" : fr.t === "blind" ? BOX : bath ? "#c69a6c" : FRONT;
        return (
          <g key={k}>
            <rect x={fx} y={fy} width={fr.w} height={fr.h} fill={fill} {...line} strokeWidth={8} />
            {fr.t === "open" && [1, 2].map((s) => <line key={s} x1={fx} x2={fx + fr.w} y1={fy + (fr.h * s) / 3} y2={fy + (fr.h * s) / 3} stroke={BOX} strokeWidth={14} />)}
            {fr.t === "drawer" && <line x1={fx + fr.w / 2 - Math.min(80, fr.w * 0.2)} x2={fx + fr.w / 2 + Math.min(80, fr.w * 0.2)} y1={fy + Math.min(60, fr.h / 3)} y2={fy + Math.min(60, fr.h / 3)} stroke={HANDLE} strokeWidth={16} strokeLinecap="round" />}
            {fr.t === "oven" && <line x1={fx + fr.w * 0.15} x2={fx + fr.w * 0.85} y1={fy + 50} y2={fy + 50} stroke="#b9bec4" strokeWidth={18} strokeLinecap="round" />}
            {(fr.t === "door" || fr.t === "glass" || fr.t === "mirror") && (() => {
              // the swing: from the handle side's corners to the middle of the hinge side
              const hx = fr.hinge === "R" ? fx + fr.w : fx, ox = fr.hinge === "R" ? fx : fx + fr.w;
              const hy = fr.hinge === "R" ? fx + 40 : fx + fr.w - 40;
              return (
                <>
                  <path d={`M${ox} ${fy}L${hx} ${fy + fr.h / 2}L${ox} ${fy + fr.h}`} fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={6} strokeDasharray="30 22" />
                  {fr.t !== "mirror" && <line x1={hy} x2={hy} y1={low ? fy + fr.h - 60 : fy + 60} y2={low ? fy + fr.h - 200 : fy + 200} stroke={HANDLE} strokeWidth={16} strokeLinecap="round" />}
                </>
              );
            })()}
          </g>
        );
      })}
      {counter > 0 && <rect x={x0} y={y(h + counter)} width={w} height={counter} fill={bath ? "#e8e4dc" : TOP} {...line} strokeWidth={6} />}
      {crown > 0 && <rect x={x0 - 6} y={y(h + crown)} width={w + 12} height={crown} fill={FRONT} {...line} strokeWidth={6} />}
      {rail > 0 && <rect x={x0} y={y(0)} width={w} height={rail} fill={FRONT} {...line} strokeWidth={6} />}
      {on && <rect x={x0} y={y(h + counter + crown)} width={w} height={h + counter + crown} fill="none" stroke="#ff6a1f" strokeWidth={36} />}
      {w > 60 && <text x={x0 + w / 2} y={y((toe + h) / 2) + label * 0.35} fontSize={label} textAnchor="middle" fill={custom ? "#b8473a" : INK} fontFamily="ui-monospace, monospace" style={{ pointerEvents: "none" }}>{code}</text>}
    </g>
  );
}
