"use client";
// One wall of a room seen from the side, standing in the room and facing it: its doors and windows at
// their real size and height, and the furniture standing against it, dragged along the wall to where they
// really are. Doors and windows can be added and resized here. Everything is written back to the sketch, so the plan above moves with it.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Pt } from "@/lib/plan/types";
import type { SketchDoor, SketchFixture, SketchFloor, SketchWindow } from "@/lib/plan/sketch";
import { CATALOG, bottomOf, topOf } from "@/lib/plan/catalog";
import { RULES } from "@/lib/plan/rules";
import { faceOf, fillWall, fitOnFace } from "@/lib/plan/cabinetLayout";
import { famOf } from "@/lib/plan/cabinets";
import { TRAY_DRAG } from "./CatalogTray";
import { CabinetFront } from "./CabinetFront";
import { fmtLen, parseLength, roundLen, type Units } from "@/lib/plan/units";
import { doorSpot, doorWall, doorWidth, edgesOf, outsidePieces, param, pointInPoly, sameLine, segLen, sideOf, wallAt, windowSpots, windowWall, type Seg } from "@/lib/plan/sketchEdit";

import { BALCONY_DEPTH, DOOR_KINDS, DOOR_W, WIN, doorHeight } from "@/lib/plan/standard";

export { DOOR_W };
const doorH = (d: SketchDoor) => doorHeight(d.kind ?? "door", d.height_mm);
type Item = { t: "door" | "thing"; i: number; x0: number; x1: number } | { t: "window"; i: number; k: number; x0: number; x1: number };
const same = (a: Item, b: Item) => a.t === b.t && a.i === b.i && (a.t !== "window" || (b.t === "window" && a.k === b.k));
const OPP: Record<string, string> = { north: "south", south: "north", east: "west", west: "east" };
/** appliances and fixtures that stand in a cabinet run like a cabinet */
const RUN = new Set(["range", "cooktop", "oven", "dishwasher", "fridge", "range_hood", "kitchen_sink", "washing_machine", "dryer"]);

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

export function WallView({ floor, room, edge, height = RULES.ceiling as number, units = "ft", addOnOpen, onAdded, onChange, onClose, onEdge, armed, onPlace, nums }: {
  /** each item's number in its room (lib/plan/numbers.ts) */
  nums?: Map<SketchFixture, number>;
  floor: SketchFloor; room: number; edge: number; height?: number; units?: Units;
  /** add this as soon as the wall opens (picked from the plan's Doors & windows menu) */
  addOnOpen?: "balcony" | null; onAdded?: () => void;
  /** `history`: false while dragging (the change before the drag was already kept for undo) */
  onChange: (f: SketchFloor, history?: boolean) => void; onClose: () => void; onEdge: (e: number) => void;
  /** the name of what the furniture tray has picked, when it's open: dropped or clicked onto this wall */
  armed?: string | null;
  /** put the tray's pick on this wall: `x` from the wall's left end, its middle `mid` mm off the floor */
  onPlace?: (x: number, mid: number) => void;
}) {
  const r = floor.rooms[room];
  const m = (mm: number) => fmtLen(mm, units);
  const wall = useMemo(() => wallFromInside(r.polygon, edge), [r.polygon, edge]);
  const L = segLen(wall);
  const at = (x: number): Pt => [wall[0][0] + ((wall[1][0] - wall[0][0]) * x) / L, wall[0][1] + ((wall[1][1] - wall[0][1]) * x) / L];
  const xOf = (p: Pt) => param(p, wall) * L;
  const side = sideOf(r.polygon, edgesOf(r.polygon)[edge]);
  // the way out through this wall
  const outward = useMemo((): Pt => {
    const ux = (wall[1][0] - wall[0][0]) / L, uy = (wall[1][1] - wall[0][1]) / L, mid = at(L / 2);
    return pointInPoly([mid[0] + uy * 30, mid[1] - ux * 30], r.polygon) ? [-uy, ux] : [uy, -ux];
  }, [wall]); // eslint-disable-line react-hooks/exhaustive-deps

  // what is on this wall
  const items = useMemo(() => {
    const out: Item[] = [];
    const on = (s: Seg | null) => !!s && sameLine(s, wall) && (() => { const c = (xOf(s[0]) + xOf(s[1])) / 2; return c > 0 && c < L; })();
    (floor.doors ?? []).forEach((d, i) => { const s = doorSpot(floor, d); if (s && on(s)) { const [p, q] = [xOf(s[0]), xOf(s[1])].sort((a, b) => a - b); out.push({ t: "door", i, x0: p, x1: q }); } });
    (floor.windows ?? []).forEach((w, i) => windowSpots(floor, w).forEach((s, k) => { if (on(s)) { const [p, q] = [xOf(s[0]), xOf(s[1])].sort((a, b) => a - b); out.push({ t: "window", i, k, x0: p, x1: q }); } }));
    return out;
  }, [floor, wall]); // eslint-disable-line react-hooks/exhaustive-deps
  // furniture standing against this wall (its back within a hand's width of it)
  const inward: Pt = [-outward[0], -outward[1]];
  const along = (f: SketchFixture) => { const back = !f.facing || f.facing === OPP[side] || f.facing === side; return back ? [f.width_mm ?? 600, f.depth_mm ?? 600] : [f.depth_mm ?? 600, f.width_mm ?? 600]; };
  const offOf = (c: Pt) => (c[0] - wall[0][0]) * inward[0] + (c[1] - wall[0][1]) * inward[1];
  const things = useMemo(() => (floor.fixtures ?? []).flatMap((f, i): Item[] => {
    const [w, d] = along(f), x = xOf(f.center), off = offOf(f.center);
    if (off < 0 || off > d / 2 + 150 || x < 0 || x > L || CATALOG[f.kind]?.mount === "ceiling") return [];
    if (f.room && f.room.toLowerCase() !== r.name.toLowerCase()) return [];
    return [{ t: "thing", i, x0: x - w / 2, x1: x + w / 2 }];
  }), [floor.fixtures, wall, outward]); // eslint-disable-line react-hooks/exhaustive-deps
  // who is on the other side, along the wall
  const outside = useMemo(() => outsidePieces(floor, room).filter((s) => sameLine(s, wall)).map((s) => [xOf(s[0]), xOf(s[1])].sort((a, b) => a - b) as [number, number]), [floor, room, wall]); // eslint-disable-line react-hooks/exhaustive-deps
  const beyond = useMemo(() => {
    const mid = at(L / 2), probe = wallAt(floor, mid, 40);
    if (!probe || probe.rooms[1] == null) return outside.length ? "outside" : "";
    return floor.rooms[probe.rooms[1]].name;
  }, [floor, wall]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sel, setSel] = useState<Item | null>(null);
  // several picked at once: a box dragged across the wall, or Ctrl-click
  const [group, setGroup] = useState<Item[]>([]);
  const [box, setBox] = useState<{ x0: number; u0: number; x1: number; u1: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ item: Item; from: number; fromY: number; c0: number; b0: number | null; moved: boolean } | null>(null);
  // the group being moved: where each one started, on the floor as it was
  const gdrag = useRef<{ of: SketchFloor; from: number; fromY: number; items: { it: Item; c0: number; b0: number | null }[]; lo: number; hi: number; dn: number; up: number; moved: boolean; hit: Item } | null>(null);
  const pad = 400, H = height + 1200, W = Math.max(L + pad * 2, H * 4);
  // the picture keeps its shape: work out the drawn width from the box's height
  const scale = () => { const b = svg.current!.getBoundingClientRect(); return Math.max(W / b.width, H / b.height); };
  const toX = (e: { clientX: number }) => { const b = svg.current!.getBoundingClientRect(); const k = Math.max(W / b.width, H / b.height); return L / 2 + (e.clientX - (b.left + b.width / 2)) * k; };
  /** how high off the floor a point on the picture is */
  const toUp = (e: { clientY: number }) => { const b = svg.current!.getBoundingClientRect(); const k = Math.max(W / b.width, H / b.height); return -(-H + 350 + H / 2 + (e.clientY - (b.top + b.height / 2)) * k); };
  const dropIn = (e: { clientX: number; clientY: number }) => { const x = toX(e); if (onPlace && x >= 0 && x <= L) onPlace(x, Math.max(0, Math.min(height, toUp(e)))); };

  // what can go up and down the wall: furniture, and windows (their sill)
  const bottomAt = (it: Item) => (it.t === "thing" ? bottomOf(floor.fixtures![it.i]) : it.t === "window" ? floor.windows![it.i].sill_mm ?? WIN.sill : null);
  const tallOf = (it: Item) => (it.t === "thing" ? topOf(floor.fixtures![it.i]) - bottomOf(floor.fixtures![it.i]) : it.t === "window" ? floor.windows![it.i].height_mm ?? WIN.height : 0);
  // floor f with an item moved so its centre sits `c` mm from the left end (and its bottom `bottom` mm off the floor)
  const movedIn = (f: SketchFloor, it: Item, c: number, bottom?: number): SketchFloor => {
    const P = at(Math.max(0, Math.min(L, c)));
    if (it.t === "thing") {
      const x0 = f.fixtures![it.i], off = offOf(x0.center);
      const q: Pt = [Math.round(P[0] + inward[0] * off), Math.round(P[1] + inward[1] * off)];
      const up = bottom == null ? {} : { elevation_mm: bottom || undefined };
      return { ...f, fixtures: f.fixtures!.map((x, i) => (i === it.i ? { ...x, center: q, ...up } : x)) };
    } else if (it.t === "door") {
      const d = f.doors![it.i], ref = doorWall(f, d);
      if (!ref) return f;
      const t = Math.round(Math.max(0, Math.min(1, param(P, ref))) * 1000) / 1000;
      return { ...f, doors: f.doors!.map((x, i) => (i === it.i ? { ...x, at: t } : x)) };
    }
    const w = f.windows![it.i], ref = windowWall(f, w);
    if (!ref) return f;
    const n = Math.max(1, Math.min(4, w.count ?? 1));
    const list = Array.from({ length: n }, (_, k) => w.at?.[k] ?? (k + 1) / (n + 1));
    list[(it as Extract<Item, { t: "window" }>).k] = Math.round(Math.max(0, Math.min(1, param(P, ref))) * 1000) / 1000;
    return { ...f, windows: f.windows!.map((x, i) => (i === it.i ? { ...x, at: list, ...(bottom == null ? {} : { sill_mm: bottom }) } : x)) };
  };
  const moveTo = (it: Item, c: number, history: boolean, bottom?: number) => onChange(movedIn(floor, it, c, bottom), history);
  // how high an item reaches on the wall: [bottom, top] off the floor
  const spanOf = (it: Item): [number, number] => {
    if (it.t === "thing") { const f = floor.fixtures![it.i]; return [bottomOf(f), topOf(f)]; }
    if (it.t === "door") return [0, doorH(floor.doors![it.i])];
    const w = floor.windows![it.i], sill = w.sill_mm ?? WIN.sill;
    return [sill, sill + (w.height_mm ?? WIN.height)];
  };
  /** whether it goes up and down with the group: furniture (not base cabinets) and windows */
  const liftable = (it: Item) => it.t === "window" || (it.t === "thing" && !(floor.fixtures![it.i].cab && famOf(floor.fixtures![it.i].cab!.fam).zone !== "wall"));
  const down = (e: RPointerEvent<SVGElement>, it: Item) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // Ctrl (Cmd on a Mac): add it to the picked ones, or take it off
    if (e.ctrlKey || e.metaKey) {
      const cur = [...group, ...(sel ? [sel] : [])], next = cur.some((x) => same(x, it)) ? cur.filter((x) => !same(x, it)) : [...cur, it];
      if (next.length === 1) { setSel(next[0]); setGroup([]); } else { setSel(null); setGroup(next); }
      return;
    }
    // one of the group: they all move together
    if (group.some((x) => same(x, it))) {
      const live = group.map((g) => [...items, ...things].find((x) => same(x, g))).filter((x): x is Item => !!x);
      const lift = live.filter(liftable);
      gdrag.current = { of: floor, from: toX(e), fromY: e.clientY, items: live.map((x) => ({ it: x, c0: (x.x0 + x.x1) / 2, b0: liftable(x) ? spanOf(x)[0] : null })), moved: false, hit: it,
        // (something already past an end or the ceiling isn't shoved back by picking it up)
        lo: Math.min(0, -Math.min(...live.map((x) => x.x0))), hi: Math.max(0, L - Math.max(...live.map((x) => x.x1))),
        dn: lift.length ? Math.min(0, -Math.min(...lift.map((x) => spanOf(x)[0]))) : 0, up: lift.length ? Math.max(0, Math.min(...lift.map((x) => height - spanOf(x)[1]))) : 0 };
      return;
    }
    setGroup([]);
    setSel(it);
    drag.current = { item: it, from: toX(e), fromY: e.clientY, c0: (it.x0 + it.x1) / 2, b0: bottomAt(it), moved: false };
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (box) { setBox({ ...box, x1: toX(e), u1: toUp(e) }); return; }
    const g = gdrag.current;
    if (g) {
      let dx = toX(e) - g.from, dy = (g.fromY - e.clientY) * scale();
      if (!g.moved && Math.hypot(dx, dy) < 30) return;
      if (!g.moved) { g.moved = true; onChange(g.of, true); } // keep the start for undo
      // the whole group stays on the wall, between the floor and the ceiling
      dx = Math.max(g.lo, Math.min(g.hi, roundLen(dx, units)));
      dy = Math.max(g.dn, Math.min(g.up, roundLen(dy, units)));
      // cabinets and appliances in the group never go through the ones left behind
      const run = (it: Item) => it.t === "thing" && (!!floor.fixtures![it.i].cab || RUN.has(floor.fixtures![it.i].kind));
      const still = things.filter((x) => run(x) && !g.items.some((y) => same(x, y.it)));
      const hit = g.items.find((y) => {
        if (!run(y.it)) return false;
        const lift = y.b0 == null ? 0 : dy, [lo, hi] = spanOf(y.it), b0 = y.b0 ?? lo, b1 = b0 + (hi - lo) + lift;
        const x0 = y.c0 - (y.it.x1 - y.it.x0) / 2 + dx, x1 = x0 + (y.it.x1 - y.it.x0);
        return still.some((s) => { const [slo, shi] = spanOf(s); return s.x0 < x1 - 1 && s.x1 > x0 + 1 && slo < b1 - 1 && shi > b0 + lift + 1; });
      });
      if (hit) { setNote("No room for them there: they'd run into a cabinet."); return; }
      setNote(null);
      onChange(g.items.reduce((f, x) => movedIn(f, x.it, x.c0 + dx, x.b0 == null ? undefined : x.b0 + dy), g.of), false);
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = toX(e) - d.from, dy = (d.fromY - e.clientY) * scale();
    if (!d.moved && Math.hypot(dx, dy) < 30) return;
    if (!d.moved) { d.moved = true; moveTo(d.item, d.c0, true); } // keep the start for undo
    // up and down too, between the floor and the ceiling; it sits on the floor when dropped near it
    let bottom: number | undefined;
    if (d.b0 != null) {
      bottom = Math.max(0, Math.min(height - tallOf(d.item), roundLen(d.b0 + dy, units)));
      if (bottom < 50) bottom = 0;
    }
    let c = roundLen(d.c0 + dx, units);
    // a cabinet or appliance lines up with its neighbours and never goes through one; a base cabinet stays on the floor
    const f = d.item.t === "thing" ? floor.fixtures![d.item.i] : null;
    if (f && d.item.t === "thing" && (f.cab || RUN.has(f.kind))) {
      if (f.cab && famOf(f.cab.fam).zone !== "wall") bottom = undefined;
      const fc = faceOf(floor, room, edge);
      if (fc) {
        const w = d.item.x1 - d.item.x0, z = bottom ?? bottomOf(f), h = topOf(f) - bottomOf(f);
        const fit = fitOnFace(floor, fc, c, w, z, h, d.item.i, f.depth_mm ?? 600);
        if (!("x" in fit)) { setNote(`No room for it there: ${m(fit.room)} free.`); return; }
        c = fit.x;
        setNote(null);
      }
    }
    moveTo(d.item, c, false, bottom);
  };
  const up = () => {
    drag.current = null;
    const g = gdrag.current;
    gdrag.current = null;
    // a plain click on one of the group picks just that one
    if (g && !g.moved) { setGroup([]); setSel(g.hit); }
    if (box) {
      const b = box;
      setBox(null);
      const [x0, x1] = [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1)], [u0, u1] = [Math.min(b.u0, b.u1), Math.max(b.u0, b.u1)];
      if (x1 - x0 < 60 && u1 - u0 < 60) return;
      // everything the box touches
      const got = [...things, ...items].filter((it) => { const [lo, hi] = spanOf(it); return it.x0 <= x1 && it.x1 >= x0 && lo <= u1 && hi >= u0; });
      if (got.length === 1) { setGroup([]); setSel(got[0]); } else { setSel(null); setGroup(got); }
    }
  };
  // take out every item in the group in one go
  const removeGroup = () => {
    const ids = (t: Item["t"]) => new Set(group.filter((x) => x.t === t).map((x) => x.i));
    const fx = ids("thing"), ds = ids("door");
    const windows = (floor.windows ?? []).flatMap((w, i) => {
      const ks = new Set(group.filter((x) => x.t === "window" && x.i === i).map((x) => (x as { k: number }).k));
      if (!ks.size) return [w];
      const n = Math.max(1, Math.min(4, w.count ?? 1)), spots = Array.from({ length: n }, (_, k) => w.at?.[k] ?? (k + 1) / (n + 1)).filter((_, k) => !ks.has(k));
      return spots.length ? [{ ...w, count: spots.length, at: spots }] : [];
    });
    onChange({ ...floor, fixtures: (floor.fixtures ?? []).filter((_, i) => !fx.has(i)), doors: (floor.doors ?? []).filter((_, i) => !ds.has(i)), windows });
    setGroup([]);
  };

  // the middle of the widest stretch of wall with nothing on it, within [lo, hi]
  const freeAt = (lo: number, hi: number) => {
    const taken = items.map((x) => [x.x0, x.x1] as [number, number]).filter(([a, b]) => b > lo && a < hi).sort((a, b) => a[0] - b[0]);
    let best: [number, number] = [lo, lo], cur = lo;
    for (const [a, b] of [...taken, [hi, hi] as [number, number]]) { if (a - cur > best[1] - best[0]) best = [cur, a]; cur = Math.max(cur, b); }
    return (best[0] + best[1]) / 2;
  };
  const add = (kind: "door" | "window" | "balcony", doorKind: NonNullable<SketchDoor["kind"]> = "door") => {
    setNote(null);
    if (kind === "balcony") {
      const free = [...outside].sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
      if (!free || free[1] - free[0] < 1200) { setNote("A balcony or patio door goes on an outside wall."); return; }
      // on the ground floor it's a patio door out to the garden
      if (floor.level <= 0) { add("door", "sliding_door"); return; }
      // upstairs: a balcony outside the wall, with a patio door onto it
      const wide = Math.min(3600, free[1] - free[0]), x0 = (free[0] + free[1]) / 2 - wide / 2;
      const p0 = at(x0), p1 = at(x0 + wide), off = (p: Pt): Pt => [Math.round((p[0] + outward[0] * BALCONY_DEPTH) / 10) * 10, Math.round((p[1] + outward[1] * BALCONY_DEPTH) / 10) * 10];
      const r10 = (p: Pt): Pt => [Math.round(p[0] / 10) * 10, Math.round(p[1] / 10) * 10];
      const poly = [r10(p0), r10(p1), off(p1), off(p0)];
      const mid: Pt = [(poly[0][0] + poly[2][0]) / 2, (poly[0][1] + poly[2][1]) / 2];
      if (floor.rooms.some((x) => pointInPoly(mid, x.polygon))) { setNote("There's already a room outside this wall."); return; }
      const names = new Set(floor.rooms.map((x) => x.name.toLowerCase()));
      let name = "Balcony";
      for (let k = 2; names.has(name.toLowerCase()); k++) name = `Balcony ${k}`;
      onChange({ ...floor, rooms: [...floor.rooms, { name, type: "balcony", polygon: poly }],
        doors: [...(floor.doors ?? []), { rooms: [r.name, name], kind: "sliding_door", width_mm: Math.min(DOOR_W.sliding_door, wide - 400), at: 0.5 }] });
      setSel({ t: "door", i: (floor.doors ?? []).length, x0: 0, x1: 0 });
      return;
    }
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
        const nw: SketchWindow = { room: r.name, side, count: 1, width_mm: WIN.width, height_mm: WIN.height, sill_mm: WIN.sill };
        // in the widest free stretch, measured along the wall the window will be built on
        const ref = windowWall(floor, nw);
        if (ref) nw.at = [Math.round(Math.max(0, Math.min(1, param(at(freeAt(free[0], free[1])), ref))) * 1000) / 1000];
        onChange({ ...floor, windows: [...list, nw] });
        setSel({ t: "window", i: list.length, k: 0, x0: 0, x1: 0 });
      }
      return;
    }
    // a door in the middle of the free stretch: to the room next door, or outside
    const mid = at(freeAt(0, L)), w = wallAt(floor, mid, 40);
    if (!w) { setNote("Couldn't find this wall. Try again from the plan."); return; }
    const t = Math.round(w.t * 100) / 100;
    const door: SketchDoor = w.rooms[1] == null ? { rooms: [r.name, "outside"], side, at: t, kind: doorKind }
      : { rooms: [r.name, floor.rooms[w.rooms[1]].name], at: t, kind: doorKind };
    if (doorKind !== "door") door.width_mm = DOOR_W[doorKind];
    onChange({ ...floor, doors: [...(floor.doors ?? []), door] });
    setSel({ t: "door", i: (floor.doors ?? []).length, x0: 0, x1: 0 });
  };
  useEffect(() => {
    if (!addOnOpen) return;
    add(addOnOpen);
    onAdded?.();
  }, [addOnOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = () => {
    if (!sel) return;
    if (sel.t === "thing") { onChange({ ...floor, fixtures: floor.fixtures!.filter((_, i) => i !== sel.i) }); setSel(null); return; }
    if (sel.t === "door") onChange({ ...floor, doors: floor.doors!.filter((_, i) => i !== sel.i) });
    else if (sel.t === "window") {
      const w = floor.windows![sel.i], n = Math.max(1, Math.min(4, w.count ?? 1));
      if (n <= 1) onChange({ ...floor, windows: floor.windows!.filter((_, i) => i !== sel.i) });
      else {
        const spots = Array.from({ length: n }, (_, k) => w.at?.[k] ?? (k + 1) / (n + 1)).filter((_, k) => k !== sel.k);
        onChange({ ...floor, windows: floor.windows!.map((x, i) => (i === sel.i ? { ...x, count: n - 1, at: spots } : x)) });
      }
    }
    setSel(null);
  };
  const selDoor = sel?.t === "door" ? floor.doors![sel.i] : null, selWin = sel?.t === "window" ? floor.windows![sel.i] : null;
  const width = selDoor ? doorWidth(selDoor) : selWin ? selWin.width_mm ?? WIN.width : 0;
  const tall = selDoor ? doorH(selDoor) : selWin ? selWin.height_mm ?? WIN.height : 0;
  const setDoor = (ch: Partial<SketchDoor>) => sel && onChange({ ...floor, doors: floor.doors!.map((x, i) => (i === sel.i ? { ...x, ...ch } : x)) }, false);
  const setWin = (ch: Partial<SketchWindow>) => sel && onChange({ ...floor, windows: floor.windows!.map((x, i) => (i === sel.i ? { ...x, ...ch } : x)) }, false);
  const setWidth = (v: number) => { if (v > 200) (selDoor ? setDoor : setWin)({ width_mm: v }); };
  const setTall = (v: number) => { if (v > 200 && v <= height) (selDoor ? setDoor : setWin)({ height_mm: v }); };
  const selThing = sel?.t === "thing" ? floor.fixtures![sel.i] : null;
  const setThing = (ch: Partial<SketchFixture>) => sel && onChange({ ...floor, fixtures: floor.fixtures!.map((x, i) => (i === sel.i ? { ...x, ...ch } : x)) }, false);
  const cur = sel && [...items, ...things].find((x) => same(x, sel));
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
          <button className="btn btn-sm" title="Stock base and wall cabinets from corner to corner, around doors, windows and appliances" onClick={() => { const r = fillWall(floor, room, edge, { base: true, wall: true }); setNote(r.note ?? null); if (r.floor) onChange(r.floor); }}>Fill with cabinets</button>
          <button className="btn btn-sm" onClick={() => add("balcony")} title={floor.level <= 0 ? "A patio door out to the garden" : "A balcony outside this wall, with a patio door onto it"}>{floor.level <= 0 ? "+ Patio door" : "+ Balcony"}</button>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close the wall view">✕</button>
        </span>
      </div>
      <svg ref={svg} viewBox={`${L / 2 - W / 2} ${-H + 350} ${W} ${H}`} className={`w-full h-[220px] touch-none select-none bg-ink ${armed ? "cursor-copy" : ""}`} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onPointerDown={(e) => {
          if (armed) { setSel(null); dropIn(e); return; }
          // from empty wall: drag a box to pick several (Ctrl keeps what's picked)
          if (!(e.ctrlKey || e.metaKey)) { setSel(null); setGroup([]); }
          (e.target as Element).setPointerCapture?.(e.pointerId);
          const x = toX(e), u = toUp(e);
          setBox({ x0: x, u0: u, x1: x, u1: u });
        }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(TRAY_DRAG)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
        onDrop={(e) => { if (!e.dataTransfer.types.includes(TRAY_DRAG)) return; e.preventDefault(); dropIn(e); }}>
        <rect x={0} y={-height} width={L} height={height} fill="#e3d9c6" stroke="#0a0a0b" strokeWidth={20} />
        {outside.map(([a, b], k) => <rect key={k} x={a} y={-height} width={b - a} height={height} fill="#d6c9b0" />)}
        <line x1={-pad} y1={0} x2={L + pad} y2={0} stroke="#9c978d" strokeWidth={20} />
        {things.map((it) => {
          const f = floor.fixtures![it.i], b = bottomOf(f), t = topOf(f), on = (!!sel && same(it, sel)) || group.some((x) => same(x, it)), label = `${nums?.has(f) ? `#${nums.get(f)} ` : ""}${f.name || CATALOG[f.kind]?.label || f.kind}`;
          return (
            <g key={`f${it.i}`} onPointerDown={(e) => down(e, it)} style={{ cursor: "move" }}>
              {f.cab ? <CabinetFront f={f} x0={it.x0} x1={it.x1} on={on} fs={fs} /> : <>
              <rect x={it.x0} y={-t} width={it.x1 - it.x0} height={t - b} fill={CATALOG[f.kind]?.fill ?? "#b9a27e"} fillOpacity={0.9} stroke={on ? "#ff6a1f" : "#0a0a0b"} strokeWidth={on ? 40 : 14} />
              <text x={(it.x0 + it.x1) / 2} y={-(b + t) / 2} fontSize={Math.min(fs * 0.7, (it.x1 - it.x0) / (label.length * 0.62))} textAnchor="middle" dominantBaseline="middle" fill="#0a0a0b" style={{ pointerEvents: "none" }}>{label}</text>
              </>}
            </g>
          );
        })}
        {items.map((it, k) => {
          const on = (!!sel && same(it, sel)) || group.some((x) => same(x, it));
          const w = it.x1 - it.x0;
          return it.t === "door" ? (
            <g key={k} onPointerDown={(e) => down(e, it)} style={{ cursor: "ew-resize" }}>
              {(() => {
                const d = floor.doors![it.i], h = doorH(d), k = d.kind ?? "door";
                return (
                  <>
                    <rect x={it.x0} y={-h} width={w} height={h} fill={k === "opening" ? "#2a2c30" : k === "sliding_door" ? "#8fd3f0" : k === "garage_door" ? "#9c978d" : "#8a6a48"} stroke={on ? "#ff6a1f" : "#0a0a0b"} strokeWidth={on ? 40 : 16} />
                    {k === "sliding_door" && <line x1={(it.x0 + it.x1) / 2} y1={-h} x2={(it.x0 + it.x1) / 2} y2={0} stroke="#0a0a0b" strokeWidth={12} />}
                    {k === "double_door" && <line x1={(it.x0 + it.x1) / 2} y1={-h} x2={(it.x0 + it.x1) / 2} y2={0} stroke="#0a0a0b" strokeWidth={10} />}
                    {(k === "door" || k === "double_door") && <circle cx={it.x1 - 90} cy={-1000} r={30} fill="#efe8da" />}
                  </>
                );
              })()}
            </g>
          ) : (
            <g key={k} onPointerDown={(e) => down(e, it)} style={{ cursor: "move" }}>
              {(() => {
                const wn = floor.windows![it.i], sill = wn.sill_mm ?? WIN.sill, top = sill + (wn.height_mm ?? WIN.height);
                return (
                  <>
                    <rect x={it.x0} y={-top} width={w} height={top - sill} fill="#8fd3f0" stroke={on ? "#ff6a1f" : "#0a0a0b"} strokeWidth={on ? 40 : 16} />
                    <line x1={(it.x0 + it.x1) / 2} y1={-top} x2={(it.x0 + it.x1) / 2} y2={-sill} stroke="#0a0a0b" strokeWidth={12} />
                  </>
                );
              })()}
            </g>
          );
        })}
        {/* the wall's length, and where the picked door or window sits */}
        <text x={L / 2} y={260} fontSize={fs} textAnchor="middle" fill="#9c978d">{m(L)}</text>
        {cur && (
          <g fill="#ff6a1f" fontSize={fs}>
            {/* a gap too narrow for its number goes without (the box below says it) */}
            {cur.x0 > fs * 3.5 && <text x={cur.x0 / 2} y={-height - 80} textAnchor="middle">{m(cur.x0)}</text>}
            <text x={(cur.x0 + cur.x1) / 2} y={-height - 80 - fs * 1.1} textAnchor="middle">{m(cur.x1 - cur.x0)} wide</text>
            {L - cur.x1 > fs * 3.5 && <text x={(cur.x1 + L) / 2} y={-height - 80} textAnchor="middle">{m(L - cur.x1)}</text>}
          </g>
        )}
        {box && (() => {
          const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), u0 = Math.min(box.u0, box.u1), u1 = Math.max(box.u0, box.u1);
          return <rect x={x0} y={-u1} width={x1 - x0} height={u1 - u0} fill="#55b2ff" fillOpacity={0.12} stroke="#55b2ff" strokeWidth={14} strokeDasharray="60 36" style={{ pointerEvents: "none" }} />;
        })()}
        {!items.length && !things.length && <text x={L / 2} y={-height / 2} fontSize={fs} textAnchor="middle" fill="#6e6a62">Nothing on this wall yet</text>}
      </svg>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px] min-h-[44px]">
        {note && <span className="text-amber">{note}</span>}
        {armed && !sel && !note && <span className="text-accent">Drag {armed} from the furniture list onto this wall, or click the wall where it goes. Then drag it along the wall, and up or down.</span>}
        {!armed && !sel && !group.length && !note && <span className="text-muted">Drag a door, window or piece of furniture along the wall (windows and furniture up and down too). Pick one to change its size or remove it. Drag a box across the wall to pick several and move them together.</span>}
        {group.length > 0 && (
          <>
            <span className="font-medium">{group.length} picked</span>
            <span className="text-muted">Drag any of them to move them all together. Ctrl-click adds or takes one off.</span>
            <button className="btn btn-sm btn-ghost ml-auto" onClick={() => setGroup([])}>Clear</button>
            <button className="btn btn-sm btn-ghost text-red" onClick={removeGroup}>Remove all {group.length}</button>
          </>
        )}
        {selThing && (
          <>
            <span className="font-medium">{nums?.has(selThing) ? `#${nums.get(selThing)} ` : ""}{selThing.name || CATALOG[selThing.kind]?.label || selThing.kind}</span>
            <Len label="Width" mm={selThing.width_mm ?? 600} units={units} onStart={() => onChange(floor)} onSet={(v) => v >= 100 && setThing({ width_mm: v })} />
            <Len label="Height" mm={topOf(selThing) - bottomOf(selThing)} units={units} onStart={() => onChange(floor)} onSet={(v) => v >= 50 && bottomOf(selThing) + v <= height && setThing({ height_mm: v })} />
            <Len label="Off the floor" mm={bottomOf(selThing)} units={units} onStart={() => onChange(floor)} onSet={(v) => topOf(selThing) - bottomOf(selThing) + v <= height && setThing({ elevation_mm: v || undefined })} />
            {cur && <Len label="From the left" mm={cur.x0} units={units} onStart={() => onChange(floor)} onSet={(v) => moveTo(cur, v + (cur.x1 - cur.x0) / 2, false)} />}
            <button className="btn btn-sm btn-ghost text-red ml-auto" onClick={remove}>Remove</button>
          </>
        )}
        {sel && !selThing && (
          <>
            {selDoor ? (
              <select className="input !h-8 !w-auto" value={selDoor.kind ?? "door"} aria-label="Kind of door" onFocus={() => onChange(floor)}
                onChange={(e) => { const k = e.target.value as NonNullable<SketchDoor["kind"]>; setDoor({ kind: k, width_mm: DOOR_W[k], height_mm: undefined }); }}>
                {DOOR_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            ) : <span className="font-medium">Window</span>}
            <Len label="Width" mm={width} units={units} onStart={() => onChange(floor)} onSet={setWidth} />
            <Len label="Height" mm={tall} units={units} onStart={() => onChange(floor)} onSet={setTall} />
            {selWin && <Len label="Off the floor" mm={selWin.sill_mm ?? WIN.sill} units={units} onStart={() => onChange(floor)} onSet={(v) => v + (selWin.height_mm ?? WIN.height) <= height && setWin({ sill_mm: v })} />}
            {cur && <Len label="From the left" mm={cur.x0} units={units} onStart={() => onChange(floor)} onSet={(v) => moveTo(cur, v + (cur.x1 - cur.x0) / 2, false)} />}
            {selWin && (selWin.count ?? 1) > 1 && <span className="text-muted">Same size for all windows of this room on this side.</span>}
            <span className="text-muted">{"Depth: the wall's thickness."}</span>
            <button className="btn btn-sm btn-ghost text-red ml-auto" onClick={remove}>Remove</button>
          </>
        )}
      </div>
    </section>
  );
}

/** A length typed in feet and inches (or metres); set on Enter or when you leave the box, to the nearest ½ inch (or cm). */
export function Len({ label, mm, units, onStart, onSet }: { label: string; mm: number; units: Units; onStart: () => void; onSet: (mm: number) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted">{label}</span>
      <input key={`${Math.round(mm)}${units}`} className="input !h-8 !w-[88px]" defaultValue={fmtLen(mm, units, true)} onFocus={onStart} aria-label={label}
        onBlur={(e) => { const v = parseLength(e.target.value, units); if (v != null) onSet(roundLen(v, units)); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
    </label>
  );
}
