// The magic pen: a room drawn freehand, tidied into the room that was meant. A wobbly line becomes a
// straight wall, walls that are nearly square to the page are made square, a box that's nearly square
// becomes square. A wall drawn on a real slant keeps its slant (snapped to 45° when it's close).
import type { Pt } from "./types";

type Line = { p: Pt; d: Pt };
const deg = (r: number) => (r * 180) / Math.PI;

/** Fewer points along a stroke, keeping every point within `eps` of the result (Ramer–Douglas–Peucker). */
function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = L < 1 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;
    if (d > far) { far = d; at = i; }
  }
  if (far <= eps) return [a, b];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

/** A direction in degrees, 0 to 180: square to the page when within 12°, 45° when within 8°, as drawn otherwise. */
export function snapAngle(a: number): number {
  const t = ((a % 180) + 180) % 180;
  for (const q of [0, 90, 180]) if (Math.abs(t - q) <= 12) return q % 180;
  for (const q of [45, 135]) if (Math.abs(t - q) <= 8) return q;
  return t;
}

function meet(u: Line, v: Line): Pt | null {
  const den = u.d[0] * v.d[1] - u.d[1] * v.d[0];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((v.p[0] - u.p[0]) * v.d[1] - (v.p[1] - u.p[1]) * v.d[0]) / den;
  return [u.p[0] + u.d[0] * t, u.p[1] + u.d[1] * t];
}

/**
 * A freehand stroke (mm) as a clean room outline, corners in order; null when it's too small or not
 * a shape (a scribble, a single line). Corners land on a `grid` mm grid.
 */
export function tidyStroke(raw: Pt[], grid = 50): Pt[] | null {
  if (raw.length < 6) return null;
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (diag < 1000) return null;
  // the corners, as the pen went round
  const v = simplify([...raw, raw[0]], Math.max(100, diag * 0.05)).slice(0, -1);
  // corners drawn twice (a little overlap where the pen came back) and corners that aren't
  const close = diag * 0.08;
  for (let changed = true; changed && v.length > 3;) {
    changed = false;
    for (let i = 0; i < v.length && v.length > 3; i++) {
      const a = v[(i - 1 + v.length) % v.length], b = v[i], c = v[(i + 1) % v.length];
      const turn = Math.abs(((deg(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])) + 540) % 360) - 180);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < close || turn < 20) { v.splice(i, 1); changed = true; break; }
    }
  }
  if (v.length < 3) return null;
  // each wall as a straight line through its middle, turned square when it was nearly square
  let lines: Line[] = v.map((a, i) => {
    const b = v[(i + 1) % v.length], r = (snapAngle(deg(Math.atan2(b[1] - a[1], b[0] - a[0]))) * Math.PI) / 180;
    return { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d: [Math.cos(r), Math.sin(r)] };
  });
  // two walls in a row that ended up parallel are one wall
  for (let changed = true; changed && lines.length > 3;) {
    changed = false;
    for (let i = 0; i < lines.length && lines.length > 3; i++) {
      const u = lines[i], w = lines[(i + 1) % lines.length];
      if (Math.abs(u.d[0] * w.d[1] - u.d[1] * w.d[0]) < 0.05) {
        lines.splice(i, 2, { p: [(u.p[0] + w.p[0]) / 2, (u.p[1] + w.p[1]) / 2], d: u.d });
        if (i === lines.length) lines = [lines[lines.length - 1], ...lines.slice(0, -1)];
        changed = true;
        break;
      }
    }
  }
  if (lines.length < 3) return null;
  let out: Pt[] = [];
  for (let i = 0; i < lines.length; i++) {
    const q = meet(lines[(i - 1 + lines.length) % lines.length], lines[i]);
    if (!q) return null;
    out.push(q);
  }
  // a box that's nearly square is square
  const square = (d: Pt) => Math.abs(d[0]) < 1e-6 || Math.abs(d[1]) < 1e-6;
  if (out.length === 4 && lines.every((l) => square(l.d))) {
    const x0 = Math.min(...out.map((p) => p[0])), x1 = Math.max(...out.map((p) => p[0])), y0 = Math.min(...out.map((p) => p[1])), y1 = Math.max(...out.map((p) => p[1]));
    let [w, h] = [x1 - x0, y1 - y0];
    if (Math.abs(w - h) / Math.max(w, h) < 0.08) w = h = (w + h) / 2;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    out = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
  }
  out = out.map((p) => [Math.round(p[0] / grid) * grid, Math.round(p[1] / grid) * grid] as Pt);
  // a stroke that went wild (a corner thrown far off by two nearly parallel walls) isn't a room
  const span = Math.max(...out.map((p) => Math.hypot(p[0] - out[0][0], p[1] - out[0][1])));
  return span > diag * 2 ? null : out;
}
