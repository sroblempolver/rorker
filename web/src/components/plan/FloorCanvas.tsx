"use client";
// One floor of the plan as a live, game-like map. At floor level a click on a room flies into it;
// inside a room, walls get their own markers so you can step up to the wall view. Everything that has
// an ID can be clicked, carries a status colour, and can hold pins.
import { useEffect, useMemo, useRef, useState } from "react";
import type { JobItem, Pin, PinInput } from "@/lib/data/types";
import { bboxOf, centroid, unionBBox, edgeDistance, elementCenter, findElement, floorBBox, footprint, labelPoint, lineD, pathD, pointInPoly, roomOf, roomSides, sidePoint, type WallSide } from "@/lib/plan/geometry";
import type { BBox, ElementStatus, Fixture, Floor, Opening, Plan, Pt, Room } from "@/lib/plan/types";
import { CHALK, CHALK_LINE, DRYWALL, FIXTURE_STROKE, GLASS, GROUND, ROOM_MATERIAL, STATUS_COLOR, SUBFLOOR, WALL_EXT_TOP, WALL_SIDE, WALL_TOP } from "./style";
import { runOf, studsAlong, type BuildLook } from "@/lib/plan/build";
import { FRAMING } from "@/lib/plan/rules";
import { DraftFlag, MarkDot, PinFlag, PlanDefs, useHoldToPin, useWorldDrag } from "./svg";
import { useMarks } from "@/lib/plan/marks";
import { HIDDEN_KINDS, TOP_FILL, fixtureBottom, fixtureTop, isWallMounted } from "./fixtures";
import { ITEM_ICON } from "./items";
import type { Controls, PinTarget, ScreenPoint } from "./target";
import { usePanZoom } from "./usePanZoom";

export type ColorMode = "type" | "progress";

interface Props {
  plan: Plan;
  floor: Floor;
  room: Room | null;
  selected: string | null;
  selectedPin: string | null;
  states: Map<string, ElementStatus>;
  pins: Pin[];
  colorMode: ColorMode;
  pinMode: boolean;
  flyTo: { ids: string[]; n: number } | null;
  onSelect: (id: string | null) => void;
  onSelectPin: (id: string) => void;
  onOpenRoom: (id: string) => void;
  onOpenSide: (side: WallSide) => void;
  onUp: () => void;
  /** Drop a pin at a world point; `at` is the screen point, for the quick-note card. */
  onPlacePin: (t: PinTarget, at: ScreenPoint) => void;
  draft?: PinTarget | null;
  controls: Controls;
  items: JobItem[];
  /** small wall items (outlets ...) are hidden from the top view unless asked for */
  showItems: boolean;
  selectedItem: string | null;
  onSelectItem: (id: string) => void;
  onMovePin: (id: string, input: Partial<PinInput>) => void;
  onMoveFixture: (id: string, dx: number, dy: number) => void;
  /** look only: nothing can be dragged */
  locked?: boolean;
  /** the build stage to show: slab, framing, sheetrock or finished (the default) */
  look?: BuildLook;
}

/** Fixtures that can't be picked or moved in the top view: linework of something else, and things up
 *  on the wall (wall cabinets, hoods) that sit over the counter. */
const inert = (f: Fixture) => HIDDEN_KINDS.has(f.kind) || isWallMounted(f);

const box = (b: BBox) => ({ x: b[0], y: b[1], w: Math.max(1, b[2] - b[0]), h: Math.max(1, b[3] - b[1]) });

/** The element under a point: small things first, rooms last. */
export function hitTest(floor: Floor, p: Pt): string | null {
  // the smallest object under the point wins, so a vanity beats the bath it stands next to
  let best: Fixture | null = null;
  for (const f of floor.fixtures) {
    if (inert(f) || p[0] < f.bbox[0] || p[0] > f.bbox[2] || p[1] < f.bbox[1] || p[1] > f.bbox[3]) continue;
    if (!best || (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) < (best.bbox[2] - best.bbox[0]) * (best.bbox[3] - best.bbox[1])) best = f;
  }
  if (best) return best.id;
  for (const o of floor.openings) if (pointInPoly(p, o.polygon)) return o.id;
  for (const w of floor.walls) if (pointInPoly(p, w.polygon)) return w.id;
  for (const s of floor.stairs) if (pointInPoly(p, s.polygon)) return s.id;
  for (const r of floor.rooms) if (pointInPoly(p, r.polygon)) return r.id;
  return null;
}

export function pinPoint(plan: Plan, pin: Pin): Pt | null {
  if (pin.x != null && pin.y != null) return [pin.x, pin.y];
  if (!pin.element_id) return null;
  const e = findElement(plan, pin.element_id);
  return e ? elementCenter(e) : null;
}

function leafPaths(o: Opening) {
  const dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1];
  const L = Math.hypot(dx, dy) || 1;
  return o.leaves.map((lf) => {
    const t1 = (-lf.end_angle * Math.PI) / 180, t2 = (-lf.start_angle * Math.PI) / 180;
    const p1: Pt = [lf.hinge[0] + lf.radius * Math.cos(t1), lf.hinge[1] + lf.radius * Math.sin(t1)];
    const p2: Pt = [lf.hinge[0] + lf.radius * Math.cos(t2), lf.hinge[1] + lf.radius * Math.sin(t2)];
    // the open leaf is the radius that stands off the wall line
    const off = (p: Pt) => Math.abs(((p[0] - o.a[0]) * dy - (p[1] - o.a[1]) * dx) / L);
    const leaf = off(p1) > off(p2) ? p1 : p2;
    const sweep = t2 - t1 > 0 ? 1 : 0;
    return {
      arc: `M${p1[0]} ${p1[1]} A${lf.radius} ${lf.radius} 0 0 ${sweep} ${p2[0]} ${p2[1]}`,
      leaf: `M${lf.hinge[0]} ${lf.hinge[1]} L${leaf[0]} ${leaf[1]}`,
    };
  });
}

export function FloorCanvas(props: Props) {
  const { plan, floor, room, selected, selectedPin, states, pins, colorMode, pinMode } = props;
  const look = props.look ?? "finished";
  const ref = useRef<SVGSVGElement>(null);
  const fb = useMemo(() => floorBBox(floor), [floor]);
  const homeBox = useMemo(() => (room ? box(bboxOf(room.polygon)) : box(fb)), [room, fb]);
  const cb = useRef(props);
  cb.current = props;

  const pz = usePanZoom(ref, homeBox, {
    minScale: room ? 0.5 : 0.75,
    maxScale: room ? 6 : 14,
    padding: room ? 0.3 : 0.06,
    onLimit: (dir, at) => {
      const p = cb.current;
      if (dir === "out") return p.onUp();
      if (!p.room) {
        const r = p.floor.rooms.find((x) => pointInPoly([at.x, at.y], x.polygon));
        if (r) p.onOpenRoom(r.id);
      } else {
        const sides = roomSides(p.floor, p.room);
        let best: WallSide | null = null, bd = Infinity;
        for (const s of sides) {
          const d = edgeDistance([at.x, at.y], [s.a, s.b]);
          if (d < bd) { bd = d; best = s; }
        }
        if (best && bd < 1500) p.onOpenSide(best);
      }
    },
  });
  const { view, px, setHome, animateTo, zoomBy } = pz;

  // fly the camera when the level or floor changes
  const first = useRef(true);
  useEffect(() => {
    setHome(homeBox, !first.current, room ? 0.3 : 0.06);
    first.current = false;
  }, [homeBox, room, setHome]);

  // fly to an element picked from a list
  useEffect(() => {
    if (!props.flyTo) return;
    const els = props.flyTo.ids.map((id) => findElement(plan, id)).filter((e) => e && e.floor.id === floor.id);
    if (!els.length) return;
    const b = unionBBox(els.map((e) => (e!.kind === "fixture" ? e!.el.bbox : bboxOf(e!.el.polygon))));
    const w = Math.max(b[2] - b[0], 2500), h = Math.max(b[3] - b[1], 2500);
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    animateTo({ x: cx - w / 2, y: cy - h / 2, w, h }, 0.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.flyTo]);

  // the places the assistant is talking about: blink them, and bring them into view
  const { marks, n: markN } = useMarks();
  const floorMarks = useMemo(() => marks.filter((m) => m.floor_id === floor.id), [marks, floor.id]);
  useEffect(() => {
    if (!floorMarks.length) return;
    const xs = floorMarks.map((m) => m.x), ys = floorMarks.map((m) => m.y);
    const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const w = Math.max(b[2] - b[0] + 3000, 4000), h = Math.max(b[3] - b[1] + 3000, 4000);
    const inView = floorMarks.every((m) => m.x > view.x && m.x < view.x + view.w && m.y > view.y && m.y < view.y + view.h);
    if (!inView) animateTo({ x: (b[0] + b[2]) / 2 - w / 2, y: (b[1] + b[3]) / 2 - h / 2, w, h }, 0.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markN]);

  useEffect(() => {
    props.controls({ zoomBy, home: () => setHome(homeBox, true, room ? 0.3 : 0.06) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomBy, setHome, homeBox, room]);

  const [hover, setHover] = useState<string | null>(null);
  const { drag, start } = useWorldDrag(pz.toWorld);
  const shapes = useMemo(() => new Map(floor.fixtures.map((f) => [f.id, footprint(f)])), [floor.fixtures]);
  const sides = useMemo(() => (room ? roomSides(floor, room) : []), [floor, room]);
  const floorPins = useMemo(
    () => pins.map((p) => {
      if (p.anchor && p.anchor.view !== "wall") return null; // site and outside pins live in those views
      if (p.floor_id !== floor.id && !(!p.floor_id && p.element_id?.startsWith(floor.id + "-"))) return null;
      const pt = pinPoint(plan, p);
      if (!pt) return null;
      const onRoom = p.x == null && p.element_id && floor.rooms.some((r) => r.id === p.element_id);
      return { pin: p, pt: onRoom ? [pt[0], pt[1] - 22 * px] as Pt : pt };
    }).filter(Boolean) as { pin: Pin; pt: Pt }[],
    [pins, plan, floor, px],
  );
  const openByRoom = useMemo(() => {
    const m = new Map<string, number>();
    for (const { pin, pt } of floorPins) {
      if (pin.status === "done") continue;
      const e = pin.element_id ? findElement(plan, pin.element_id) : null;
      let rid = e ? roomOf(e) : null;
      if (!rid) rid = floor.rooms.find((r) => pointInPoly(pt, r.polygon))?.id ?? null;
      if (rid) m.set(rid, (m.get(rid) ?? 0) + 1);
    }
    return m;
  }, [floorPins, plan, floor.rooms]);

  const status = (id: string) => states.get(id);
  const inRoom = (ids: string[] | string | null) => !room || (Array.isArray(ids) ? ids.includes(room.id) : ids === room.id);

  const place = (e: { clientX: number; clientY: number }, fallback?: string | null) => {
    const w = pz.toWorld(e.clientX, e.clientY);
    props.onPlacePin({ floorId: floor.id, x: Math.round(w.x), y: Math.round(w.y), elementId: hitTest(floor, [w.x, w.y]) ?? fallback ?? null, anchor: null }, { x: e.clientX, y: e.clientY });
  };
  const click = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinMode) return place(e, id);
    props.onSelect(id);
  };
  const roomClick = (r: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinMode) return place(e, r.id);
    if (!room || room.id !== r.id) props.onOpenRoom(r.id);
    else props.onSelect(r.id);
  };
  const hov = (id: string | null) => () => setHover(id);

  // press and hold (touch) or right-click anywhere drops a note right there
  const handlers = useHoldToPin(pz.handlers, (e) => place(e));

  const lw = px; // one screen pixel in world units
  const fs = 13 * px;
  const H = 150; // wall height drawn as a shadow offset, mm, for the extruded look
  const W = fb[2] - fb[0], Hh = fb[3] - fb[1];
  const draftPt = props.draft && !props.draft.anchor && props.draft.floorId === floor.id && props.draft.x != null && props.draft.y != null ? [props.draft.x, props.draft.y] as Pt : null;

  return (
    <svg
      ref={ref}
      className={`w-full h-full block touch-none select-none ${pinMode ? "cursor-crosshair" : pz.dragging ? "cursor-grabbing" : "cursor-default"}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      {...handlers}
      onClick={(e) => { if (pinMode) place(e); else props.onSelect(null); }}
      role="application"
      aria-label={`${floor.name} plan`}
    >
      <PlanDefs />
      <defs>
        <pattern id="survey" width={1000} height={1000} patternUnits="userSpaceOnUse">
          <path d="M1000 0H0V1000" fill="none" stroke="#262923" strokeWidth={10} />
          <path d="M0 -40V40M-40 0H40" stroke="#33372f" strokeWidth={14} />
        </pattern>
        <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={240} /></filter>
      </defs>
      {/* the lot: ground with a 1 m survey grid */}
      <rect x={fb[0] - 80000} y={fb[1] - 80000} width={W + 160000} height={Hh + 160000} fill={GROUND} />
      <rect x={fb[0] - 80000} y={fb[1] - 80000} width={W + 160000} height={Hh + 160000} fill="url(#survey)" />
      <g pointerEvents="none" fontFamily="var(--font-mono)" fontSize={fs * 0.75} fill="#5d6157">
        <text x={fb[0]} y={fb[1] - 900}>{floor.name.toUpperCase()} · {(W / 1000).toFixed(1)} × {(Hh / 1000).toFixed(1)} m</text>
      </g>

      {/* soft ground shadow under the building */}
      <g transform="translate(260 420)" opacity={0.6} filter="url(#soft)" pointerEvents="none">
        {floor.footprint.map((r, i) => <path key={i} d={pathD(r)} fill="#000" />)}
      </g>

      {/* rooms, floored in their material */}
      <g>
        {floor.rooms.map((r) => {
          const st = status(r.id);
          const dim = room && room.id !== r.id;
          const hot = hover === r.id, sel = selected === r.id;
          return (
            <g key={r.id} onClick={(e) => roomClick(r, e)} onPointerEnter={hov(r.id)} onPointerLeave={hov(null)} className="cursor-pointer">
              <path d={pathD(r.polygon)} fill={look !== "finished" && floor.level > 0 ? SUBFLOOR : `url(#mat-${look === "finished" ? ROOM_MATERIAL[r.type] ?? "concrete" : "concrete"})`} />
              {colorMode === "progress" && <path d={pathD(r.polygon)} fill={st ? STATUS_COLOR[st] : "#1d1f1b"} fillOpacity={st ? 0.55 : 0.6} />}
              {st === "demolish" && <path d={pathD(r.polygon)} fill="url(#hatch)" />}
              {/* inner shade along the walls gives the floor depth */}
              <path d={pathD(r.polygon)} fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={140} style={{ clipPath: "none" }} pointerEvents="none" />
              {hot && !sel && <path d={pathD(r.polygon)} fill="#fff" fillOpacity={0.08} />}
              {sel && <path d={pathD(r.polygon)} fill={CHALK} fillOpacity={0.1} stroke={CHALK} strokeWidth={2.5 * lw} strokeDasharray={`${10 * lw} ${5 * lw}`} />}
              {dim && <path d={pathD(r.polygon)} fill="#0c0d0b" fillOpacity={0.62} />}
            </g>
          );
        })}
      </g>

      {/* stairs */}
      <g>
        {(look === "slab" ? [] : floor.stairs).map((s) => (
          <g key={s.id} onClick={(e) => click(s.id, e)} onPointerEnter={hov(s.id)} onPointerLeave={hov(null)} className="cursor-pointer" opacity={inRoom(s.room_id) ? 1 : 0.35}>
            <path d={pathD(s.polygon)} fill="#000" fillOpacity={0.18} stroke={selected === s.id ? CHALK : hover === s.id ? "#fff" : "transparent"} strokeWidth={2 * lw} />
            <path d={lineD(s.outline)} fill="none" stroke="#f0ece3" strokeOpacity={0.75} strokeWidth={1.2 * lw} />
          </g>
        ))}
      </g>

      {/* fixtures, seen from above: a shadow from their real height, their colour, then the drawing's
          own linework on top. Wall cabinets and hoods are dashed (they hang over the counter). */}
      <g>
        {floor.fixtures.filter((f) => !HIDDEN_KINDS.has(f.kind) && isWallMounted(f)).map((f) => (
          <path key={f.id} d={pathD(shapes.get(f.id)!)} fill="none" stroke="#f4efe6" strokeOpacity={inRoom(f.room_id) ? 0.55 : 0.2} strokeWidth={lw} strokeDasharray={`${5 * lw} ${4 * lw}`} pointerEvents="none" />
        ))}
        {floor.fixtures.filter((f) => !inert(f) || f.kind === "part").sort((a, b) => fixtureBottom(a) - fixtureBottom(b)).map((f) => {
          const b = f.bbox, sel = selected === f.id, hot = hover === f.id;
          if (f.kind === "part") return <path key={f.id} d={lineD(f.outline)} fill="none" stroke={FIXTURE_STROKE} strokeOpacity={inRoom(f.room_id) ? 0.7 : 0.25} strokeWidth={lw} pointerEvents="none" />;
          const faint = f.kind === "other";
          const st = status(f.id);
          const fill = colorMode === "progress" && st ? STATUS_COLOR[st] : TOP_FILL[f.kind];
          const shape = shapes.get(f.id)!;
          const h = fixtureTop(f);
          const live = drag?.id === `f:${f.id}` ? { dx: drag.x - f.center[0], dy: drag.y - f.center[1] } : null;
          return (
            <g key={f.id} onClick={(e) => click(f.id, e)} onPointerEnter={hov(f.id)} onPointerLeave={hov(null)} className={pinMode ? "cursor-crosshair" : live ? "cursor-grabbing" : sel && !props.locked ? "cursor-grab" : "cursor-pointer"} opacity={inRoom(f.room_id) ? 1 : 0.3}
              transform={live ? `translate(${live.dx} ${live.dy})` : undefined}
              onPointerDown={sel && !pinMode && !props.locked ? (e) => start(`f:${f.id}`, e, { x: f.center[0], y: f.center[1] }, (nx, ny) => props.onMoveFixture(f.id, Math.round(nx - f.center[0]), Math.round(ny - f.center[1])), (q, free) => (free ? q : { x: Math.round(q.x / 10) * 10, y: Math.round(q.y / 10) * 10 })) : undefined}>
              {fill && <path d={pathD(shape)} fill="#000" fillOpacity={0.35} transform={`translate(${Math.min(h, 2200) * 0.08} ${Math.min(h, 2200) * 0.14})`} pointerEvents="none" />}
              {fill && <path d={pathD(shape)} fill={fill} fillOpacity={colorMode === "progress" && st ? 0.85 : 1} />}
              <rect x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} rx={40} fill={sel ? CHALK : hot ? "#fff" : "transparent"} fillOpacity={sel ? 0.16 : 0.1}
                stroke={sel ? CHALK : hot ? "#fff" : "transparent"} strokeWidth={1.5 * lw} strokeDasharray={sel ? undefined : `${4 * lw} ${3 * lw}`} />
              {f.outline.length ? (
                <path d={lineD(f.outline)} fill="none" stroke={fill ? "#1b1a17" : FIXTURE_STROKE} strokeOpacity={fill ? 0.55 : faint ? 0.55 : 0.92} strokeWidth={1.2 * lw} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
              ) : (
                <>
                  <rect x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} rx={60} fill="none" stroke={FIXTURE_STROKE} strokeWidth={lw} />
                  <text x={f.center[0]} y={f.center[1] + fs * 0.35} textAnchor="middle" fontSize={fs * 0.8} fill={FIXTURE_STROKE}>{f.name}</text>
                </>
              )}
              {live && <text x={f.center[0]} y={b[1] - 10 * lw} textAnchor="middle" fontSize={11 * lw} fontFamily="var(--font-mono)" fill="#55b2ff" style={{ paintOrder: "stroke" }} stroke="#141513" strokeWidth={3 * lw}>moved {Math.round(Math.hypot(live.dx, live.dy))} mm</text>}
            </g>
          );
        })}
      </g>

      {/* walls, extruded: a dark side drawn first, offset down-right, then the plaster top */}
      <g pointerEvents="none">
        {look !== "slab" && floor.walls.map((w) => <path key={`s${w.id}`} d={pathD(w.polygon)} fill={WALL_SIDE} opacity={inRoom(w.room_ids) ? (look === "framing" ? 0.35 : 0.7) : 0.25} transform={`translate(${H * 0.5} ${H})`} />)}
      </g>
      <g>
        {floor.walls.map((w) => {
          const st = status(w.id), sel = selected === w.id, hot = hover === w.id;
          const tint = colorMode === "progress" && st ? STATUS_COLOR[st] : null;
          const events = { onClick: (e: React.MouseEvent) => click(w.id, e), onPointerEnter: hov(w.id), onPointerLeave: hov(null) };
          // the bare slab: the wall chalked out where it'll stand
          if (look === "slab") return (
            <path key={w.id} d={pathD(w.polygon)} fill={tint ?? CHALK_LINE} fillOpacity={hot || sel ? 0.4 : 0.14} stroke={sel ? CHALK : tint ?? CHALK_LINE} strokeOpacity={0.9} strokeWidth={(sel ? 3 : 1.4) * lw}
              strokeDasharray={`${8 * lw} ${5 * lw}`} opacity={inRoom(w.room_ids) ? 1 : 0.35} className="cursor-pointer" {...events} />
          );
          // framing from above: the top plate, with a tick at every stud
          const run = look === "framing" ? runOf(w.polygon) : null;
          if (run) {
            const d = Math.min(run.thickness, w.exterior ? FRAMING.depthExt : FRAMING.depth) / 2;
            return (
              <g key={w.id} opacity={inRoom(w.room_ids) ? 1 : 0.35} className="cursor-pointer" {...events}>
                <path d={pathD(w.polygon)} fill="transparent" />
                <path d={`M${run.a[0] + run.n[0] * d} ${run.a[1] + run.n[1] * d}L${run.b[0] + run.n[0] * d} ${run.b[1] + run.n[1] * d}L${run.b[0] - run.n[0] * d} ${run.b[1] - run.n[1] * d}L${run.a[0] - run.n[0] * d} ${run.a[1] - run.n[1] * d}Z`}
                  fill={tint ?? (hot && !sel ? "#e3c592" : FRAMING.plateWood)} stroke={sel ? CHALK : "#5a4126"} strokeWidth={(sel ? 3 : 0.8) * lw} />
                {studsAlong(run.length, FRAMING.stud, FRAMING.spacing).map((at) => {
                  const c = [run.a[0] + run.u[0] * at, run.a[1] + run.u[1] * at];
                  return <path key={at} d={`M${c[0] + run.n[0] * d} ${c[1] + run.n[1] * d}L${c[0] - run.n[0] * d} ${c[1] - run.n[1] * d}`} stroke="#5a4126" strokeWidth={Math.max(FRAMING.stud, 1.2 * lw)} pointerEvents="none" />;
                })}
              </g>
            );
          }
          const fill = tint ?? (look === "drywall" ? DRYWALL : w.exterior ? WALL_EXT_TOP : WALL_TOP);
          return (
            <path key={w.id} d={pathD(w.polygon)} fill={hot && !sel ? "#ffffff" : fill} stroke={sel ? CHALK : "#00000033"} strokeWidth={(sel ? 3.5 : 1) * lw}
              opacity={inRoom(w.room_ids) ? 1 : 0.35} className="cursor-pointer" {...events} />
          );
        })}
      </g>

      {/* openings: glass for windows, timber leaves and swing arcs for doors */}
      <g>
        {floor.openings.map((o) => {
          const sel = selected === o.id, hot = hover === o.id, st = status(o.id);
          const isWin = o.kind === "window";
          const tint = colorMode === "progress" && st ? STATUS_COLOR[st] : null;
          const mid = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
          return (
            <g key={o.id} onClick={(e) => click(o.id, e)} onPointerEnter={hov(o.id)} onPointerLeave={hov(null)} className="cursor-pointer" opacity={inRoom(o.room_ids) ? 1 : 0.35}>
              {look === "slab" ? (
                <path d={pathD(o.polygon)} fill={tint ?? (isWin ? "#6f9aab" : "#b98c5a")} fillOpacity={0.45} stroke={tint ?? CHALK_LINE} strokeWidth={lw} strokeDasharray={`${4 * lw} ${3 * lw}`} />
              ) : isWin ? (
                <>
                  <path d={pathD(o.polygon)} fill={tint ?? GLASS} />
                  <path d={`M${o.a[0]} ${o.a[1]}L${o.b[0]} ${o.b[1]}`} stroke="#2b5a6b" strokeWidth={1.6 * lw} />
                </>
              ) : (
                <>
                  <path d={pathD(o.polygon)} fill={tint ?? (o.kind === "opening" ? "transparent" : "#3a2c20")} fillOpacity={tint ? 0.7 : o.kind === "opening" ? 0 : 0.55} />
                  {o.kind === "opening" && <path d={`M${o.a[0]} ${o.a[1]}L${o.b[0]} ${o.b[1]}`} stroke="#f0ece3" strokeOpacity={0.4} strokeWidth={lw} strokeDasharray={`${5 * lw} ${4 * lw}`} />}
                  {o.kind === "garage_door" && <path d={`M${o.a[0]} ${o.a[1]}L${o.b[0]} ${o.b[1]}`} stroke="#f0ece3" strokeWidth={4 * lw} strokeDasharray={`${12 * lw} ${4 * lw}`} />}
                  {look === "finished" && leafPaths(o).map((p, i) => (
                    <g key={i} pointerEvents="none">
                      <path d={p.arc} fill="none" stroke={tint ?? "#f0ece3"} strokeOpacity={0.45} strokeWidth={lw} strokeDasharray={`${3 * lw} ${3 * lw}`} />
                      <path d={p.leaf} stroke={tint ?? "#c99a62"} strokeWidth={4 * lw} strokeLinecap="round" />
                    </g>
                  ))}
                </>
              )}
              <circle cx={mid[0]} cy={mid[1]} r={Math.max(o.width_mm / 2, 9 * lw)} fill="transparent" />
              {(sel || hot) && <path d={pathD(o.polygon)} fill="none" stroke={sel ? CHALK : "#fff"} strokeWidth={2.5 * lw} />}
            </g>
          );
        })}
      </g>

      {/* room labels: painted name, area and ID tag */}
      <g pointerEvents="none">
        {floor.rooms.map((r) => {
          if (room && room.id !== r.id) return null;
          const [x, y] = labelPoint(r.polygon);
          const b = bboxOf(r.polygon);
          const name = r.name.toUpperCase();
          const tw = name.length * fs * 0.52;
          if (tw > (b[2] - b[0]) * 0.95 && !room) return null;
          const n = openByRoom.get(r.id) ?? 0;
          const sub = `${r.area_m2.toFixed(1)} m²`;
          const showSub = sub.length * fs * 0.5 + 5 * fs < (b[2] - b[0]) * 0.95;
          return (
            <g key={r.id}>
              <text x={x} y={y} textAnchor="middle" fontSize={fs * 1.15} fontFamily="var(--font-display)" fontWeight={800} letterSpacing={fs * 0.06} fill="#fbf8f2" style={{ paintOrder: "stroke" }} stroke="#15130f" strokeOpacity={0.7} strokeWidth={3.5 * lw}>{name}</text>
              {showSub && (
                <g transform={`translate(${x} ${y + fs * 1.05})`}>
                  <text textAnchor="middle" y={fs * 0.35} fontSize={fs * 0.78} fontFamily="var(--font-mono)" fill="#efe7d6" style={{ paintOrder: "stroke" }} stroke="#15130f" strokeOpacity={0.7} strokeWidth={3 * lw}>{sub} · {r.id}</text>
                </g>
              )}
              {n > 0 && !room && (
                <g transform={`translate(${x + tw / 2 + 10 * lw} ${y - fs * 0.45})`}>
                  <rect x={-8 * lw} y={-8 * lw} width={16 * lw} height={16 * lw} rx={2 * lw} fill="#ff6a1f" stroke="#1c0c03" strokeWidth={lw} />
                  <text y={3.8 * lw} textAnchor="middle" fontSize={10.5 * lw} fontFamily="var(--font-mono)" fontWeight={700} fill="#1c0c03">{n}</text>
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* wall markers inside a room: step up to the wall view */}
      {room && !pinMode && (
        <g>
          {sides.map((s) => {
            const c = centroid(room.polygon);
            const mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2;
            const d = Math.hypot(c[0] - mx, c[1] - my) || 1;
            const inset = Math.min(34 * lw, d * 0.4);
            const x = mx + ((c[0] - mx) / d) * inset, y = my + ((c[1] - my) / d) * inset;
            const label = s.label.toUpperCase();
            const w = label.length * 7.2 * lw + 26 * lw;
            return (
              <g key={s.key} transform={`translate(${x} ${y})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); props.onOpenSide(s); }}>
                <rect x={-w / 2} y={-12 * lw} width={w} height={24 * lw} rx={2 * lw} fill="#ff6a1f" stroke="#1c0c03" strokeWidth={1.2 * lw} />
                <text x={-4 * lw} y={5 * lw} textAnchor="middle" fontSize={14 * lw} fontFamily="var(--font-display)" fontWeight={800} letterSpacing={1 * lw} fill="#1c0c03">{label}</text>
                <path d={`M${w / 2 - 14 * lw} ${-4 * lw}L${w / 2 - 9 * lw} 0L${w / 2 - 14 * lw} ${4 * lw}`} fill="none" stroke="#1c0c03" strokeWidth={2 * lw} />
              </g>
            );
          })}
        </g>
      )}

      {/* wall items, only when asked for: small markers along the wall */}
      {props.showItems && room && (
        <g>
          {props.items.filter((it) => it.side.startsWith(room.id + ":")).map((it) => {
            const sd = sides.find((x) => x.key === it.side);
            if (!sd) return null;
            const [x, y] = sidePoint(sd, it.x, 9 * lw);
            const sel = props.selectedItem === it.id;
            return (
              <g key={it.id} transform={`translate(${x} ${y})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); props.onSelectItem(it.id); }}>
                <circle r={8 * lw} fill={sel ? CHALK : "#fbf8f1"} stroke="#1b1a17" strokeWidth={1.2 * lw} />
                <text y={3.6 * lw} textAnchor="middle" fontSize={10 * lw} fill="#1b1a17">{ITEM_ICON[it.kind]}</text>
              </g>
            );
          })}
        </g>
      )}

      {/* pins */}
      <g>
        {floorPins.map(({ pin, pt }) => {
          const e = pin.element_id ? findElement(plan, pin.element_id) : null;
          if (room && e && roomOf(e) !== room.id && !pointInPoly(pt, room.polygon)) return null;
          const live = drag?.id === `p:${pin.id}` ? drag : null;
          const movable = !pin.anchor && !pinMode && !props.locked && pin.id === selectedPin;
          return <PinFlag key={pin.id} pin={pin} x={live ? live.x : pt[0]} y={live ? live.y : pt[1]} px={lw} selected={selectedPin === pin.id} lifted={!!live}
            onClick={(ev) => { ev.stopPropagation(); props.onSelectPin(pin.id); }}
            onPointerDown={movable ? (ev) => start(`p:${pin.id}`, ev, { x: pt[0], y: pt[1] }, (nx, ny) => props.onMovePin(pin.id, { floor_id: floor.id, x: Math.round(nx), y: Math.round(ny), element_id: hitTest(floor, [nx, ny]) ?? pin.element_id })) : undefined} />;
        })}
        {draftPt && <DraftFlag x={draftPt[0]} y={draftPt[1]} px={lw} />}
      </g>
      {floorMarks.map((m, i) => <MarkDot key={`${markN}-${i}`} x={m.x} y={m.y} color={m.color} label={m.label} px={lw} />)}
    </svg>
  );
}
