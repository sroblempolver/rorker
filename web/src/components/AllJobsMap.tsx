"use client";
// Every job as a building on one map, like a small city. Zoom with the wheel or a pinch, drag to pan,
// click a building to go inside it.
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { JobSummary } from "@/lib/data/types";
import { usePanZoom } from "./plan/usePanZoom";

const LOT = 26000; // mm per lot on the map
const STATUS: Record<string, string> = { active: "var(--accent)", lead: "var(--glass)", on_hold: "var(--grey)", done: "var(--green)" };

export function AllJobsMap({ jobs }: { jobs: JobSummary[] }) {
  const router = useRouter();
  const ref = useRef<SVGSVGElement>(null);
  const cols = Math.max(1, Math.min(4, jobs.length, Math.ceil(Math.sqrt(jobs.length * 1.6))));
  const rows = Math.ceil(jobs.length / cols);
  const world = useMemo(() => ({ x: -4000, y: -4000, w: cols * LOT + 8000, h: rows * LOT + 8000 }), [cols, rows]);
  const { view, handlers, dragging } = usePanZoom(ref, world, { minScale: 0.6, maxScale: 6 });
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="relative card overflow-hidden" style={{ height: "min(56vh, 520px)" }}>
      <svg ref={ref} className={`w-full h-full block touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} {...handlers} role="img" aria-label="Map of all jobs">
        <defs>
          <pattern id="lots" width={LOT} height={LOT} patternUnits="userSpaceOnUse">
            <rect width={LOT} height={LOT} fill="#121821" />
            <rect x={1800} y={1800} width={LOT - 3600} height={LOT - 3600} rx={900} fill="#17202a" />
          </pattern>
          <filter id="bshadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="500" dy="700" stdDeviation="500" floodColor="#000" floodOpacity="0.5" /></filter>
        </defs>
        <rect x={world.x - 40000} y={world.y - 40000} width={world.w + 80000} height={world.h + 80000} fill="#0d1319" />
        <rect x={0} y={0} width={cols * LOT} height={rows * LOT} fill="url(#lots)" />
        {jobs.map((j, i) => {
          const cx = (i % cols) * LOT + LOT / 2, cy = Math.floor(i / cols) * LOT + LOT / 2;
          const fp = j.footprint?.filter((r) => r.length > 2) ?? [];
          let content: React.ReactNode;
          if (fp.length) {
            const pts = fp.flat();
            const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
            const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
            const s = Math.min(1, (LOT * 0.62) / Math.max(x1 - x0, y1 - y0));
            const tx = cx - ((x0 + x1) / 2) * s, ty = cy - ((y0 + y1) / 2) * s;
            content = (
              <g transform={`translate(${tx} ${ty}) scale(${s})`} filter="url(#bshadow)">
                {fp.map((r, k) => <path key={k} d={"M" + r.map((p) => p.join(" ")).join("L") + "Z"} fill="#2c3644" stroke="#3d4a5a" strokeWidth={60 / s} />)}
                {/* roof ridge hint, scaled lines give a sense of height */}
                {fp.map((r, k) => <path key={`h${k}`} d={"M" + r.map((p) => p.join(" ")).join("L") + "Z"} fill="none" stroke="#475668" strokeWidth={20 / s} transform={`translate(${-300 / s} ${-450 / s})`} opacity={0.5} />)}
              </g>
            );
          } else {
            content = (
              <g transform={`translate(${cx} ${cy})`}>
                <path d="M-6000 2500 V-2000 L0 -6500 L6000 -2000 V2500 Z" fill="#232c37" stroke="#3a4655" strokeWidth={120} strokeDasharray="500 400" />
                <text y={5600} textAnchor="middle" fill="var(--muted)" fontSize={1400}>{j.run_status === "running" || j.run_status === "queued" ? "Reading plan…" : "No plan yet"}</text>
              </g>
            );
          }
          const pct = j.stages_total ? j.stages_done / j.stages_total : 0;
          const hot = hover === j.id;
          return (
            <g key={j.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${j.id}`)} onPointerEnter={() => setHover(j.id)} onPointerLeave={() => setHover(null)}>
              <rect x={cx - LOT / 2 + 1800} y={cy - LOT / 2 + 1800} width={LOT - 3600} height={LOT - 3600} rx={900} fill={hot ? "#1c2733" : "transparent"} stroke={hot ? STATUS[j.status] : "transparent"} strokeWidth={160} />
              {content}
              <g transform={`translate(${cx - LOT / 2 + 3000} ${cy + LOT / 2 - 4300})`}>
                <circle r={500} cx={500} cy={-500} fill={STATUS[j.status]} />
                <text x={1500} y={0} fill="var(--text)" fontSize={1500} fontFamily="var(--font-display)" fontWeight={600}>{j.name.length > 26 ? j.name.slice(0, 25) + "…" : j.name}</text>
                <rect x={0} y={800} width={LOT - 6000} height={420} rx={210} fill="#253040" />
                <rect x={0} y={800} width={(LOT - 6000) * pct} height={420} rx={210} fill="var(--accent)" />
              </g>
              {j.open_pins > 0 && (
                <g transform={`translate(${cx + LOT / 2 - 3600} ${cy - LOT / 2 + 3600})`}>
                  <circle r={1300} fill="var(--red)" />
                  <text y={500} textAnchor="middle" fontSize={1400} fontWeight={700} fill="#fff">{j.open_pins}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute left-3 bottom-3 chip">Scroll to zoom · drag to move · click a building to open it</div>
    </div>
  );
}
