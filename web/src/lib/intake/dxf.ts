// A small DXF reader for the New project assistant: enough to draw the drawing as a picture and list
// its text labels, in plan millimetres (x right, y down). Blocks (doors, fixtures, dimensions) are
// expanded in place. The full plan reader on the server does the precise geometry.
import type { Pt } from "@/lib/plan/types";

export interface DxfText { at: Pt; text: string; height: number }
export interface DxfDrawing { lines: Pt[][]; texts: DxfText[]; bounds: [number, number, number, number]; unitsMm: number }

type Pair = [number, string];
interface Ent { type: string; g: Pair[] }
interface Block { base: Pt; ents: Ent[] }
type M = [number, number, number, number, number, number]; // affine: x' = a x + c y + e, y' = b x + d y + f

const UNITS: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };
const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const ap = (m: M, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function pairs(text: string): Pair[] {
  const rows = text.split(/\r?\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < rows.length; i += 2) {
    const c = parseInt(rows[i].trim(), 10);
    if (!Number.isNaN(c)) out.push([c, rows[i + 1].trim()]);
  }
  return out;
}

const num = (g: Pair[], code: number, dflt = 0) => { const p = g.find((x) => x[0] === code); return p ? parseFloat(p[1]) : dflt; };
const str = (g: Pair[], code: number) => g.find((x) => x[0] === code)?.[1] ?? "";

/** Split a run of pairs into entities (each starts at a 0 code). */
function entities(ps: Pair[]): Ent[] {
  const out: Ent[] = [];
  let cur: Ent | null = null;
  for (const p of ps) {
    if (p[0] === 0) { cur = { type: p[1], g: [] }; out.push(cur); } else cur?.g.push(p);
  }
  return out;
}

function cleanText(s: string) {
  return s.replace(/\\P/g, " ").replace(/\\[A-Za-z][^;]*;/g, "").replace(/[{}]/g, "").replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±").replace(/\s+/g, " ").trim();
}

export function readDxf(text: string): DxfDrawing {
  const ps = pairs(text);
  // sections
  const sections = new Map<string, Pair[]>();
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === 0 && ps[i][1] === "SECTION" && ps[i + 1]?.[0] === 2) {
      const name = ps[i + 1][1];
      let j = i + 2;
      while (j < ps.length && !(ps[j][0] === 0 && ps[j][1] === "ENDSEC")) j++;
      sections.set(name, ps.slice(i + 2, j));
      i = j;
    }
  }
  const header = sections.get("HEADER") ?? [];
  const iu = header.findIndex((p) => p[0] === 9 && p[1] === "$INSUNITS");
  const unitsMm = UNITS[iu >= 0 ? parseInt(header[iu + 1]?.[1] ?? "4", 10) : 4] ?? 1;

  const blocks = new Map<string, Block>();
  let cur: { name: string; block: Block } | null = null;
  for (const e of entities(sections.get("BLOCKS") ?? [])) {
    if (e.type === "BLOCK") { cur = { name: str(e.g, 2), block: { base: [num(e.g, 10), num(e.g, 20)], ents: [] } }; blocks.set(cur.name, cur.block); }
    else if (e.type === "ENDBLK") cur = null;
    else cur?.block.ents.push(e);
  }

  const lines: Pt[][] = [];
  const texts: DxfText[] = [];
  let budget = 400_000; // points, so a huge drawing can't hang the page

  const draw = (ents: Ent[], m: M, depth: number) => {
    for (let i = 0; i < ents.length && budget > 0; i++) {
      const e = ents[i], g = e.g;
      const layer = str(g, 8).toLowerCase();
      if (layer === "defpoints") continue;
      switch (e.type) {
        case "LINE": lines.push([ap(m, num(g, 10), num(g, 20)), ap(m, num(g, 11), num(g, 21))]); budget -= 2; break;
        case "LWPOLYLINE": {
          const xs = g.filter((p) => p[0] === 10).map((p) => parseFloat(p[1])), ys = g.filter((p) => p[0] === 20).map((p) => parseFloat(p[1]));
          const pts = xs.map((x, k) => ap(m, x, ys[k] ?? 0));
          if (num(g, 70) % 2 === 1 && pts.length > 2) pts.push(pts[0]);
          if (pts.length > 1) { lines.push(pts); budget -= pts.length; }
          break;
        }
        case "POLYLINE": {
          const pts: Pt[] = [];
          const closed = num(g, 70) % 2 === 1;
          while (ents[i + 1]?.type === "VERTEX") { i++; pts.push(ap(m, num(ents[i].g, 10), num(ents[i].g, 20))); }
          if (ents[i + 1]?.type === "SEQEND") i++;
          if (closed && pts.length > 2) pts.push(pts[0]);
          if (pts.length > 1) { lines.push(pts); budget -= pts.length; }
          break;
        }
        case "SPLINE": {
          const xs = g.filter((p) => p[0] === 10).map((p) => parseFloat(p[1])), ys = g.filter((p) => p[0] === 20).map((p) => parseFloat(p[1]));
          const pts = xs.map((x, k) => ap(m, x, ys[k] ?? 0));
          if (pts.length > 1) { lines.push(pts); budget -= pts.length; }
          break;
        }
        case "CIRCLE": case "ARC": {
          const cx = num(g, 10), cy = num(g, 20), r = num(g, 40);
          const a0 = e.type === "ARC" ? num(g, 50) : 0;
          let a1 = e.type === "ARC" ? num(g, 51) : 360;
          if (a1 < a0) a1 += 360;
          const n = Math.max(6, Math.ceil((a1 - a0) / 10));
          const pts: Pt[] = [];
          for (let k = 0; k <= n; k++) { const t = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180; pts.push(ap(m, cx + r * Math.cos(t), cy + r * Math.sin(t))); }
          lines.push(pts);
          budget -= pts.length;
          break;
        }
        case "TEXT": case "MTEXT": case "ATTRIB": {
          let t = str(g, 1);
          if (e.type === "MTEXT") t = g.filter((p) => p[0] === 3).map((p) => p[1]).join("") + t;
          t = cleanText(t);
          if (t) texts.push({ at: ap(m, num(g, 10), num(g, 20)), text: t.slice(0, 80), height: num(g, 40, 100) * Math.hypot(m[0], m[1]) });
          break;
        }
        case "INSERT": case "DIMENSION": {
          const b = blocks.get(str(g, 2));
          if (!b || depth > 6) break;
          if (e.type === "DIMENSION") { draw(b.ents, m, depth + 1); break; }
          const sx = num(g, 41, 1), sy = num(g, 42, 1), rot = (num(g, 50) * Math.PI) / 180;
          const cols = Math.max(1, num(g, 70, 1)), rowsN = Math.max(1, num(g, 71, 1)), dc = num(g, 44), dr = num(g, 45);
          for (let cI = 0; cI < Math.min(cols, 50); cI++) for (let rI = 0; rI < Math.min(rowsN, 50); rI++) {
            const c = Math.cos(rot), s = Math.sin(rot);
            const place: M = [c * sx, s * sx, -s * sy, c * sy, num(g, 10) + c * cI * dc - s * rI * dr, num(g, 20) + s * cI * dc + c * rI * dr];
            draw(b.ents, mul(m, mul(place, [1, 0, 0, 1, -b.base[0], -b.base[1]])), depth + 1);
          }
          break;
        }
      }
    }
  };
  // into plan millimetres, y down
  draw(entities(sections.get("ENTITIES") ?? []), [unitsMm, 0, 0, -unitsMm, 0, 0], 0);

  const all = lines.flat();
  if (!all.length) throw new Error("This DXF has no drawing in it that I can read.");
  // ignore far-away stray points when framing the drawing
  const xs = all.map((p) => p[0]).sort((a, b) => a - b), ys = all.map((p) => p[1]).sort((a, b) => a - b);
  const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * f)))];
  const [x0, x1, y0, y1] = [q(xs, 0.002), q(xs, 0.998), q(ys, 0.002), q(ys, 0.998)];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.03;
  const bounds: DxfDrawing["bounds"] = [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  const inB = (p: Pt) => p[0] >= bounds[0] && p[0] <= bounds[2] && p[1] >= bounds[1] && p[1] <= bounds[3];
  return { lines: lines.filter((l) => l.some(inB)), texts: texts.filter((t) => inB(t.at)), bounds, unitsMm };
}
