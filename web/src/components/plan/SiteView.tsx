"use client";
// The whole project from above: the lot, the street, the drive and the building with every floor's
// progress. Zoom out from the house and you land here; zoom into the building to go back in. The site
// takes pins too (skip bin here, deliveries at the gate, keep the tree).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Pin } from "@/lib/data/types";
import { bboxOf, findElement, pathD, siteLayout } from "@/lib/plan/geometry";
import type { ElementStatus, Plan } from "@/lib/plan/types";
import { CHALK, ROOM_MATERIAL, STATUS_COLOR, WALL_EXT_TOP, WALL_SIDE, WALL_TOP } from "./style";
import { DraftFlag, PinFlag, PlanDefs, useHoldToPin } from "./svg";
import { usePanZoom } from "./usePanZoom";
import type { ColorMode } from "./FloorCanvas";
import type { Controls, PinTarget, ScreenPoint } from "./target";

interface Props {
  plan: Plan;
  jobName: string;
  pins: Pin[];
  states: Map<string, ElementStatus>;
  colorMode: ColorMode;
  selectedPin: string | null;
  pinMode: boolean;
  draft: PinTarget | null;
  onOpenBuilding: () => void;
  onSelectPin: (id: string) => void;
  onPlacePin: (t: PinTarget, at: ScreenPoint) => void;
  onLimitOut: () => void;
  controls: Controls;
}

export function SiteView(p: Props) {
  const { plan } = p;
  const ref = useRef<SVGSVGElement>(null);
  const site = useMemo(() => siteLayout(plan), [plan]);
  const ground = useMemo(() => [...plan.floors].sort((a, b) => a.level - b.level)[0], [plan]);
  const { lot, street, building: bb } = site;
  const home = useMemo(() => {
    const y0 = Math.min(lot[1], street[1]), y1 = Math.max(lot[3], street[3]);
    // extra ground on the left so the project board doesn't sit on the lot
    const w = lot[2] - lot[0];
    return { x: lot[0] - w * 0.75, y: y0, w: w * 1.75, h: y1 - y0 };
  }, [lot, street]);
  const cb = useRef(p);
  cb.current = p;
  const pz = usePanZoom(ref, home, {
    minScale: 0.6, maxScale: 6, padding: 0.05,
    onLimit: (dir, at) => {
      if (dir === "out") return cb.current.onLimitOut();
      if (at.x >= bb[0] && at.x <= bb[2] && at.y >= bb[1] && at.y <= bb[3]) cb.current.onOpenBuilding();
    },
  });
  const { view, px: lw } = pz;
  useEffect(() => { p.controls({ zoomBy: pz.zoomBy, home: () => pz.setHome(home, true, 0.05) }); }, [p.controls, pz.zoomBy, pz.setHome, home]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hot, setHot] = useState(false);

  const place = (e: { clientX: number; clientY: number }) => {
    const w = pz.toWorld(e.clientX, e.clientY);
    p.onPlacePin({ floorId: null, x: null, y: null, elementId: null, anchor: { view: "site", x: Math.round(w.x), y: Math.round(w.y) } }, { x: e.clientX, y: e.clientY });
  };
  const handlers = useHoldToPin(pz.handlers, place);
  const sitePins = p.pins.filter((x) => x.anchor?.view === "site" || x.anchor?.view === "point");
  const inside = p.pins.filter((x) => x.status !== "done" && x.anchor?.view !== "site" && x.anchor?.view !== "point").length;
  const draft = p.draft?.anchor?.view === "site" ? p.draft.anchor : null;
  const fs = 13 * lw;
  const lotW = (lot[2] - lot[0]) / 304.8, lotD = (lot[3] - lot[1]) / 304.8; // feet
  const name = p.jobName.toUpperCase();
  const tagW = name.length * 8.4 * lw + 120 * lw;
  const tagY = site.front === "bottom" ? bb[1] - 26 * lw : bb[3] + 26 * lw;

  return (
    <svg ref={ref} className={`w-full h-full block touch-none select-none ${p.pinMode ? "cursor-crosshair" : pz.dragging ? "cursor-grabbing" : ""}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} {...handlers}
      onClick={(e) => { if (p.pinMode) place(e); }} role="application" aria-label="The whole site">
      <PlanDefs />
      <defs>
        <pattern id="grass" width={1400} height={1400} patternUnits="userSpaceOnUse">
          <rect width={1400} height={1400} fill="#20271d" />
          <circle cx={200} cy={300} r={40} fill="#28321f" /><circle cx={900} cy={150} r={30} fill="#2b3522" /><circle cx={600} cy={800} r={50} fill="#252e1e" />
          <circle cx={1200} cy={1000} r={35} fill="#2b3522" /><circle cx={300} cy={1150} r={28} fill="#28321f" />
        </pattern>
        <pattern id="neighbour" width={2000} height={2000} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={2000} height={2000} fill="#191b18" /><path d="M0 0V2000" stroke="#1f221e" strokeWidth={500} />
        </pattern>
        <filter id="site-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={300} /></filter>
      </defs>
      {/* neighbours, street, then the lot */}
      <rect x={lot[0] - 60000} y={lot[1] - 60000} width={lot[2] - lot[0] + 120000} height={lot[3] - lot[1] + 120000} fill="url(#neighbour)" />
      <rect x={street[0]} y={street[1]} width={street[2] - street[0]} height={street[3] - street[1]} fill="#2a2b2e" />
      <path d={`M${street[0]} ${(street[1] + street[3]) / 2}H${street[2]}`} stroke="#f3c530" strokeOpacity={0.7} strokeWidth={120} strokeDasharray="3000 2500" />
      <rect x={street[0]} y={site.front === "bottom" ? street[1] - 1500 : street[3]} width={street[2] - street[0]} height={1500} fill="#57554f" />
      <rect x={lot[0]} y={lot[1]} width={lot[2] - lot[0]} height={lot[3] - lot[1]} fill="url(#grass)" />
      {site.drive && <path d={pathD(site.drive)} fill="url(#mat-concrete)" />}
      {site.path && <path d={pathD(site.path)} fill="url(#mat-tile)" opacity={0.85} />}

      {/* lot line, staked at the corners */}
      <rect x={lot[0]} y={lot[1]} width={lot[2] - lot[0]} height={lot[3] - lot[1]} fill="none" stroke="#f0ece3" strokeOpacity={0.55} strokeWidth={1.5 * lw} strokeDasharray={`${12 * lw} ${6 * lw}`} pointerEvents="none" />
      {[[lot[0], lot[1]], [lot[2], lot[1]], [lot[2], lot[3]], [lot[0], lot[3]]].map(([x, y], i) => <rect key={i} x={x - 5 * lw} y={y - 5 * lw} width={10 * lw} height={10 * lw} fill="#ff6a1f" stroke="#1c0c03" strokeWidth={lw} pointerEvents="none" />)}
      <text x={lot[0] + 10 * lw} y={lot[1] + 18 * lw} fontSize={fs * 0.8} fontFamily="var(--font-mono)" fill="#8a857a" pointerEvents="none">LOT, ESTIMATED · {lotW.toFixed(0)} × {lotD.toFixed(0)} FT · STREET SIDE {site.front === "bottom" ? "↓" : "↑"}</text>

      {/* the building: ground floor in its materials, with a shadow; click or zoom in to go inside */}
      <g transform="translate(400 600)" opacity={0.7} filter="url(#site-soft)" pointerEvents="none">
        {plan.floors.flatMap((f) => f.footprint).map((r, i) => <path key={i} d={pathD(r)} fill="#000" />)}
      </g>
      <g className="cursor-pointer" onClick={(e) => { if (p.pinMode) return; e.stopPropagation(); p.onOpenBuilding(); }} onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}>
        {/* upper floors that overhang the ground floor show as a roof outline */}
        {plan.floors.filter((f) => f.id !== ground.id).flatMap((f) => f.footprint).map((r, i) => <path key={`u${i}`} d={pathD(r)} fill="#3a3a3c" stroke="#e9e1d1" strokeWidth={60} />)}
        {ground.rooms.map((r) => {
          const st = p.states.get(r.id);
          return (
            <g key={r.id}>
              <path d={pathD(r.polygon)} fill={`url(#mat-${ROOM_MATERIAL[r.type] ?? "concrete"})`} />
              {p.colorMode === "progress" && <path d={pathD(r.polygon)} fill={st ? STATUS_COLOR[st] : "#1d1f1b"} fillOpacity={st ? 0.55 : 0.6} />}
            </g>
          );
        })}
        {ground.walls.map((w) => <path key={`s${w.id}`} d={pathD(w.polygon)} fill={WALL_SIDE} opacity={0.7} transform="translate(75 150)" />)}
        {ground.walls.map((w) => <path key={w.id} d={pathD(w.polygon)} fill={w.exterior ? WALL_EXT_TOP : WALL_TOP} />)}
        {hot && !p.pinMode && plan.floors.flatMap((f) => f.footprint).map((r, i) => <path key={`h${i}`} d={pathD(r)} fill={CHALK} fillOpacity={0.12} stroke={CHALK} strokeWidth={2.5 * lw} strokeDasharray={`${10 * lw} ${5 * lw}`} />)}
        {/* name board with the open pin count */}
        <g transform={`translate(${(bb[0] + bb[2]) / 2} ${tagY})`}>
          <rect x={-tagW / 2} y={-15 * lw} width={tagW} height={30 * lw} rx={2 * lw} fill="#17181b" stroke={hot ? CHALK : "#ff6a1f"} strokeWidth={1.5 * lw} />
          <text x={-tagW / 2 + 12 * lw} y={6 * lw} fontSize={16 * lw} fontFamily="var(--font-stencil)" fontWeight={800} letterSpacing={1.2 * lw} fill="#f0ece3">{name}</text>
          <rect x={tagW / 2 - 92 * lw} y={-10 * lw} width={84 * lw} height={20 * lw} rx={1.5 * lw} fill="#ff6a1f" />
          <text x={tagW / 2 - 50 * lw} y={4.5 * lw} textAnchor="middle" fontSize={11.5 * lw} fontFamily="var(--font-mono)" fontWeight={600} fill="#1c0c03">{inside} OPEN</text>
        </g>
      </g>

      {/* where the pins inside the building are, as faint dots, so the whole job reads at a glance */}
      <g pointerEvents="none">
        {p.pins.filter((x) => x.status !== "done" && x.anchor?.view !== "site" && x.anchor?.view !== "point").map((pin) => {
          const e = pin.element_id ? findElement(plan, pin.element_id) : null;
          const pt = pin.x != null && pin.y != null ? [pin.x, pin.y] : e ? (e.kind === "fixture" ? e.el.center : (() => { const b = bboxOf(e.el.polygon); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; })()) : null;
          if (!pt) return null;
          return <circle key={pin.id} cx={pt[0]} cy={pt[1]} r={4.5 * lw} fill="#ff6a1f" stroke="#1c0c03" strokeWidth={lw} opacity={0.9} />;
        })}
      </g>

      {sitePins.map((pin) => <PinFlag key={pin.id} pin={pin} x={pin.anchor!.x} y={pin.anchor!.y} px={lw} selected={p.selectedPin === pin.id} onClick={(e) => { e.stopPropagation(); p.onSelectPin(pin.id); }} />)}
      {draft && <DraftFlag x={draft.x} y={draft.y} px={lw} />}
    </svg>
  );
}
