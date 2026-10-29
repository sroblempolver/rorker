// Drawing a room corner by corner: each wall turns in fixed steps (45 or 90 degrees), a typed length
// sets how long the wall being drawn is, and the finished outline drops repeated and in-line corners.
import type { Pt } from "./types";

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The direction from `from` toward `p`, turned to the nearest step of `stepDeg` degrees (a unit vector). */
export function snapDir(from: Pt, p: Pt, stepDeg: number): Pt {
  const a = Math.atan2(p[1] - from[1], p[0] - from[0]), st = (Math.max(1, stepDeg) * Math.PI) / 180;
  const s = Math.round(a / st) * st;
  const d: Pt = [Math.cos(s), Math.sin(s)];
  // square directions come out exact
  return [Math.abs(d[0]) < 1e-9 ? 0 : d[0], Math.abs(d[1]) < 1e-9 ? 0 : d[1]];
}

/** Where the pointer puts the next corner: along the stepped direction, as far as the pointer reaches. */
export function nextCorner(from: Pt, p: Pt, stepDeg: number): Pt {
  const d = snapDir(from, p, stepDeg), len = Math.max(0, (p[0] - from[0]) * d[0] + (p[1] - from[1]) * d[1]);
  return [from[0] + d[0] * len, from[1] + d[1] * len];
}

/** The corner `len` mm from `from` in the stepped direction of the pointer (a typed wall length). */
export const cornerAt = (from: Pt, p: Pt, len: number, stepDeg: number): Pt => {
  const d = snapDir(from, p, stepDeg);
  return [Math.round(from[0] + d[0] * len), Math.round(from[1] + d[1] * len)];
};

/** The finished outline: no repeated corners, no corner in the middle of a straight wall. */
export function cleanOutline(pts: Pt[]): Pt[] {
  let out = pts.map((q) => [Math.round(q[0]), Math.round(q[1])] as Pt).filter((q, i, a) => dist(q, a[(i + 1) % a.length]) > 5);
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cross) / (dist(a, c) || 1) < 5) { out = out.filter((_, j) => j !== i); changed = true; break; }
    }
  }
  return out;
}
