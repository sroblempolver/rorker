// Shared SVG pieces for every plan view: floor material patterns and the survey-flag pin marker.
import { useRef, useState } from "react";
import type { Pin } from "@/lib/data/types";
import { MATERIAL_BASE, PIN_COLOR } from "./style";

/** Patterns are in millimetres (userSpaceOnUse), so boards and tiles stay true to scale as you zoom. */
export function PlanDefs({ id = "" }: { id?: string }) {
  const m = MATERIAL_BASE;
  return (
    <defs>
      {/* oak: 160 mm boards, staggered joints */}
      <pattern id={`mat-oak${id}`} width={1800} height={480} patternUnits="userSpaceOnUse">
        <rect width={1800} height={480} fill={m.oak} />
        <rect y={160} width={1800} height={160} fill="#a5835d" />
        <path d="M0 0H1800M0 160H1800M0 320H1800M420 0V160M1260 0V160M0 160V320M900 160V320M600 320V480M1500 320V480" stroke="#6f5338" strokeWidth={9} />
      </pattern>
      <pattern id={`mat-walnut${id}`} width={1500} height={420} patternUnits="userSpaceOnUse">
        <rect width={1500} height={420} fill={m.walnut} />
        <rect y={140} width={1500} height={140} fill="#76563c" />
        <path d="M0 0H1500M0 140H1500M0 280H1500M300 0V140M1100 0V140M700 140V280M0 280V420M1300 280V420" stroke="#4a3424" strokeWidth={9} />
      </pattern>
      {/* porcelain: 600 mm tiles with grout */}
      <pattern id={`mat-tile${id}`} width={600} height={600} patternUnits="userSpaceOnUse">
        <rect width={600} height={600} fill={m.tile} />
        <rect x={0} y={0} width={300} height={300} fill="#96a2a5" />
        <rect x={300} y={300} width={300} height={300} fill="#96a2a5" />
        <path d="M0 0H600M0 300H600M0 0V600M300 0V600" stroke="#6e797c" strokeWidth={14} />
      </pattern>
      <pattern id={`mat-bathtile${id}`} width={200} height={200} patternUnits="userSpaceOnUse">
        <rect width={200} height={200} fill={m.bathtile} />
        <path d="M0 0H200M0 100H200M0 0V200M100 0V200" stroke="#7f9599" strokeWidth={8} />
      </pattern>
      <pattern id={`mat-concrete${id}`} width={900} height={900} patternUnits="userSpaceOnUse">
        <rect width={900} height={900} fill={m.concrete} />
        <circle cx={120} cy={200} r={18} fill="#5f5d58" /><circle cx={610} cy={90} r={12} fill="#7a7872" /><circle cx={420} cy={520} r={22} fill="#5f5d58" />
        <circle cx={760} cy={700} r={14} fill="#7a7872" /><circle cx={260} cy={780} r={10} fill="#5f5d58" />
        <path d="M0 0H900M0 0V900" stroke="#5a5853" strokeWidth={10} />
      </pattern>
      <pattern id={`mat-carpet${id}`} width={120} height={120} patternUnits="userSpaceOnUse">
        <rect width={120} height={120} fill={m.carpet} />
        <circle cx={30} cy={30} r={9} fill="#777c8f" /><circle cx={90} cy={90} r={9} fill="#686d7f" />
      </pattern>
      <pattern id={`mat-deck${id}`} width={1200} height={300} patternUnits="userSpaceOnUse">
        <rect width={1200} height={300} fill={m.deck} />
        <path d="M0 0H1200M0 150H1200" stroke="#4d3a2a" strokeWidth={20} />
      </pattern>
      <pattern id={`hatch${id}`} width={260} height={260} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={260} stroke="#db4ea6" strokeWidth={70} opacity={0.75} />
      </pattern>
      <pattern id={`stripes${id}`} width={300} height={300} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect width={300} height={300} fill="#ff6a1f" /><rect width={150} height={300} fill="#1c0c03" />
      </pattern>
    </defs>
  );
}

/** A survey flag on a stake: the pin marker everywhere on the plan. Drawn in screen pixels; pass the
 *  size of one pixel in world units as `px`. */
export function PinFlag({ pin, x, y, px, selected, onClick, onPointerDown, lifted }: {
  pin: Pin; x: number; y: number; px: number; selected?: boolean; onClick?: (e: React.MouseEvent) => void;
  /** start dragging the pin */
  onPointerDown?: (e: React.PointerEvent) => void; lifted?: boolean;
}) {
  const color = pin.status === "done" ? "#3fb46a" : PIN_COLOR[pin.kind];
  const s = (selected ? 1.25 : 1) * px;
  const label = pin.status === "done" ? "✓" : String(pin.number);
  const w = Math.max(22, label.length * 7 + 14);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={onPointerDown ? (lifted ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer"} onClick={onClick} onPointerDown={onPointerDown} opacity={pin.status === "done" ? 0.8 : 1}>
      <ellipse cx={0} cy={0} rx={lifted ? 9 : 6} ry={lifted ? 3.4 : 2.4} fill="#000" opacity={lifted ? 0.3 : 0.45} />
      <line x1={0} y1={0} x2={0} y2={-38} stroke="#f0ece3" strokeWidth={2.2} strokeLinecap="round" />
      <path d={`M1 -38H${w}L${w - 6} -30.5L${w} -23H1Z`} fill={color} stroke={selected ? "#fff" : "#111"} strokeWidth={selected ? 1.8 : 1} />
      <text x={(w - 5) / 2 + 1} y={-26.5} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="var(--font-mono)" fill="#120c06">{label}</text>
      {selected && <circle cx={0} cy={0} r={9} fill="none" stroke="#55b2ff" strokeWidth={1.6} />}
    </g>
  );
}

/** The ghost flag where a new pin is about to go. */
export function DraftFlag({ x, y, px }: { x: number; y: number; px: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${px})`} pointerEvents="none">
      <circle r={14} fill="none" stroke="#55b2ff" strokeWidth={2} strokeDasharray="4 3" />
      <line x1={0} y1={0} x2={0} y2={-38} stroke="#f0ece3" strokeWidth={2.2} />
      <path d="M1 -38H24L18 -30.5L24 -23H1Z" fill="#55b2ff" stroke="#111" />
    </g>
  );
}

/** Press and hold (touch) or right-click anywhere on a view to drop a pin right there. Wraps the
 *  pan/zoom handlers so a drag still pans. */
export function useHoldToPin<H extends Record<"onPointerDown" | "onPointerMove" | "onPointerUp", (e: React.PointerEvent) => void>>(handlers: H, place: (e: { clientX: number; clientY: number }) => void) {
  const hold = useRef<{ t: number; x: number; y: number } | null>(null);
  const placeRef = useRef(place);
  placeRef.current = place;
  return {
    ...handlers,
    onPointerDown: (e: React.PointerEvent) => {
      handlers.onPointerDown(e);
      if (e.pointerType !== "mouse") {
        const pt = { clientX: e.clientX, clientY: e.clientY };
        hold.current = { t: window.setTimeout(() => { hold.current = null; placeRef.current(pt); }, 600), x: e.clientX, y: e.clientY };
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      handlers.onPointerMove(e);
      if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 8) { clearTimeout(hold.current.t); hold.current = null; }
    },
    onPointerUp: (e: React.PointerEvent) => {
      handlers.onPointerUp(e);
      if (hold.current) { clearTimeout(hold.current.t); hold.current = null; }
    },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); placeRef.current(e); },
  };
}

/** Drag something across a view in world units. `start` goes in the thing's onPointerDown; it stops
 *  the view from panning, follows the pointer (a few pixels of slack so a plain click stays a click)
 *  and calls `drop` once with the final spot. `drag` is the live position, for drawing. */
export function useWorldDrag(toWorld: (cx: number, cy: number) => { x: number; y: number }) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const start = (
    id: string, e: React.PointerEvent, origin: { x: number; y: number },
    drop: (x: number, y: number) => void, fit: (p: { x: number; y: number }, free: boolean) => { x: number; y: number } = (p) => p,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const w0 = toWorld(e.clientX, e.clientY);
    const off = { x: origin.x - w0.x, y: origin.y - w0.y };
    const sx = e.clientX, sy = e.clientY;
    let last = origin, moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      moved = true;
      const w = toWorld(ev.clientX, ev.clientY);
      last = fit({ x: w.x + off.x, y: w.y + off.y }, ev.shiftKey);
      setDrag({ id, ...last });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      if (moved) drop(last.x, last.y);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  return { drag, start };
}

/** A blinking dot where the assistant is pointing ("the bedroom with the blue dot"), with its name. */
export function MarkDot({ x, y, color, label, px }: { x: number; y: number; color: string; label: string; px: number }) {
  const r = 9 * px;
  return (
    <g pointerEvents="none">
      {/* blinks for 10 seconds, fading over the last 1.5 */}
      <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.85;1" dur="10s" fill="freeze" />
      <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={3 * px}>
        <animate attributeName="r" values={`${r};${r * 4}`} dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r={r} fill={color} stroke="#141513" strokeWidth={2.5 * px}>
        <animate attributeName="opacity" values="1;0.35;1" dur="0.9s" repeatCount="indefinite" />
      </circle>
      {label && <text x={x} y={y - r - 8 * px} textAnchor="middle" fontSize={12 * px} fontWeight={600} fontFamily="var(--font-sans, sans-serif)" fill={color} stroke="#141513" strokeWidth={3.5 * px} style={{ paintOrder: "stroke" }}>{label}</text>}
    </g>
  );
}
