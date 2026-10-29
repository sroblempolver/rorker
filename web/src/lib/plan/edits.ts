// Changes made in the app (an object moved, resized, renamed, given a product link) applied on top of
// the plan as read, so every view draws the job as it is now.
import type { AddedObject, ElementEdit } from "@/lib/data/types";
import { arrange, linkSupports } from "./arrange";
import { applyHouseEdits } from "./house";
import type { Fixture, Plan, Pt } from "./types";

/** An object added in the app, as a plan fixture: width across its front, depth front to back. */
export function addedFixture(id: string, a: AddedObject): Fixture {
  const f = a.facing == null ? null : ((a.facing % 360) + 360) % 360;
  const across = f != null && (f < 45 || f > 315 || (f > 135 && f < 225)); // facing east or west: width runs north-south
  const hx = (across ? a.depth : a.width) / 2, hy = (across ? a.width : a.depth) / 2;
  const [cx, cy] = a.center;
  const bbox: [number, number, number, number] = [cx - hx, cy - hy, cx + hx, cy + hy];
  return {
    id, kind: a.kind, name: a.name, room_id: a.room_id, center: [cx, cy], bbox, rotation: 0, source: "app", source_ref: null, confidence: 1,
    outline: [[[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]]]],
    facing: a.facing, height_mm: a.height_mm ?? null, elevation_mm: a.elevation_mm ?? 0, weight_kg: a.weight_kg ?? null,
    parts: a.parts ?? null, on: a.on ?? null, on_at: a.on_at ?? null,
  };
}

/** Turn a fixture to face another way, keeping its centre, width and depth. */
function turned(f: Fixture, facing: number): Fixture {
  const { width, depth } = fixtureSize(f);
  return { ...addedFixture(f.id, { floor_id: "", room_id: f.room_id, kind: f.kind, name: f.name, center: f.center, width, depth, facing, height_mm: f.height_mm }), ...pick(f), facing };
}
const pick = (f: Fixture) => ({ source: f.source, source_ref: f.source_ref, confidence: f.confidence, elevation_mm: f.elevation_mm, front: f.front, spec: f.spec, product_name: f.product_name, product_url: f.product_url, notes: f.notes, weight_kg: f.weight_kg, parts: f.parts, on: f.on, on_at: f.on_at });

/** Which plan axis a fixture's width runs along: across its front when it faces somewhere. */
export function widthAxis(f: Fixture): "x" | "y" {
  if (f.facing == null) return f.bbox[2] - f.bbox[0] >= f.bbox[3] - f.bbox[1] ? "x" : "y";
  const a = ((f.facing % 360) + 360) % 360;
  return (a > 45 && a < 135) || (a > 225 && a < 315) ? "x" : "y";
}

/** Which way it faces after turning it `deg` degrees clockwise on the plan (90, 180, 270): 0 east, 90 south, 180 west, -90 north. */
export function turnedFacing(f: Fixture, deg: number): number {
  const now = f.facing ?? (widthAxis(f) === "x" ? 90 : 0);
  const a = (((Math.round(now / 90) * 90 + deg) % 360) + 360) % 360;
  return a === 270 ? -90 : a;
}

export function fixtureSize(f: Fixture) {
  const ax = widthAxis(f);
  const wx = f.bbox[2] - f.bbox[0], wy = f.bbox[3] - f.bbox[1];
  return { width: ax === "x" ? wx : wy, depth: ax === "x" ? wy : wx };
}

function editFixture(f0: Fixture, e: ElementEdit): Fixture {
  const f = e.facing != null && e.facing !== f0.facing ? turned(f0, e.facing) : f0;
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

export function applyEdits(drawn: Plan, edits: Record<string, ElementEdit>): Plan {
  // the house first (walls moved, rooms cut, doors and windows), then what's in it
  const plan = linkSupports(applyHouseEdits(drawn, edits));
  if (!Object.keys(edits).length) return arrange(plan);
  return arrange({
    ...plan,
    floors: plan.floors.map((fl) => ({
      ...fl,
      fixtures: [
        ...fl.fixtures.filter((f) => !edits[f.id]?.removed),
        ...Object.entries(edits).filter(([, e]) => e.added?.floor_id === fl.id).map(([id, e]) => addedFixture(id, e.added!)),
      ].map((f) => (edits[f.id] ? editFixture(f, edits[f.id]) : f)),
      rooms: fl.rooms.map((r) => {
        const e = edits[r.id];
        if (!e) return r;
        return { ...r, name: e.name || r.name, type: (e.type as typeof r.type) || r.type, notes: e.notes ?? r.notes, label_source: e.name || e.type ? "contractor" : r.label_source };
      }),
    })),
  });
}
