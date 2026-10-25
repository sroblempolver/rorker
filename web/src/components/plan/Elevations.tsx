"use client";
// Two upright views: the outside of the building (estimated front elevation, one band per storey) and
// a single wall of a room seen from inside, with its doors and windows to scale.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Pin } from "@/lib/data/types";
import { frontView, type WallSide } from "@/lib/plan/geometry";
import type { ElementStatus, Floor, Opening, Plan } from "@/lib/plan/types";
import { GLASS, PIN_COLOR, STATUS_COLOR, WALL_FILL } from "./style";
import { usePanZoom } from "./usePanZoom";
import type { ColorMode } from "./FloorCanvas";

type Controls = (api: { zoomBy: (f: number) => void; home: () => void }) => void;

function useControls(controls: Controls, zoomBy: (f: number) => void, home: () => void) {
  useEffect(() => { controls({ zoomBy, home }); }, [controls, zoomBy, home]);
}

function OpeningShape({ o, x0, x1, base, tint, lw }: { o: Opening; x0: number; x1: number; base: number; tint: string | null; lw: number }) {
  const w = x1 - x0;
  if (o.kind === "window") {
    const top = base - 2100, bot = base - 900;
    return (
      <g>
        <rect x={x0} y={top} width={w} height={bot - top} fill={tint ?? GLASS} fillOpacity={0.85} stroke="#0f141a" strokeWidth={2 * lw} />
        <path d={`M${x0 + w / 2} ${top}V${bot}M${x0} ${top + (bot - top) * 0.45}H${x1}`} stroke="#0f141a" strokeOpacity={0.7} strokeWidth={1.5 * lw} />
        <rect x={x0 - 40} y={bot} width={w + 80} height={50} fill="#9aa5b2" />
      </g>
    );
  }
  if (o.kind === "opening") {
    return <rect x={x0} y={base - 2400} width={w} height={2400} fill="#0f141a" fillOpacity={0.9} stroke="#c8d0da" strokeOpacity={0.4} strokeDasharray={`${6 * lw} ${4 * lw}`} strokeWidth={lw} />;
  }
  if (o.kind === "garage_door") {
    const h = 2300;
    return (
      <g>
        <rect x={x0} y={base - h} width={w} height={h} fill={tint ?? "#56606c"} stroke="#0f141a" strokeWidth={2 * lw} />
        {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${x0} ${base - h + (h / 5) * (i + 1)}H${x1}`} stroke="#0f141a" strokeOpacity={0.5} strokeWidth={1.5 * lw} />)}
      </g>
    );
  }
  const h = 2100;
  const leaves = o.kind === "double_door" ? 2 : 1;
  return (
    <g>
      <rect x={x0} y={base - h} width={w} height={h} fill={tint ?? "#8a6a4a"} stroke="#0f141a" strokeWidth={2 * lw} />
      {Array.from({ length: leaves }, (_, i) => {
        const lx = x0 + (w / leaves) * i, lwid = w / leaves;
        return (
          <g key={i}>
            <rect x={lx + lwid * 0.14} y={base - h * 0.9} width={lwid * 0.72} height={h * 0.36} rx={20} fill="none" stroke="#0f141a" strokeOpacity={0.35} strokeWidth={lw} />
            <rect x={lx + lwid * 0.14} y={base - h * 0.48} width={lwid * 0.72} height={h * 0.38} rx={20} fill="none" stroke="#0f141a" strokeOpacity={0.35} strokeWidth={lw} />
            <circle cx={i === 0 && leaves === 2 ? lx + lwid - 90 : leaves === 2 ? lx + 90 : lx + lwid - 90} cy={base - h * 0.48} r={35} fill="#e6c88f" />
          </g>
        );
      })}
    </g>
  );
}

// ------------------------------------------------------------------------------ exterior

export function ExteriorView({ plan, onOpenFloor, controls, onLimitIn }: { plan: Plan; onOpenFloor: (floorId: string) => void; controls: Controls; onLimitIn: () => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const fv = useMemo(() => frontView(plan), [plan]);
  const top = -(fv.height + fv.roofPeak);
  // leave room on the right for the floor tags
  const home = useMemo(() => ({ x: fv.minX - 1200, y: top - 600, w: fv.width + 7800, h: -top + 1800 }), [fv, top]);
  const cb = useRef({ onLimitIn });
  cb.current = { onLimitIn };
  const pz = usePanZoom(ref, home, { minScale: 0.7, maxScale: 5, padding: 0.12, onLimit: (dir) => { if (dir === "in") cb.current.onLimitIn(); } });
  const { view, px: lw } = pz;
  const homeFn = useMemo(() => () => pz.setHome(home, true, 0.12), [pz.setHome, home]); // eslint-disable-line react-hooks/exhaustive-deps
  useControls(controls, pz.zoomBy, homeFn);
  const [hover, setHover] = useState<string | null>(null);
  const roofY = -fv.height;
  const x0 = Math.min(...fv.storeys.map((s) => s.x0)), x1 = Math.max(...fv.storeys.map((s) => s.x1));
  const topStorey = fv.storeys[fv.storeys.length - 1];

  return (
    <svg ref={ref} className={`w-full h-full block touch-none select-none ${pz.dragging ? "cursor-grabbing" : ""}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} {...pz.handlers} role="application" aria-label="Outside of the building">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#101822" /><stop offset="1" stopColor="#18222e" /></linearGradient>
        <linearGradient id="roofg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a3d33" /><stop offset="1" stopColor="#3f2b25" /></linearGradient>
      </defs>
      <rect x={fv.minX - 80000} y={top - 80000} width={fv.width + 160000} height={80000 - top} fill="url(#sky)" />
      <rect x={fv.minX - 80000} y={0} width={fv.width + 160000} height={60000} fill="#17201a" />
      <rect x={fv.minX - 80000} y={0} width={fv.width + 160000} height={260} fill="#26352a" />
      {/* roof */}
      {topStorey && <path d={`M${topStorey.x0 - 450} ${roofY}L${(topStorey.x0 + topStorey.x1) / 2} ${roofY - fv.roofPeak}L${topStorey.x1 + 450} ${roofY}Z`} fill="url(#roofg)" stroke="#2a1d19" strokeWidth={2 * lw} />}
      {fv.storeys.map((s) => {
        const hot = hover === s.floor.id;
        return (
          <g key={s.floor.id} className="cursor-pointer" onClick={() => onOpenFloor(s.floor.id)} onPointerEnter={() => setHover(s.floor.id)} onPointerLeave={() => setHover(null)}>
            <rect x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} fill={hot ? "#4a5666" : "#3b4554"} stroke={hot ? "var(--accent)" : "#232a33"} strokeWidth={(hot ? 3 : 2) * lw} />
            {/* siding lines */}
            {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${s.x0} ${s.y0 + ((s.y1 - s.y0) / 10) * (i + 1)}H${s.x1}`} stroke="#000" strokeOpacity={0.08} strokeWidth={lw} />)}
            {s.openings.map(({ o, x0: a, x1: b }) => <OpeningShape key={o.id} o={o} x0={a} x1={b} base={s.y1} tint={null} lw={lw} />)}
            <rect x={s.x0} y={s.y1 - 120} width={s.x1 - s.x0} height={120} fill="#252c35" />
          </g>
        );
      })}
      {/* storey tags you can click */}
      {fv.storeys.map((s) => {
        const hot = hover === s.floor.id;
        const y = (s.y0 + s.y1) / 2;
        const label = `${s.floor.name}  ›`;
        const w = label.length * 7.4 * lw + 20 * lw;
        return (
          <g key={`t${s.floor.id}`} transform={`translate(${x1 + 900} ${y})`} className="cursor-pointer" onClick={() => onOpenFloor(s.floor.id)} onPointerEnter={() => setHover(s.floor.id)} onPointerLeave={() => setHover(null)}>
            <path d={`M${-900 + 120} 0H-${10 * lw}`} stroke={hot ? "var(--accent)" : "#5d6875"} strokeWidth={1.5 * lw} strokeDasharray={`${4 * lw} ${3 * lw}`} />
            <rect x={0} y={-14 * lw} width={w} height={28 * lw} rx={14 * lw} fill={hot ? "var(--accent)" : "#161b22"} stroke={hot ? "var(--accent)" : "#3a4552"} strokeWidth={1.2 * lw} />
            <text x={w / 2} y={5 * lw} textAnchor="middle" fontSize={13 * lw} fontFamily="var(--font-display)" fontWeight={600} letterSpacing={0.6 * lw} fill={hot ? "#1a1206" : "#e7eaee"}>{label}</text>
          </g>
        );
      })}
      <text x={x0} y={700 + 14 * lw} fontSize={12 * lw} fill="#8f9aa7">Front, estimated from the plan · {(fv.width / 1000).toFixed(1)} m wide</text>
    </svg>
  );
}

// ------------------------------------------------------------------------------ one wall, from inside

interface WallProps {
  floor: Floor;
  side: WallSide;
  selected: string | null;
  selectedPin: string | null;
  states: Map<string, ElementStatus>;
  pins: Pin[];
  colorMode: ColorMode;
  pinMode: boolean;
  onSelect: (id: string | null) => void;
  onSelectPin: (id: string) => void;
  onPlacePin: (x: number | null, y: number | null, elementId: string | null) => void;
  onUp: () => void;
  controls: Controls;
}

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
  const ids = new Set(side.segments.map((s) => s.id));
  const pins = p.pins.filter((x) => x.element_id && ids.has(x.element_id));

  const click = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (p.pinMode) return p.onPlacePin(null, null, id);
    p.onSelect(id);
  };

  return (
    <svg ref={ref} className={`w-full h-full block touch-none select-none ${p.pinMode ? "cursor-crosshair" : pz.dragging ? "cursor-grabbing" : ""}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} {...pz.handlers} onClick={() => p.onSelect(null)} role="application" aria-label={`${side.heading} wall`}>
      <rect x={-50000} y={-50000} width={100000 + L} height={100000} fill="#0f141a" />
      {/* floor and ceiling */}
      <rect x={-300} y={0} width={L + 600} height={220} fill="#3a3027" />
      <rect x={-300} y={-H - 160} width={L + 600} height={160} fill="#2a323c" />
      {/* the base wall face, then each wall piece on top so it can be picked */}
      <rect x={0} y={-H} width={L} height={H} fill="#c3cad3" />
      {walls.map((s) => {
        const sel = selected === s.id, hot = hover === s.id;
        return (
          <rect key={s.id} x={s.from} y={-H} width={s.to - s.from} height={H} fill={tint(s.id) ?? (hot ? "#e9edf2" : WALL_FILL)} stroke={sel ? "var(--accent)" : "#9aa5b2"} strokeWidth={(sel ? 3 : 1) * lw}
            className="cursor-pointer" onClick={click(s.id)} onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)} />
        );
      })}
      {/* skirting */}
      <rect x={0} y={-90} width={L} height={90} fill="#e9edf2" opacity={0.9} pointerEvents="none" />
      {openings.map((s) => {
        const o = s.el as Opening;
        const sel = selected === s.id, hot = hover === s.id;
        return (
          <g key={s.id} className="cursor-pointer" onClick={click(s.id)} onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)}>
            <OpeningShape o={o} x0={s.from} x1={s.to} base={0} tint={tint(s.id)} lw={lw} />
            {(sel || hot) && <rect x={s.from - 30} y={-(o.kind === "window" ? 2130 : 2430)} width={s.to - s.from + 60} height={o.kind === "window" ? 1260 : 2430} fill="none" stroke={sel ? "var(--accent)" : "#fff"} strokeWidth={2.5 * lw} rx={20} />}
            <text x={(s.from + s.to) / 2} y={-(o.kind === "window" ? 2100 : 2400) - 120} textAnchor="middle" fontSize={11 * lw} fill="#aab4c0">{o.name} · {Math.round(o.width_mm)}</text>
          </g>
        );
      })}
      {/* dimension line */}
      <g pointerEvents="none" stroke="#5d6875" strokeWidth={lw}>
        <path d={`M0 ${520}H${L}M0 ${420}V${620}M${L} ${420}V${620}`} />
      </g>
      <text x={L / 2} y={520 - 8 * lw} textAnchor="middle" fontSize={12 * lw} fill="#c8d0da" pointerEvents="none">{(L / 1000).toFixed(2)} m</text>
      <text x={-150} y={-H / 2} textAnchor="end" fontSize={12 * lw} fill="#8f9aa7" pointerEvents="none">{(H / 1000).toFixed(1)} m</text>
      {/* pins on this wall's pieces */}
      {pins.map((pin, i) => {
        const seg = side.segments.find((s) => s.id === pin.element_id)!;
        const x = (seg.from + seg.to) / 2 + (i % 3) * 26 * lw;
        const y = -H * 0.6;
        const sel = p.selectedPin === pin.id;
        const color = pin.status === "done" ? "#4cb782" : PIN_COLOR[pin.kind];
        return (
          <g key={pin.id} transform={`translate(${x} ${y}) scale(${(sel ? 1.25 : 1) * lw})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); p.onSelectPin(pin.id); }}>
            <path d="M0 0 C-3 -7 -11 -11 -11 -20 A11 11 0 1 1 11 -20 C11 -11 3 -7 0 0Z" fill={color} stroke={sel ? "#fff" : "#0f141a"} strokeWidth={sel ? 2 : 1.2} />
            <text y={-16} textAnchor="middle" fontSize={11} fontWeight={700} fill="#14100a">{pin.status === "done" ? "✓" : pin.number}</text>
          </g>
        );
      })}
      {!side.segments.length && <text x={L / 2} y={-H / 2} textAnchor="middle" fontSize={13 * lw} fill="#5d6875">No walls or openings matched to this side yet</text>}
    </svg>
  );
}
