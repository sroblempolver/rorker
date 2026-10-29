"use client";
// Every job as a building on one map, like a small city. Zoom with the wheel or a pinch, drag to pan,
// click a building to go inside it. With `live`, the city is alive like a sim game: crews stand on the
// jobs they're working, work going on now pulses, deliveries roll up the road, and a log at the top
// says what's happening across the business.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JobSummary } from "@/lib/data/types";
import { usePanZoom } from "./plan/usePanZoom";
import { hatColor, initials } from "./team/Avatar";

/** What's going on at a job right now. */
export interface JobLive {
  /** people with work there today or under way; `working` when something of theirs is in progress */
  crew: { id: string; name: string; working?: boolean }[];
  /** things in progress */
  now: number;
  late: number;
  /** materials ordered and on the way */
  enRoute: number;
}
/** One line in the map's log: "Marco · Remove old base cabinets". */
export interface MapEvent { jobId: string; jobName: string; who?: string; text: string; tone: "now" | "late" | "today" }

const LOT = 26000; // mm per lot on the map
const STATUS: Record<string, string> = { active: "#ff6a1f", lead: "#55b2ff", on_hold: "#9c978d", done: "#3fb46a" };

export function AllJobsMap({ jobs, live, events }: { jobs: JobSummary[]; live?: Record<string, JobLive>; events?: MapEvent[] }) {
  const router = useRouter();
  const ref = useRef<SVGSVGElement>(null);
  const cols = Math.max(1, Math.min(4, jobs.length, Math.ceil(Math.sqrt(jobs.length * 1.6))));
  const rows = Math.ceil(jobs.length / cols);
  const world = useMemo(() => ({ x: -2500, y: -2500, w: cols * LOT + 5000, h: rows * LOT + 5000 }), [cols, rows]);
  const { view, handlers, dragging } = usePanZoom(ref, world, { minScale: 0.6, maxScale: 6 });
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="relative card !rounded-[4px] overflow-hidden" style={{ height: rows > 1 ? "min(60vh, 560px)" : "min(52vh, 460px)" }}>
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
          let bcy = cy - 1800;
          if (fp.length) {
            const pts = fp.flat();
            const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
            const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
            // the building fits the lot above the name and progress bar, so nothing it draws crosses the label
            const top = cy - LOT / 2 + 2800, bottom = cy + LOT / 2 - 6600;
            // leave the left edge of the lot for the crew standing on site
            const s = Math.min(1, (LOT - 9600) / Math.max(1, x1 - x0), (bottom - top) / Math.max(1, y1 - y0));
            const tx = cx + 1300 - ((x0 + x1) / 2) * s, ty = (top + bottom) / 2 - ((y0 + y1) / 2) * s;
            bcy = (top + bottom) / 2;
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
          const L = live?.[j.id];
          const hot = hover === j.id;
          return (
            <g key={j.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${j.id}`)} onPointerEnter={() => setHover(j.id)} onPointerLeave={() => setHover(null)}>
              <rect x={cx - LOT / 2 + 1800} y={cy - LOT / 2 + 1800} width={LOT - 3600} height={LOT - 3600} fill={hot ? "#55b2ff" : "transparent"} fillOpacity={0.08} stroke={hot ? "#55b2ff" : "#f0ece3"} strokeOpacity={hot ? 1 : 0.35} strokeWidth={hot ? 160 : 80} strokeDasharray="700 350" />
              {L && (L.now > 0 || L.late > 0) && [0, 1.1].map((d) => (
                <circle key={d} className="beacon" cx={cx} cy={bcy} r={8200} fill="none" stroke={L.now ? "#f3c530" : "#e8432e"} strokeWidth={240} style={{ animationDelay: `${d + i * 0.3}s` }} pointerEvents="none" />
              ))}
              {content}
              {L && L.enRoute > 0 && (
                // a delivery rolling up the road to the lot
                <g transform={`translate(${cx - LOT / 2 - 3000} ${cy - LOT / 2}) scale(1.5)`} pointerEvents="none">
                  <g className="drive" style={{ ["--to" as string]: `${(LOT / 2 + 1200) / 1.5}px`, animationDelay: `${i * 1.7}s` }}>
                    <title>{L.enRoute} deliver{L.enRoute === 1 ? "y" : "ies"} on the way</title>
                    <rect x={-1500} y={-700} width={2300} height={1400} fill="#f0ece3" stroke="#141310" strokeWidth={90} />
                    <rect x={800} y={-700} width={1000} height={1400} fill="#ff6a1f" stroke="#141310" strokeWidth={90} />
                    <rect x={1250} y={-450} width={400} height={900} fill="#141310" opacity={0.55} />
                  </g>
                </g>
              )}
              {L && L.crew.slice(0, 3).map((m, k) => (
                <g key={m.id} transform={`translate(${cx - LOT / 2 + 3600} ${cy - LOT / 2 + 4200 + k * 3300}) scale(1.4)`}>
                  <g className="bob" style={{ animationDelay: `${(k * 0.45 + i * 0.2).toFixed(2)}s` }}>
                    <title>{m.name}{m.working ? " · working now" : " · on today"}</title>
                    <rect x={-950} y={-950} width={1900} height={1900} rx={220} fill={hatColor(m.name)} stroke="#141310" strokeWidth={130} />
                    <text y={330} textAnchor="middle" fontSize={900} fontFamily="var(--font-mono)" fontWeight={700} fill="#141310">{initials(m.name)}</text>
                    {m.working && <circle cx={950} cy={-950} r={420} fill="#f3c530" stroke="#141310" strokeWidth={110} />}
                  </g>
                </g>
              ))}
              {L && L.crew.length > 3 && (
                <text x={cx - LOT / 2 + 3600} y={cy - LOT / 2 + 4200 + 3 * 3300 + 300} textAnchor="middle" fontSize={1000} fontFamily="var(--font-mono)" fill="var(--muted)">+{L.crew.length - 3}</text>
              )}
              <g transform={`translate(${cx - LOT / 2 + 3000} ${cy + LOT / 2 - 4300})`}>
                <rect x={0} y={-1000} width={1000} height={1000} fill={STATUS[j.status]} />
                <text x={1500} y={0} fill="var(--text)" fontSize={1600} fontFamily="var(--font-stencil)" fontWeight={800} letterSpacing={60}>{(j.name.length > 24 ? j.name.slice(0, 23) + "…" : j.name).toUpperCase()}</text>
                <rect x={0} y={800} width={LOT - 6000} height={420} fill="#34353b" />
                <rect className="grow-x" x={0} y={800} width={Math.max(1, (LOT - 6000) * pct)} height={420} fill="var(--accent)" style={{ animationDelay: `${0.2 + i * 0.15}s` }} />
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
      {live && <LiveHud jobs={jobs} live={live} events={events ?? []} open={(id) => router.push(`/jobs/${id}`)} />}
      <div className="absolute left-3 bottom-3 chip !rounded-[3px] bg-[#17181b]/90">Scroll to zoom · drag to move · click a building to open it</div>
    </div>
  );
}

/** The game HUD over the city: the business at a glance, and a running log of what's happening. */
function LiveHud({ jobs, live, events, open }: { jobs: JobSummary[]; live: Record<string, JobLive>; events: MapEvent[]; open: (jobId: string) => void }) {
  const all = Object.values(live);
  const crew = new Set(all.flatMap((l) => l.crew.map((c) => c.id))).size;
  const now = all.reduce((n, l) => n + l.now, 0), late = all.reduce((n, l) => n + l.late, 0), trucks = all.reduce((n, l) => n + l.enRoute, 0);
  // the log scrolls one line at a time, newest on top, like a strategy game's event feed
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (events.length < 4) return;
    const t = setInterval(() => setAt((a) => (a + 1) % events.length), 3500);
    return () => clearInterval(t);
  }, [events.length]);
  const shown = events.length < 4 ? events : [0, 1, 2].map((k) => events[(at + k) % events.length]);
  const stat = (n: number, label: string, tone = "text-text") => (
    <span className="inline-flex items-baseline gap-1.5"><span className={`font-mono text-[15px] font-semibold ${tone}`}>{n}</span><span className="text-muted text-[12px]">{label}</span></span>
  );
  return (
    <>
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-[4px] bg-[#17181b]/90 backdrop-blur-sm border border-line">
        <span className="inline-flex items-center gap-1.5 font-display font-extrabold tracking-[0.14em] uppercase text-[12.5px] text-accent"><span className="w-2 h-2 rounded-full bg-accent animate-pulse" />Live</span>
        {stat(jobs.length, jobs.length === 1 ? "job" : "jobs")}
        {stat(crew, "crew out")}
        {stat(now, "going on", now ? "text-amber" : "text-text")}
        {late > 0 && stat(late, "late", "text-red")}
        {trucks > 0 && stat(trucks, trucks === 1 ? "delivery coming" : "deliveries coming")}
      </div>
      {shown.length > 0 && (
        <div className="absolute right-3 top-3 hidden md:flex flex-col gap-1 w-[300px]" aria-label="What's happening">
          {shown.map((e, k) => (
            <button key={`${at}-${k}-${e.text}`} onClick={() => open(e.jobId)} style={{ animationDelay: `${k * 60}ms`, borderLeftColor: e.tone === "late" ? "var(--red)" : e.tone === "now" ? "var(--amber)" : "var(--line)" }}
              className="rise-in [animation-fill-mode:backwards] text-left px-3 py-1.5 rounded-[3px] bg-[#17181b]/90 backdrop-blur-sm border border-line hover:border-chalk border-l-[3px]"
              title={`Open ${e.jobName}`}>
              <span className="block text-[13px] truncate">
                <span className={e.tone === "late" ? "text-red" : e.tone === "now" ? "text-amber" : "text-muted"}>{e.tone === "late" ? "Late" : e.tone === "now" ? "Now" : "Today"}</span>
                {e.who ? <span className="text-text"> · {e.who}</span> : null} · {e.text}
              </span>
              <span className="block text-[11.5px] text-muted truncate">{e.jobName}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
