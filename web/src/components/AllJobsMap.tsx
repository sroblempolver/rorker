"use client";
// Every job as a building on one map, like a small city. Zoom with the wheel or a pinch, drag to pan,
// click a building to go inside it.
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { JobSummary } from "@/lib/data/types";
import { usePanZoom } from "./plan/usePanZoom";

const LOT = 26000; // mm per lot on the map
const STATUS: Record<string, string> = { active: "#ff6a1f", lead: "#55b2ff", on_hold: "#9c978d", done: "#3fb46a" };

export function AllJobsMap({ jobs }: { jobs: JobSummary[] }) {
  const router = useRouter();
  const ref = useRef<SVGSVGElement>(null);
  const cols = Math.max(1, Math.min(4, jobs.length, Math.ceil(Math.sqrt(jobs.length * 1.6))));
  const rows = Math.ceil(jobs.length / cols);
  const world = useMemo(() => ({ x: -4000, y: -4000, w: cols * LOT + 8000, h: rows * LOT + 8000 }), [cols, rows]);
  const { view, handlers, dragging } = usePanZoom(ref, world, { minScale: 0.6, maxScale: 6 });
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="relative card !rounded-[4px] overflow-hidden" style={{ height: "min(56vh, 520px)" }}>
      <svg ref={ref} className={`w-full h-full block touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} {...handlers} role="img" aria-label="Map of all jobs">
        <defs>
          <pattern id="lots" width={LOT} height={LOT} patternUnits="userSpaceOnUse">
            <rect width={LOT} height={LOT} fill="#2a2b2e" />
            <rect x={1800} y={1800} width={LOT - 3600} height={LOT - 3600} fill="#20271d" />
            <path d={`M0 ${LOT / 2}H${LOT}M${LOT / 2} 0V${LOT}`} stroke="#f3c530" strokeOpacity={0.35} strokeWidth={90} strokeDasharray="900 700" transform={`translate(${-LOT / 2} ${-LOT / 2})`} />
          </pattern>
          <filter id="bshadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="500" dy="700" stdDeviation="500" floodColor="#000" floodOpacity="0.5" /></filter>
        </defs>
        <rect x={world.x - 40000} y={world.y - 40000} width={world.w + 80000} height={world.h + 80000} fill="#191b18" />
        <rect x={0} y={0} width={cols * LOT} height={rows * LOT} fill="url(#lots)" />
        {jobs.map((j, i) => {
          const cx = (i % cols) * LOT + LOT / 2, cy = Math.floor(i / cols) * LOT + LOT / 2;
          const fp = j.footprint?.filter((r) => r.length > 2) ?? [];
          let content: React.ReactNode;
          if (fp.length) {
            const pts = fp.flat();
            const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
            const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
            // the building fits the lot above the name and progress bar, so nothing it draws crosses the label
            const top = cy - LOT / 2 + 2800, bottom = cy + LOT / 2 - 6600;
            const s = Math.min(1, (LOT - 7000) / Math.max(1, x1 - x0), (bottom - top) / Math.max(1, y1 - y0));
            const tx = cx - ((x0 + x1) / 2) * s, ty = (top + bottom) / 2 - ((y0 + y1) / 2) * s;
            content = (
              <g transform={`translate(${tx} ${ty}) scale(${s})`} filter="url(#bshadow)">
                {fp.map((r, k) => <path key={k} d={"M" + r.map((p) => p.join(" ")).join("L") + "Z"} fill="#3a3a3c" stroke="#e9e1d1" strokeWidth={80 / s} />)}
                {/* slate roof courses */}
                {fp.map((r, k) => <path key={`h${k}`} d={"M" + r.map((p) => p.join(" ")).join("L") + "Z"} fill="none" stroke="#29292b" strokeWidth={30 / s} transform={`translate(${-250 / s} ${-380 / s})`} opacity={0.8} />)}
              </g>
            );
          } else {
            content = (
              <g transform={`translate(${cx} ${cy - 1800})`}>
                <path d="M-6000 2500 V-2000 L0 -6500 L6000 -2000 V2500 Z" fill="none" stroke="#f0ece3" strokeOpacity={0.5} strokeWidth={120} strokeDasharray="500 400" />
                <text y={5600} textAnchor="middle" fill="var(--muted)" fontSize={1300} fontFamily="var(--font-mono)">{j.run_status === "running" || j.run_status === "queued" ? "Reading plan…" : "No plan yet"}</text>
              </g>
            );
          }
          const pct = j.stages_total ? j.stages_done / j.stages_total : 0;
          const hot = hover === j.id;
          return (
            <g key={j.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${j.id}`)} onPointerEnter={() => setHover(j.id)} onPointerLeave={() => setHover(null)}>
              <rect x={cx - LOT / 2 + 1800} y={cy - LOT / 2 + 1800} width={LOT - 3600} height={LOT - 3600} fill={hot ? "#55b2ff" : "transparent"} fillOpacity={0.08} stroke={hot ? "#55b2ff" : "#f0ece3"} strokeOpacity={hot ? 1 : 0.35} strokeWidth={hot ? 160 : 80} strokeDasharray="700 350" />
              {content}
              <g transform={`translate(${cx - LOT / 2 + 3000} ${cy + LOT / 2 - 4300})`}>
                <rect x={0} y={-1000} width={1000} height={1000} fill={STATUS[j.status]} />
                <text x={1500} y={0} fill="var(--text)" fontSize={1600} fontFamily="var(--font-stencil)" fontWeight={800} letterSpacing={60}>{(j.name.length > 24 ? j.name.slice(0, 23) + "…" : j.name).toUpperCase()}</text>
                <rect x={0} y={800} width={LOT - 6000} height={420} fill="#34353b" />
                <rect x={0} y={800} width={(LOT - 6000) * pct} height={420} fill="var(--accent)" />
              </g>
              {j.open_pins > 0 && (
                <g transform={`translate(${cx + LOT / 2 - 3600} ${cy - LOT / 2 + 3600})`}>
                  <line x1={-1100} y1={1400} x2={-1100} y2={-1400} stroke="#f0ece3" strokeWidth={200} />
                  <path d="M-1000 -1400H1500L1000 -600L1500 200H-1000Z" fill="#ff6a1f" stroke="#1c0c03" strokeWidth={80} />
                  <text x={150} y={-150} textAnchor="middle" fontSize={1300} fontFamily="var(--font-mono)" fontWeight={700} fill="#1c0c03">{j.open_pins}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute left-3 bottom-3 chip !rounded-[3px] bg-[#17181b]/90">Scroll to zoom · drag to move · click a building to open it</div>
    </div>
  );
}
