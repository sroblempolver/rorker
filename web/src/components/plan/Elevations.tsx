"use client";
// Two upright views: the outside of the building (estimated front elevation, one band per storey) and
// a single wall of a room seen from inside, with its doors, windows and the things standing against it.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Pin } from "@/lib/data/types";
import { attachedToSide, frontView, type WallSide } from "@/lib/plan/geometry";
import type { ElementStatus, Floor, Opening, Plan, Room } from "@/lib/plan/types";
import { CHALK, ROOM_MATERIAL, STATUS_COLOR, WALL_TOP } from "./style";
import { DraftFlag, PinFlag, PlanDefs, useHoldToPin } from "./svg";
import { FixtureElevation, fixtureHeight } from "./fixtures";
import { usePanZoom } from "./usePanZoom";
import type { ColorMode } from "./FloorCanvas";
import type { Controls, PinTarget, ScreenPoint } from "./target";

function useControls(controls: Controls, zoomBy: (f: number) => void, home: () => void) {
  useEffect(() => { controls({ zoomBy, home }); }, [controls, zoomBy, home]);
}

const FRAME = "#1b1a17";
const LIT = "#ffcf73";      // a window lit from inside, at night
const DOOR = "#7b5638";

function OpeningShape({ o, x0, x1, base, tint, lw, lit }: { o: Opening; x0: number; x1: number; base: number; tint: string | null; lw: number; lit?: boolean }) {
  const w = x1 - x0;
  if (o.kind === "window") {
    const top = base - 2100, bot = base - 900;
    return (
      <g>
        <rect x={x0 - 40} y={top - 40} width={w + 80} height={bot - top + 80} fill="#e9e1d1" />
        <rect x={x0} y={top} width={w} height={bot - top} fill={tint ?? (lit ? LIT : "#8fd3f0")} fillOpacity={lit && !tint ? 0.92 : 0.8} stroke={FRAME} strokeWidth={2 * lw} />
        <path d={`M${x0 + w / 2} ${top}V${bot}M${x0} ${top + (bot - top) * 0.45}H${x1}`} stroke={FRAME} strokeOpacity={0.75} strokeWidth={1.5 * lw} />
        <rect x={x0 - 70} y={bot + 40} width={w + 140} height={60} fill="#cfc6b5" stroke={FRAME} strokeOpacity={0.4} strokeWidth={lw} />
      </g>
    );
  }
  if (o.kind === "opening") {
    return <rect x={x0} y={base - 2400} width={w} height={2400} fill="#121311" fillOpacity={0.85} stroke="#f0ece3" strokeOpacity={0.45} strokeDasharray={`${6 * lw} ${4 * lw}`} strokeWidth={lw} />;
  }
  if (o.kind === "garage_door") {
    const h = 2300;
    return (
      <g>
        <rect x={x0} y={base - h} width={w} height={h} fill={tint ?? "#9c978d"} stroke={FRAME} strokeWidth={2 * lw} />
        {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${x0} ${base - h + (h / 5) * (i + 1)}H${x1}`} stroke={FRAME} strokeOpacity={0.45} strokeWidth={1.5 * lw} />)}
      </g>
    );
  }
  const h = 2100;
  const leaves = o.kind === "double_door" ? 2 : 1;
  return (
    <g>
      <rect x={x0 - 40} y={base - h - 40} width={w + 80} height={h + 40} fill="#e9e1d1" />
      <rect x={x0} y={base - h} width={w} height={h} fill={tint ?? (o.kind === "sliding_door" ? (lit ? LIT : "#8fd3f0") : DOOR)} fillOpacity={o.kind === "sliding_door" && !tint ? 0.8 : 1} stroke={FRAME} strokeWidth={2 * lw} />
      {o.kind !== "sliding_door" && Array.from({ length: leaves }, (_, i) => {
        const lx = x0 + (w / leaves) * i, lwid = w / leaves;
        return (
          <g key={i}>
            <rect x={lx + lwid * 0.16} y={base - h * 0.9} width={lwid * 0.68} height={h * 0.36} fill="none" stroke={FRAME} strokeOpacity={0.35} strokeWidth={lw} />
            <rect x={lx + lwid * 0.16} y={base - h * 0.48} width={lwid * 0.68} height={h * 0.38} fill="none" stroke={FRAME} strokeOpacity={0.35} strokeWidth={lw} />
            <rect x={(i === 0 && leaves === 2 ? lx + lwid - 110 : leaves === 2 ? lx + 70 : lx + lwid - 110)} y={base - h * 0.5} width={40} height={140} fill="#d8b46a" />
          </g>
        );
      })}
      {o.kind === "sliding_door" && <path d={`M${x0 + w / 2} ${base - h}V${base}`} stroke={FRAME} strokeWidth={2 * lw} />}
    </g>
  );
}

// ------------------------------------------------------------------------------ exterior

interface ExteriorProps {
  plan: Plan;
  pins: Pin[];
  selectedPin: string | null;
  pinMode: boolean;
  draft: PinTarget | null;
  onOpenFloor: (floorId: string) => void;
  onSelectPin: (id: string) => void;
  onPlacePin: (t: PinTarget, at: ScreenPoint) => void;
  controls: Controls;
  onLimitIn: () => void;
  onLimitOut: () => void;
}

export function ExteriorView(p: ExteriorProps) {
  const { plan } = p;
  const ref = useRef<SVGSVGElement>(null);
  const fv = useMemo(() => frontView(plan), [plan]);
  const top = -(fv.height + fv.roofPeak);
  // leave room on the right for the floor tags
  const home = useMemo(() => ({ x: fv.minX - 1200, y: top - 600, w: fv.width + 7800, h: -top + 1800 }), [fv, top]);
  const cb = useRef(p);
  cb.current = p;
  const pz = usePanZoom(ref, home, { minScale: 0.7, maxScale: 5, padding: 0.12, onLimit: (dir) => (dir === "in" ? cb.current.onLimitIn() : cb.current.onLimitOut()) });
  const { view, px: lw } = pz;
  const homeFn = useMemo(() => () => pz.setHome(home, true, 0.12), [pz.setHome, home]); // eslint-disable-line react-hooks/exhaustive-deps
  useControls(p.controls, pz.zoomBy, homeFn);
  const [hover, setHover] = useState<string | null>(null);
  const roofY = -fv.height;
  const x1 = Math.max(...fv.storeys.map((s) => s.x1));
  const x0 = Math.min(...fv.storeys.map((s) => s.x0));
  const topStorey = fv.storeys[fv.storeys.length - 1];

  const place = (e: { clientX: number; clientY: number }) => {
    const w = pz.toWorld(e.clientX, e.clientY);
    const st = fv.storeys.find((s) => w.y >= s.y0 && w.y <= s.y1 && w.x >= s.x0 && w.x <= s.x1);
    p.onPlacePin({ floorId: st?.floor.id ?? null, x: null, y: null, elementId: null, anchor: { view: "exterior", x: Math.round(w.x), y: Math.round(Math.min(0, w.y)) } }, { x: e.clientX, y: e.clientY });
  };
  const handlers = useHoldToPin(pz.handlers, place);
  const pins = p.pins.filter((x) => x.anchor?.view === "exterior");
  const draft = p.draft?.anchor?.view === "exterior" ? p.draft.anchor : null;

  return (
    <svg ref={ref} className={`w-full h-full block touch-none select-none ${p.pinMode ? "cursor-crosshair" : pz.dragging ? "cursor-grabbing" : ""}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} {...handlers}
      onClick={(e) => { if (p.pinMode) place(e); }} role="application" aria-label="Outside of the building">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f1012" /><stop offset="1" stopColor="#24221f" /></linearGradient>
        <pattern id="siding" width={4000} height={180} patternUnits="userSpaceOnUse"><rect width={4000} height={180} fill="#d6ccb9" /><path d="M0 178H4000" stroke="#a89d88" strokeWidth={14} /></pattern>
        <pattern id="slate" width={500} height={260} patternUnits="userSpaceOnUse"><rect width={500} height={260} fill="#3a3a3c" /><path d="M0 258H500M250 0V130M0 130V258M500 130V258" stroke="#29292b" strokeWidth={16} /></pattern>
        <radialGradient id="porch" cx="0.5" cy="0" r="0.8"><stop offset="0" stopColor="#ffcf73" stopOpacity={0.35} /><stop offset="1" stopColor="#ffcf73" stopOpacity={0} /></radialGradient>
      </defs>
      <rect x={fv.minX - 80000} y={top - 80000} width={fv.width + 160000} height={80000 - top} fill="url(#sky)" />
      <rect x={fv.minX - 80000} y={0} width={fv.width + 160000} height={60000} fill="#1d1f1b" />
      <rect x={fv.minX - 80000} y={0} width={fv.width + 160000} height={180} fill="#2c2f28" />
      {/* roof */}
      {topStorey && <path d={`M${topStorey.x0 - 450} ${roofY}L${(topStorey.x0 + topStorey.x1) / 2} ${roofY - fv.roofPeak}L${topStorey.x1 + 450} ${roofY}Z`} fill="url(#slate)" stroke={FRAME} strokeWidth={2 * lw} />}
      {topStorey && <path d={`M${topStorey.x0 - 450} ${roofY}H${topStorey.x1 + 450}`} stroke="#e9e1d1" strokeWidth={90} />}
      {fv.storeys.map((s) => {
        const hot = hover === s.floor.id;
        return (
          <g key={s.floor.id} className="cursor-pointer" onClick={(e) => { if (p.pinMode) return; e.stopPropagation(); p.onOpenFloor(s.floor.id); }} onPointerEnter={() => setHover(s.floor.id)} onPointerLeave={() => setHover(null)}>
            <rect x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} fill="url(#siding)" />
            {hot && <rect x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} fill={CHALK} fillOpacity={0.12} />}
            <rect x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} fill="none" stroke={hot ? CHALK : FRAME} strokeWidth={(hot ? 3 : 1.5) * lw} strokeDasharray={hot ? `${10 * lw} ${5 * lw}` : undefined} />
            {s.openings.map(({ o, x0: a, x1: b }, i) => <OpeningShape key={o.id} o={o} x0={a} x1={b} base={s.y1} tint={null} lw={lw} lit={(i + s.floor.level) % 3 !== 1} />)}
            {s.openings.filter(({ o }) => o.kind !== "window" && s.floor.level === 0).map(({ o, x0: a, x1: b }) => <rect key={`l${o.id}`} x={a - 900} y={s.y1 - 2600} width={b - a + 1800} height={2600} fill="url(#porch)" pointerEvents="none" />)}
            <rect x={s.x0} y={s.y1 - 90} width={s.x1 - s.x0} height={90} fill="#8e877a" />
          </g>
        );
      })}
      {/* storey tags you can click */}
      {fv.storeys.map((s) => {
        const hot = hover === s.floor.id;
        const y = (s.y0 + s.y1) / 2;
        const label = `${s.floor.name.toUpperCase()}`;
        const w = label.length * 7.6 * lw + 34 * lw;
        return (
          <g key={`t${s.floor.id}`} transform={`translate(${x1 + 900} ${y})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); p.onOpenFloor(s.floor.id); }} onPointerEnter={() => setHover(s.floor.id)} onPointerLeave={() => setHover(null)}>
            <path d={`M${-900 + 120} 0H-${10 * lw}`} stroke={hot ? CHALK : "#77736a"} strokeWidth={1.5 * lw} strokeDasharray={`${4 * lw} ${3 * lw}`} />
            <rect x={0} y={-13 * lw} width={w} height={26 * lw} rx={2 * lw} fill={hot ? "#ff7d3b" : "#ff6a1f"} stroke="#1c0c03" strokeWidth={1.2 * lw} />
            <text x={10 * lw} y={5.5 * lw} fontSize={14.5 * lw} fontFamily="var(--font-display)" fontWeight={800} letterSpacing={1 * lw} fill="#1c0c03">{label}</text>
            <path d={`M${w - 14 * lw} ${-4 * lw}L${w - 9 * lw} 0L${w - 14 * lw} ${4 * lw}`} fill="none" stroke="#1c0c03" strokeWidth={2 * lw} />
          </g>
        );
      })}
      <text x={x0} y={700 + 14 * lw} fontSize={11.5 * lw} fontFamily="var(--font-mono)" fill="#77736a">FRONT, ESTIMATED FROM THE PLAN · {(fv.width / 1000).toFixed(1)} M WIDE</text>
      {pins.map((pin) => <PinFlag key={pin.id} pin={pin} x={pin.anchor!.x} y={pin.anchor!.y} px={lw} selected={p.selectedPin === pin.id} onClick={(e) => { e.stopPropagation(); p.onSelectPin(pin.id); }} />)}
      {draft && <DraftFlag x={draft.x} y={draft.y} px={lw} />}
    </svg>
  );
}

// ------------------------------------------------------------------------------ one wall, from inside

interface WallProps {
  floor: Floor;
  room: Room;
  side: WallSide;
  selected: string | null;
  selectedPin: string | null;
  states: Map<string, ElementStatus>;
  pins: Pin[];
  colorMode: ColorMode;
  pinMode: boolean;
  draft: PinTarget | null;
  onSelect: (id: string | null) => void;
  onSelectPin: (id: string) => void;
  onPlacePin: (t: PinTarget, at: ScreenPoint) => void;
  onUp: () => void;
  controls: Controls;
}

const openTop = (o: Opening) => (o.kind === "window" ? 2100 : o.kind === "garage_door" ? 2300 : o.kind === "opening" ? 2400 : 2100);
const openBottom = (o: Opening) => (o.kind === "window" ? 900 : 0);

export function WallView(p: WallProps) {
  const { floor, side, selected, states, colorMode } = p;
  const ref = useRef<SVGSVGElement>(null);
  const H = floor.height_mm || 2700;
  const L = side.length;
  const home = useMemo(() => ({ x: -400, y: -H - 500, w: L + 800, h: H + 1400 }), [L, H]);
  const cb = useRef(p);
  cb.current = p;
  const pz = usePanZoom(ref, home, { minScale: 0.7, maxScale: 8, padding: 0.06, onLimit: (dir) => { if (dir === "out") cb.current.onUp(); } });
  const { view, px: lw } = pz;
  const homeFn = useMemo(() => () => pz.setHome(home, true, 0.06), [pz.setHome, home]); // eslint-disable-line react-hooks/exhaustive-deps
  useControls(p.controls, pz.zoomBy, homeFn);
  useEffect(() => { pz.setHome(home, false); }, [home]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hover, setHover] = useState<string | null>(null);
  const tint = (id: string) => (colorMode === "progress" ? (states.get(id) ? STATUS_COLOR[states.get(id)!] : null) : null);

  const walls = side.segments.filter((s) => s.kind === "wall");
  const openings = side.segments.filter((s) => s.kind === "opening");
  const attached = useMemo(() => attachedToSide(floor, side), [floor, side]);
  const ids = new Set([...side.segments.map((s) => s.id), ...attached.map((a) => a.f.id)]);

  // where each pin sits on this wall: its own spot if it was dropped here, else above its element
  const pins = p.pins.flatMap((pin) => {
    if (pin.anchor?.view === "wall") return pin.anchor.side === side.key ? [{ pin, x: pin.anchor.x, y: pin.anchor.y }] : [];
    if (!pin.element_id || !ids.has(pin.element_id)) return [];
    const seg = side.segments.find((s) => s.id === pin.element_id);
    if (seg) return [{ pin, x: (seg.from + seg.to) / 2, y: seg.kind === "opening" ? -openTop(seg.el as Opening) - 150 : -H * 0.6 }];
    const a = attached.find((x) => x.f.id === pin.element_id)!;
    return [{ pin, x: (a.from + a.to) / 2, y: -fixtureHeight(a.f.kind) - 120 }];
  });

  const place = (e: { clientX: number; clientY: number }) => {
    const w = pz.toWorld(e.clientX, e.clientY);
    const x = Math.max(0, Math.min(L, w.x)), y = Math.max(-H, Math.min(0, w.y));
    const fix = attached.find((a) => x >= a.from && x <= a.to && -y <= fixtureHeight(a.f.kind));
    const op = openings.find((s) => x >= s.from && x <= s.to && -y >= openBottom(s.el as Opening) && -y <= openTop(s.el as Opening));
    const wall = walls.find((s) => x >= s.from && x <= s.to) ?? [...walls].sort((a, b) => b.to - b.from - (a.to - a.from))[0];
    const elementId = fix?.f.id ?? op?.id ?? wall?.id ?? null;
    p.onPlacePin({ floorId: floor.id, x: null, y: null, elementId, anchor: { view: "wall", side: side.key, x: Math.round(x), y: Math.round(y) } }, { x: e.clientX, y: e.clientY });
  };
  const handlers = useHoldToPin(pz.handlers, place);
  const click = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (p.pinMode) return place(e);
    p.onSelect(id);
  };
  const draft = p.draft?.anchor?.view === "wall" && p.draft.anchor.side === side.key ? p.draft.anchor : null;
  const mat = ROOM_MATERIAL[p.room.type] ?? "concrete";

  return (
    <svg ref={ref} className={`w-full h-full block touch-none select-none ${p.pinMode ? "cursor-crosshair" : pz.dragging ? "cursor-grabbing" : ""}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} {...handlers}
      onClick={(e) => (p.pinMode ? place(e) : p.onSelect(null))} role="application" aria-label={`${side.heading} wall`}>
      <PlanDefs />
      <rect x={-50000} y={-50000} width={100000 + L} height={100000} fill="#141513" />
      {/* floor (in the room's material, seen in perspective as a strip) and ceiling */}
      <rect x={-300} y={0} width={L + 600} height={320} fill={`url(#mat-${mat})`} />
      <rect x={-300} y={0} width={L + 600} height={320} fill="#000" fillOpacity={0.25} />
      <rect x={-300} y={-H - 160} width={L + 600} height={160} fill="#2a2b2e" />
      {/* the wall face, then each wall piece on top so it can be picked */}
      <rect x={0} y={-H} width={L} height={H} fill="#d8d0c0" />
      {walls.map((s) => {
        const sel = selected === s.id, hot = hover === s.id;
        return (
          <rect key={s.id} x={s.from} y={-H} width={s.to - s.from} height={H} fill={tint(s.id) ?? (hot ? "#fbf8f2" : WALL_TOP)} stroke={sel ? CHALK : "#00000030"} strokeWidth={(sel ? 3 : 1) * lw}
            className="cursor-pointer" onClick={click(s.id)} onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)} />
        );
      })}
      {walls.filter((s) => selected === s.id).map((s) => <rect key={`sel${s.id}`} x={s.from} y={-H} width={s.to - s.from} height={H} fill={CHALK} fillOpacity={0.1} stroke={CHALK} strokeWidth={3 * lw} strokeDasharray={`${10 * lw} ${5 * lw}`} pointerEvents="none" />)}
      {/* skirting */}
      <rect x={0} y={-100} width={L} height={100} fill="#f6f1e7" stroke="#00000022" strokeWidth={lw} pointerEvents="none" />
      {openings.map((s) => {
        const o = s.el as Opening;
        const sel = selected === s.id, hot = hover === s.id;
        return (
          <g key={s.id} className="cursor-pointer" onClick={click(s.id)} onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)}>
            <OpeningShape o={o} x0={s.from} x1={s.to} base={0} tint={tint(s.id)} lw={lw} />
            {(sel || hot) && <rect x={s.from - 40} y={-openTop(o) - 40} width={s.to - s.from + 80} height={openTop(o) - openBottom(o) + 80} fill="none" stroke={sel ? CHALK : "#fff"} strokeWidth={2.5 * lw} strokeDasharray={sel ? `${8 * lw} ${4 * lw}` : undefined} />}
            <text x={(s.from + s.to) / 2} y={-openTop(o) - 110} textAnchor="middle" fontSize={10.5 * lw} fontFamily="var(--font-mono)" fill="#4a463e">{s.id} · {Math.round(o.width_mm)}</text>
          </g>
        );
      })}
      {/* things standing against this wall */}
      {attached.map((a, i) => {
        const sel = selected === a.f.id, hot = hover === a.f.id;
        const row = i > 0 && a.from - attached[i - 1].to < 900 && i % 2 === 1 ? 1 : 0; // stagger labels that would collide
        const h = fixtureHeight(a.f.kind);
        return (
          <g key={a.f.id} className="cursor-pointer" onClick={click(a.f.id)} onPointerEnter={() => setHover(a.f.id)} onPointerLeave={() => setHover(null)}>
            <FixtureElevation f={a.f} x0={a.from} x1={a.to} lw={lw} tint={tint(a.f.id)} />
            <rect x={a.from - 30} y={-h - 30} width={a.to - a.from + 60} height={h + 30} fill={sel ? CHALK : "#fff"} fillOpacity={sel ? 0.14 : hot ? 0.1 : 0} stroke={sel ? CHALK : hot ? "#fff" : "transparent"} strokeWidth={2 * lw} strokeDasharray={sel ? `${8 * lw} ${4 * lw}` : undefined} />
            <text x={(a.from + a.to) / 2} y={160 + 11 * lw + row * 16 * lw} textAnchor="middle" fontSize={10.5 * lw} fontFamily="var(--font-mono)" fill="#f0ece3" style={{ paintOrder: "stroke" }} stroke="#141513" strokeWidth={3 * lw}>{a.f.kind === "other" ? a.f.id : `${a.f.name.toUpperCase()} · ${a.f.id}`}</text>
          </g>
        );
      })}
      {/* dimension lines */}
      <g pointerEvents="none" stroke="#77736a" strokeWidth={lw}>
        <path d={`M0 ${620}H${L}M0 ${520}V${720}M${L} ${520}V${720}`} />
        <path d={`M${-220} 0V${-H}M${-320} 0H${-120}M${-320} ${-H}H${-120}`} />
      </g>
      <text x={L / 2} y={620 - 8 * lw} textAnchor="middle" fontSize={12 * lw} fontFamily="var(--font-mono)" fill="#cfc8ba" pointerEvents="none">{(L / 1000).toFixed(2)} m</text>
      <text x={-240 - 4 * lw} y={-H / 2} textAnchor="end" fontSize={12 * lw} fontFamily="var(--font-mono)" fill="#cfc8ba" pointerEvents="none">{(H / 1000).toFixed(1)} m</text>
      {pins.map(({ pin, x, y }) => <PinFlag key={pin.id} pin={pin} x={x} y={y} px={lw} selected={p.selectedPin === pin.id} onClick={(e) => { e.stopPropagation(); p.onSelectPin(pin.id); }} />)}
      {draft && <DraftFlag x={draft.x} y={draft.y} px={lw} />}
      {!side.segments.length && <text x={L / 2} y={-H / 2} textAnchor="middle" fontSize={13 * lw} fill="#77736a">No walls or openings matched to this side yet</text>}
    </svg>
  );
}
