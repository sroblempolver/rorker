"use client";
// One floor of the plan as a live, game-like map. At floor level a click on a room flies into it;
// inside a room, walls get their own markers so you can step up to the wall view. Everything that has
// an ID can be clicked, carries a status colour, and can hold pins.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Pin } from "@/lib/data/types";
import { bboxOf, centroid, unionBBox, edgeDistance, elementCenter, findElement, floorBBox, labelPoint, lineD, pathD, pointInPoly, roomOf, roomSides, type WallSide } from "@/lib/plan/geometry";
import type { BBox, ElementStatus, Floor, Opening, Plan, Pt, Room } from "@/lib/plan/types";
import { FIXTURE_STROKE, GLASS, PIN_COLOR, ROOM_FILL, STATUS_COLOR, WALL_EXT_FILL, WALL_FILL } from "./style";
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
  onPlacePin: (x: number | null, y: number | null, elementId: string | null) => void;
  controls: (api: { zoomBy: (f: number) => void; home: () => void }) => void;
}

const box = (b: BBox) => ({ x: b[0], y: b[1], w: Math.max(1, b[2] - b[0]), h: Math.max(1, b[3] - b[1]) });

/** The element under a point: small things first, rooms last. */
export function hitTest(floor: Floor, p: Pt): string | null {
  for (const f of floor.fixtures) if (p[0] >= f.bbox[0] && p[0] <= f.bbox[2] && p[1] >= f.bbox[1] && p[1] <= f.bbox[3]) return f.id;
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

  useEffect(() => {
    props.controls({ zoomBy, home: () => setHome(homeBox, true, room ? 0.3 : 0.06) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomBy, setHome, homeBox, room]);

  const [hover, setHover] = useState<string | null>(null);
  const sides = useMemo(() => (room ? roomSides(floor, room) : []), [floor, room]);
  const floorPins = useMemo(
    () => pins.map((p) => {
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

  const click = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinMode) {
      const w = pz.toWorld(e.clientX, e.clientY);
      return props.onPlacePin(w.x, w.y, id);
    }
    props.onSelect(id);
  };
  const roomClick = (r: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinMode) {
      const w = pz.toWorld(e.clientX, e.clientY);
      return props.onPlacePin(w.x, w.y, hitTest(floor, [w.x, w.y]) ?? r.id);
    }
    if (!room || room.id !== r.id) props.onOpenRoom(r.id);
    else props.onSelect(r.id);
  };
  const hov = (id: string | null) => () => setHover(id);

  const lw = px; // one screen pixel in world units
  const fs = 12.5 * px;
  const shadowOff = 260;

  return (
    <svg
      ref={ref}
      className={`w-full h-full block touch-none select-none ${pinMode ? "cursor-crosshair" : pz.dragging ? "cursor-grabbing" : "cursor-default"}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      {...pz.handlers}
      onClick={(e) => {
        if (pinMode) {
          const w = pz.toWorld(e.clientX, e.clientY);
          props.onPlacePin(w.x, w.y, hitTest(floor, [w.x, w.y]));
        } else props.onSelect(null);
      }}
      role="application"
      aria-label={`${floor.name} plan`}
    >
      <defs>
        <pattern id="grid1m" width={1000} height={1000} patternUnits="userSpaceOnUse">
          <path d="M1000 0H0V1000" fill="none" stroke="#1a222c" strokeWidth={14} />
        </pattern>
        <pattern id="grid5m" width={5000} height={5000} patternUnits="userSpaceOnUse">
          <path d="M5000 0H0V5000" fill="none" stroke="#212b36" strokeWidth={28} />
        </pattern>
        <pattern id="hatch" width={260} height={260} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={260} height={260} fill="transparent" />
          <line x1={0} y1={0} x2={0} y2={260} stroke="#b07be0" strokeWidth={70} opacity={0.7} />
        </pattern>
        <filter id="fshadow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={220} /></filter>
      </defs>
      <rect x={fb[0] - 60000} y={fb[1] - 60000} width={fb[2] - fb[0] + 120000} height={fb[3] - fb[1] + 120000} fill="#0f141a" />
      <rect x={fb[0] - 60000} y={fb[1] - 60000} width={fb[2] - fb[0] + 120000} height={fb[3] - fb[1] + 120000} fill="url(#grid1m)" />
      <rect x={fb[0] - 60000} y={fb[1] - 60000} width={fb[2] - fb[0] + 120000} height={fb[3] - fb[1] + 120000} fill="url(#grid5m)" />

      {/* soft shadow under the building */}
      <g transform={`translate(${shadowOff * 0.6} ${shadowOff})`} opacity={0.55} filter="url(#fshadow)" pointerEvents="none">
        {floor.footprint.map((r, i) => <path key={i} d={pathD(r)} fill="#000" />)}
        {floor.walls.map((w) => <path key={w.id} d={pathD(w.polygon)} fill="#000" />)}
      </g>

      {/* rooms */}
      <g>
        {floor.rooms.map((r) => {
          const st = status(r.id);
          const dim = room && room.id !== r.id;
          let fill = ROOM_FILL[r.type] ?? ROOM_FILL.other;
          if (colorMode === "progress") fill = st ? STATUS_COLOR[st] : "#3a424d";
          const hot = hover === r.id, sel = selected === r.id;
          return (
            <g key={r.id} onClick={(e) => roomClick(r, e)} onPointerEnter={hov(r.id)} onPointerLeave={hov(null)} className="cursor-pointer">
              <path d={pathD(r.polygon)} fill={fill} fillOpacity={colorMode === "progress" ? (st ? 0.42 : 1) : 1} />
              {st === "demolish" && <path d={pathD(r.polygon)} fill="url(#hatch)" />}
              {(hot || sel) && <path d={pathD(r.polygon)} fill="#fff" fillOpacity={sel ? 0.08 : 0.05} stroke={sel ? "var(--accent)" : "#fff"} strokeOpacity={sel ? 1 : 0.35} strokeWidth={(sel ? 2.5 : 1.5) * lw} />}
              {dim && <path d={pathD(r.polygon)} fill="#0b0f14" fillOpacity={0.55} />}
            </g>
          );
        })}
      </g>

      {/* stairs */}
      <g>
        {floor.stairs.map((s) => (
          <g key={s.id} onClick={(e) => click(s.id, e)} onPointerEnter={hov(s.id)} onPointerLeave={hov(null)} className="cursor-pointer" opacity={inRoom(s.room_id) ? 1 : 0.35}>
            <path d={pathD(s.polygon)} fill="#000" fillOpacity={0.12} stroke={selected === s.id ? "var(--accent)" : hover === s.id ? "#fff" : "transparent"} strokeWidth={2 * lw} />
            <path d={lineD(s.outline)} fill="none" stroke="#a7c7a0" strokeOpacity={0.8} strokeWidth={lw} />
          </g>
        ))}
      </g>

      {/* fixtures */}
      <g>
        {floor.fixtures.map((f) => {
          const b = f.bbox, sel = selected === f.id, hot = hover === f.id;
          const faint = f.kind === "other";
          const st = status(f.id);
          return (
            <g key={f.id} onClick={(e) => click(f.id, e)} onPointerEnter={hov(f.id)} onPointerLeave={hov(null)} className="cursor-pointer" opacity={inRoom(f.room_id) ? 1 : 0.3}>
              <rect x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} rx={60} fill={sel || hot ? "#fff" : "transparent"} fillOpacity={sel ? 0.1 : 0.06}
                stroke={sel ? "var(--accent)" : hot ? "#fff" : colorMode === "progress" && st ? STATUS_COLOR[st] : "transparent"} strokeOpacity={hot && !sel ? 0.5 : 1} strokeWidth={1.5 * lw} strokeDasharray={sel ? undefined : `${4 * lw} ${3 * lw}`} />
              {f.outline.length ? (
                <path d={lineD(f.outline)} fill="none" stroke={colorMode === "progress" && st ? STATUS_COLOR[st] : FIXTURE_STROKE} strokeOpacity={faint ? 0.5 : 0.9} strokeWidth={lw} strokeLinejoin="round" />
              ) : (
                <>
                  <rect x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} rx={80} fill="none" stroke={FIXTURE_STROKE} strokeWidth={lw} />
                  <text x={f.center[0]} y={f.center[1] + fs * 0.35} textAnchor="middle" fontSize={fs * 0.85} fill={FIXTURE_STROKE}>{f.name}</text>
                </>
              )}
            </g>
          );
        })}
      </g>

      {/* walls */}
      <g>
        {floor.walls.map((w) => {
          const st = status(w.id), sel = selected === w.id, hot = hover === w.id;
          const fill = colorMode === "progress" && st ? STATUS_COLOR[st] : w.exterior ? WALL_EXT_FILL : WALL_FILL;
          return (
            <path key={w.id} d={pathD(w.polygon)} fill={hot && !sel ? "#ffffff" : fill} stroke={sel ? "var(--accent)" : "none"} strokeWidth={3 * lw}
              opacity={inRoom(w.room_ids) ? 1 : 0.35} className="cursor-pointer"
              onClick={(e) => click(w.id, e)} onPointerEnter={hov(w.id)} onPointerLeave={hov(null)} />
          );
        })}
      </g>

      {/* openings: glass for windows, swing arcs for doors */}
      <g>
        {floor.openings.map((o) => {
          const sel = selected === o.id, hot = hover === o.id, st = status(o.id);
          const isWin = o.kind === "window";
          const tint = colorMode === "progress" && st ? STATUS_COLOR[st] : null;
          const mid = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
          return (
            <g key={o.id} onClick={(e) => click(o.id, e)} onPointerEnter={hov(o.id)} onPointerLeave={hov(null)} className="cursor-pointer" opacity={inRoom(o.room_ids) ? 1 : 0.35}>
              {isWin ? (
                <>
                  <path d={pathD(o.polygon)} fill={tint ?? GLASS} fillOpacity={0.9} />
                  <path d={`M${o.a[0]} ${o.a[1]}L${o.b[0]} ${o.b[1]}`} stroke="#0f141a" strokeWidth={1.2 * lw} />
                </>
              ) : (
                <>
                  <path d={pathD(o.polygon)} fill={tint ?? (o.kind === "opening" ? "transparent" : "#0f141a")} fillOpacity={tint ? 0.6 : 0.35} />
                  {o.kind === "opening" && <path d={`M${o.a[0]} ${o.a[1]}L${o.b[0]} ${o.b[1]}`} stroke="#c8d0da" strokeOpacity={0.35} strokeWidth={lw} strokeDasharray={`${5 * lw} ${4 * lw}`} />}
                  {o.kind === "garage_door" && <path d={`M${o.a[0]} ${o.a[1]}L${o.b[0]} ${o.b[1]}`} stroke="#c8d0da" strokeWidth={3 * lw} strokeDasharray={`${10 * lw} ${4 * lw}`} />}
                  {leafPaths(o).map((p, i) => (
                    <g key={i} pointerEvents="none">
                      <path d={p.arc} fill="none" stroke={tint ?? "#e9a23b"} strokeOpacity={0.7} strokeWidth={lw} strokeDasharray={`${3 * lw} ${3 * lw}`} />
                      <path d={p.leaf} stroke={tint ?? "#f2c27a"} strokeWidth={2 * lw} strokeLinecap="round" />
                    </g>
                  ))}
                </>
              )}
              {/* fat invisible hit target so small doors are easy to tap */}
              <circle cx={mid[0]} cy={mid[1]} r={Math.max(o.width_mm / 2, 9 * lw)} fill="transparent" />
              {(sel || hot) && <path d={pathD(o.polygon)} fill="none" stroke={sel ? "var(--accent)" : "#fff"} strokeWidth={2.5 * lw} />}
            </g>
          );
        })}
      </g>

      {/* room labels */}
      <g pointerEvents="none">
        {floor.rooms.map((r) => {
          if (room && room.id !== r.id) return null;
          const [x, y] = labelPoint(r.polygon);
          const b = bboxOf(r.polygon);
          const tw = r.name.length * fs * 0.56;
          if (tw > (b[2] - b[0]) * 0.95 && !room) return null;
          const n = openByRoom.get(r.id) ?? 0;
          return (
            <g key={r.id}>
              <text x={x} y={y} textAnchor="middle" fontSize={fs} fontFamily="var(--font-display)" fontWeight={600} letterSpacing={fs * 0.04} fill="#eef1f4" style={{ paintOrder: "stroke" }} stroke="#0f141a" strokeOpacity={0.6} strokeWidth={3 * lw}>{r.name}</text>
              {r.area_m2.toFixed(1).length * fs * 0.45 + fs * 4 < (b[2] - b[0]) * 0.95 && <text x={x} y={y + fs * 1.25} textAnchor="middle" fontSize={fs * 0.8} fill="#aab4c0" style={{ paintOrder: "stroke" }} stroke="#0f141a" strokeOpacity={0.6} strokeWidth={3 * lw}>{r.area_m2.toFixed(1)} m² · {r.id}</text>}
              {n > 0 && !room && (
                <g transform={`translate(${x + tw / 2 + 9 * lw} ${y - fs * 0.4})`}>
                  <circle r={8 * lw} fill="var(--red)" />
                  <text y={3.6 * lw} textAnchor="middle" fontSize={10 * lw} fontWeight={700} fill="#fff">{n}</text>
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
            const inset = Math.min(32 * lw, d * 0.4);
            const x = mx + ((c[0] - mx) / d) * inset, y = my + ((c[1] - my) / d) * inset;
            const label = `${s.heading[0].toUpperCase()}${s.heading.slice(1)} wall`;
            const w = label.length * 6.6 * lw + 16 * lw;
            return (
              <g key={s.key} transform={`translate(${x} ${y})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); props.onOpenSide(s); }}>
                <rect x={-w / 2} y={-11 * lw} width={w} height={22 * lw} rx={11 * lw} fill="#0f141a" fillOpacity={0.85} stroke="var(--accent)" strokeWidth={1.2 * lw} />
                <text y={4 * lw} textAnchor="middle" fontSize={11 * lw} fontFamily="var(--font-display)" fontWeight={600} letterSpacing={0.6 * lw} fill="var(--accent)">{label} ›</text>
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
          const sel = selectedPin === pin.id;
          const s = (sel ? 1.25 : 1) * lw;
          const color = pin.status === "done" ? "#4cb782" : PIN_COLOR[pin.kind];
          return (
            <g key={pin.id} transform={`translate(${pt[0]} ${pt[1]}) scale(${s})`} className="cursor-pointer" onClick={(ev) => { ev.stopPropagation(); props.onSelectPin(pin.id); }} opacity={pin.status === "done" ? 0.75 : 1}>
              <ellipse cx={0} cy={0} rx={5} ry={2} fill="#000" opacity={0.4} />
              <path d="M0 0 C-3 -7 -11 -11 -11 -20 A11 11 0 1 1 11 -20 C11 -11 3 -7 0 0Z" fill={color} stroke={sel ? "#fff" : "#0f141a"} strokeWidth={sel ? 2 : 1.2} />
              <text y={-16} textAnchor="middle" fontSize={11} fontWeight={700} fill="#14100a">{pin.status === "done" ? "✓" : pin.number}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
