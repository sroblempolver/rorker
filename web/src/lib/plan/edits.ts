// Changes made in the app (an object moved, resized, renamed, given a product link) applied on top of
// the plan as read, so every view draws the job as it is now.
import type { ElementEdit } from "@/lib/data/types";
import type { Fixture, Plan, Pt } from "./types";

/** Which plan axis a fixture's width runs along: across its front when it faces somewhere. */
export function widthAxis(f: Fixture): "x" | "y" {
  if (f.facing == null) return f.bbox[2] - f.bbox[0] >= f.bbox[3] - f.bbox[1] ? "x" : "y";
  const a = ((f.facing % 360) + 360) % 360;
  return (a > 45 && a < 135) || (a > 225 && a < 315) ? "x" : "y";
}

export function fixtureSize(f: Fixture) {
  const ax = widthAxis(f);
  const wx = f.bbox[2] - f.bbox[0], wy = f.bbox[3] - f.bbox[1];
  return { width: ax === "x" ? wx : wy, depth: ax === "x" ? wy : wx };
}

function editFixture(f: Fixture, e: ElementEdit): Fixture {
  const out: Fixture = { ...f };
  const { width, depth } = fixtureSize(f);
  const ax = widthAxis(f);
  const sw = e.width ? e.width / width : 1, sd = e.depth ? e.depth / depth : 1;
  const sx = ax === "x" ? sw : sd, sy = ax === "x" ? sd : sw;
  // resize about the back edge when it faces somewhere (so it stays against its wall), else the centre
  let ox = f.center[0], oy = f.center[1];
  if (f.facing != null && (sx !== 1 || sy !== 1)) {
    const r = (f.facing * Math.PI) / 180, nx = Math.round(Math.cos(r)), ny = Math.round(Math.sin(r));
    if (nx) ox = nx > 0 ? f.bbox[0] : f.bbox[2];
    if (ny) oy = ny > 0 ? f.bbox[1] : f.bbox[3];
  }
  const dx = e.dx ?? 0, dy = e.dy ?? 0;
  const tp = (p: Pt): Pt => [ox + (p[0] - ox) * sx + dx, oy + (p[1] - oy) * sy + dy];
  if (dx || dy || sx !== 1 || sy !== 1) {
    const a = tp([f.bbox[0], f.bbox[1]]), b = tp([f.bbox[2], f.bbox[3]]);
    out.bbox = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    out.center = tp(f.center);
    out.outline = f.outline.map((ln) => ln.map(tp));
  }
  if (e.dz) out.elevation_mm = Math.max(0, (f.elevation_mm ?? 0) + e.dz);
  if (e.height_mm) out.height_mm = e.height_mm;
  if (e.name) out.name = e.name;
  if (e.kind) out.kind = e.kind;
  if (e.spec) out.spec = e.spec;
  if (e.product_name) out.product_name = e.product_name;
  if (e.product_url) out.product_url = e.product_url;
  if (e.notes) out.notes = e.notes;
  return out;
}

export function applyEdits(plan: Plan, edits: Record<string, ElementEdit>): Plan {
  if (!Object.keys(edits).length) return plan;
  return {
    ...plan,
    floors: plan.floors.map((fl) => ({
      ...fl,
      fixtures: fl.fixtures.map((f) => (edits[f.id] ? editFixture(f, edits[f.id]) : f)),
      rooms: fl.rooms.map((r) => {
        const e = edits[r.id];
        if (!e) return r;
        return { ...r, name: e.name || r.name, type: (e.type as typeof r.type) || r.type, notes: e.notes ?? r.notes, label_source: e.name || e.type ? "contractor" : r.label_source };
      }),
    })),
  };
}
