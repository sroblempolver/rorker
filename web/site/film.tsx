// A 1-minute vertical film (9:16) on one feature: drop in the drawing, and Rorker builds the house stage by
// stage. Drawn in code on the app's real 3D house, like the voice reel (reel.tsx): everything on screen is
// worked out from the time since the start, so site/reel-render.mjs records the same film every time.
// The voiceover, music and sound effects are mixed in afterwards by site/film-mix.mjs, on the same clock (CUES).
import { StrictMode, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { hatColor, initials } from "@/components/team/Avatar";
import type { BuildLook } from "@/lib/plan/build";
import { labelPoint } from "@/lib/plan/geometry";
import type { ElementStatus, Pt } from "@/lib/plan/types";
import symbolSvg from "../public/brand/symbol-orange.svg";
import logoSvg from "../public/brand/rorker-horizontal-orange.svg";
import { BASE_SCENE, GROUND, House, director, feetInches, plan, roomByType, roomPoint, type Pose, type Scene } from "./stage";

export const LENGTH = 60000;
(window as unknown as { REEL_LENGTH: number }).REEL_LENGTH = LENGTH;

// ------------------------------------------------------------------------------------------ the beats (ms)

const B = {
  draw: 300, drop: 7000, hit: 7600, scan: 7800, measure: 9300, lift: 13400, slab: 18000,
  framing: 22000, nail: 23000, drywall: 28400, rock: 29500, finished: 33400, fin: 34000,
  inside: 38400, green: 43300, all: 47400, crew: 48500, end: 53600, endHit: 54500,
};
const STAGES: { look: BuildLook; word: string; at: number; from: number; to: number }[] = [
  { look: "slab", word: "Slab", at: B.slab, from: B.lift, to: B.framing },
  { look: "framing", word: "Framing", at: B.nail, from: B.framing, to: B.drywall },
  { look: "drywall", word: "Sheetrock", at: B.rock, from: B.drywall, to: B.finished },
  { look: "finished", word: "Finished", at: B.fin, from: B.finished, to: B.inside },
];

// ------------------------------------------------------------------------------------------ the drawing

const [bx0, by0, bx1, by1] = GROUND.bounds;
const PAD = 900;
const VIEW = `${bx0 - PAD} ${by0 - PAD} ${bx1 - bx0 + PAD * 2} ${by1 - by0 + PAD * 2}`;
const pathOf = (poly: Pt[]) => `M${poly.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
const sizeOf = (poly: Pt[]) => {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return `${feetInches(Math.max(...xs) - Math.min(...xs))} × ${feetInches(Math.max(...ys) - Math.min(...ys))}`;
};
const WALLS = GROUND.walls.map((w) => pathOf(w.polygon));
const OPENINGS = GROUND.openings;
// measured one by one, from the front door in
const ROOMS = GROUND.rooms.filter((r) => !r.outdoor).map((r) => ({ id: r.id, name: r.name, big: r.area_m2 >= 7, d: pathOf(r.polygon), at: labelPoint(r.polygon), size: sizeOf(r.polygon) }));
const COUNTS = {
  rooms: plan.floors.reduce((n, f) => n + f.rooms.length, 0),
  walls: plan.floors.reduce((n, f) => n + f.walls.length, 0),
  doors: plan.floors.reduce((n, f) => n + f.openings.filter((o) => /door/.test(o.kind)).length, 0),
  windows: plan.floors.reduce((n, f) => n + f.openings.filter((o) => o.kind === "window").length, 0),
};

// ------------------------------------------------------------------------------------------ progress inside

const KITCHEN = roomByType(GROUND, "kitchen");
// the order rooms turn green; the kitchen is late and stays red
const GREEN_ORDER = GROUND.rooms.filter((r) => r.id !== KITCHEN.id && r.type !== "garage").map((r) => r.id);
const GREEN_STEP = 380;
function statesAt(n: number): Record<string, ElementStatus> {
  const out: Record<string, ElementStatus> = {};
  for (const r of GROUND.rooms) out[r.id] = "in_progress";
  out[KITCHEN.id] = "not_built";
  GREEN_ORDER.slice(0, n).forEach((id) => { out[id] = "done"; });
  return out;
}

// ------------------------------------------------------------------------------------------ timing helpers

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
const inOut = (t: number, a: number, b = Infinity, ms = 300) => Math.min(ease((t - a) / ms), 1 - ease((t - b) / ms));
const slide = (k: number, px = 24): CSSProperties => ({ opacity: k, transform: `translateY(${(1 - k) * px}px)` });
/** a stamp: lands big and settles, with a little kick */
const stamp = (t: number, at: number) => {
  const k = clamp01((t - at) / 260);
  return { opacity: k, transform: `scale(${1 + (1 - ease(k)) * 0.45}) translateY(${Math.sin(clamp01((t - at) / 500) * Math.PI) * 4}px)` };
};
const count = (t: number, a: number, ms: number, to: number) => Math.round(ease((t - a) / ms) * to);

// ------------------------------------------------------------------------------------------ the film

function Film() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = () => { setT(Math.min(LENGTH, performance.now() - t0)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // which part of the film the house is in
  const stage = STAGES.findIndex((s) => t >= s.from && t < s.to);
  const part = t < B.lift ? "paper" : stage >= 0 ? `stage${stage}` : t < B.all ? "inside" : "house";
  const greens = t < B.green ? 0 : Math.min(GREEN_ORDER.length, Math.floor((t - B.green) / GREEN_STEP) + 1);
  const scene = useMemo<Scene>(() => {
    if (part === "paper") return { ...BASE_SCENE, look: "slab" };
    if (part.startsWith("stage")) return { ...BASE_SCENE, look: STAGES[Number(part.slice(5))].look };
    if (part === "inside") return { ...BASE_SCENE, mode: "floor", floorId: GROUND.id, colorMode: "progress", states: statesAt(greens) };
    return { ...BASE_SCENE };
  }, [part, greens]);

  // the camera
  const shot = t < B.lift ? 0 : t < B.lift + 2600 ? 1 : t < B.framing ? 2 : t < B.drywall ? 3 : t < B.finished ? 4 : t < B.inside ? 5 : t < B.all ? 6 : 7;
  useEffect(() => {
    const poses: Pose[] = [
      { az: 0, pol: 0.1, dist: 2.2 },
      { az: 0, pol: 0.1, dist: 2.2 },
      { az: 0.55, pol: 0.9, dist: 2.3, spin: 0.09 },
      { az: 1.5, pol: 0.92, dist: 2.25, spin: 0.11 },
      { az: 2.5, pol: 1.2, dist: 2.1, spin: 0.1 },
      { az: 3.5, pol: 1.08, dist: 2.9, spin: 0.14 },
      { az: 3.9, pol: 0.42, dist: 2.45, spin: 0.05 },
      { az: 4.4, pol: 0.98, dist: 3.4, spin: 0.2 },
    ];
    director.pose(poses[shot]);
    if (shot <= 1) director.snap();
  }, [shot]);

  // ----- the drawing
  const paper = 1 - ease((t - B.lift) / 900);
  const tilt = ease((t - B.lift) / 1100);
  const drawK = (i: number, n: number) => ease((t - B.draw - (i / n) * 3600) / 800);
  const scanK = clamp01((t - B.scan) / 1400);
  const fileK = t < B.drop ? 0 : t < B.hit ? ease((t - B.drop) / 600) : 1;
  const fileGone = ease((t - B.hit - 250) / 400);
  const roomK = (i: number) => ease((t - B.measure - i * 320) / 280);
  const push = 1 + 0.06 * ease(t / 7000);

  // ----- the house
  const world = ease((t - B.lift - 300) / 1000);
  const late = director.toScreen(roomPoint(KITCHEN.id, 0.6));
  const doneRooms = greens;
  const crew = [
    { name: "Marco Diaz", who: "Crew", x: 70, y: 300 },
    { name: "Laura Hadley", who: "Client", x: 330, y: 380 },
    { name: "You", who: "You", x: 120, y: 600 },
  ];
  const end = ease((t - B.end) / 700);
  const flash = Math.max(0, 1 - Math.abs(t - B.hit) / 140) * 0.12 + Math.max(0, 1 - Math.abs(t - B.endHit) / 220) * 0.18;

  return (
    <div className="film">
      <div className="world" style={{ opacity: world }}><House scene={scene} /></div>
      <div className="vignette" />

      {/* the drawing: drawn line by line, read by Rorker, then laid down as the slab */}
      {paper > 0 && (
        <div className="paper" style={{ opacity: paper }}>
          <div className="grid" />
          <svg viewBox={VIEW} className="plan" style={{ transform: `perspective(900px) rotateX(${tilt * 58}deg) scale(${push * (1 - tilt * 0.12)})` }}>
            <defs>
              <clipPath id="read"><rect x={bx0 - PAD} y={by0 - PAD} width={bx1 - bx0 + PAD * 2} height={(by1 - by0 + PAD * 2) * scanK} /></clipPath>
              <filter id="glow"><feGaussianBlur stdDeviation="60" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {/* paper lines */}
            <g className="ink">
              {WALLS.map((d, i) => <path key={i} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawK(i, WALLS.length)} />)}
              {OPENINGS.map((o, i) => <line key={o.id} x1={o.a[0]} y1={o.a[1]} x2={o.b[0]} y2={o.b[1]} style={{ opacity: drawK(i, OPENINGS.length) }} />)}
            </g>
            {/* what Rorker reads off it */}
            <g clipPath="url(#read)" filter="url(#glow)">
              <g className="read">
                {WALLS.map((d, i) => <path key={i} d={d} />)}
                {OPENINGS.map((o) => <line key={o.id} className={/door/.test(o.kind) ? "door" : "win"} x1={o.a[0]} y1={o.a[1]} x2={o.b[0]} y2={o.b[1]} />)}
              </g>
            </g>
            <g className="rooms">
              {ROOMS.map((r, i) => (
                <g key={r.id} style={{ opacity: roomK(i) }}>
                  <path d={r.d} style={{ fillOpacity: 0.16 * roomK(i) * (1 - clamp01((t - B.measure - i * 320 - 400) / 900)) + 0.05 }} />
                  {r.big && <text x={r.at[0]} y={r.at[1] - 120} className="nm">{r.name}</text>}
                  {r.big && <text x={r.at[0]} y={r.at[1] + 330} className="sz">{r.size}</text>}
                </g>
              ))}
            </g>
            {scanK > 0 && scanK < 1 && <rect className="scanline" x={bx0 - PAD} y={by0 - PAD + (by1 - by0 + PAD * 2) * scanK - 40} width={bx1 - bx0 + PAD * 2} height={80} />}
          </svg>
          {/* the file dropping in */}
          {fileK > 0 && fileGone < 1 && (
            <div className="file" style={{ transform: `translate(-50%, ${-520 + fileK * 520}px) rotate(${(1 - fileK) * -8}deg) scale(${1 - fileGone * 0.6})`, opacity: 1 - fileGone }}>
              <span className="pdf">PDF</span>
              <span className="fname">hadley-plan.pdf</span>
            </div>
          )}
          <div className="counts" style={slide(inOut(t, B.measure, B.lift - 300, 400), 20)}>
            <Count n={count(t, B.measure, 3600, COUNTS.rooms)} label="Rooms" />
            <Count n={count(t, B.measure + 200, 3600, COUNTS.walls)} label="Walls" />
            <Count n={count(t, B.measure + 400, 3600, COUNTS.doors)} label="Doors" />
            <Count n={count(t, B.measure + 600, 3600, COUNTS.windows)} label="Windows" />
          </div>
        </div>
      )}

      {/* the stage stamps */}
      {STAGES.map((s, i) => t >= s.at - 50 && t < s.to && (
        <div key={s.look} className="stage">
          <div className="rail">{STAGES.map((_, j) => <i key={j} className={j < i ? "on" : j === i ? "now" : ""} style={j === i ? { transform: `scaleX(${clamp01((t - s.at) / 500)})` } : undefined} />)}</div>
          <div className="word" style={stamp(t, s.at)}><span className="no">0{i + 1}</span>{s.word}</div>
        </div>
      ))}

      {/* inside: the rooms going green, the late one called out */}
      {t >= B.green - 700 && t < B.all + 400 && (
        <>
          <div className="meter" style={slide(inOut(t, B.green - 700, B.all, 400), -16)}>
            <b>{doneRooms + 0}</b><span>/ {GREEN_ORDER.length + 1}<br />rooms done</span>
          </div>
          {late.on && t >= B.green + 1200 && (
            <div className="late" style={{ transform: `translate(${Math.max(16, Math.min(540 - 150, late.x - 60))}px, ${late.y - 64}px)`, opacity: ease((t - B.green - 1200) / 300) }}>
              <i style={{ opacity: 0.5 + 0.5 * Math.abs(Math.sin(t / 260)) }} />Kitchen · late
            </div>
          )}
        </>
      )}

      {/* the same house for everyone */}
      {t >= B.crew && t < B.end + 400 && crew.map((c, i) => {
        const k = inOut(t, B.crew + i * 900, B.end - 200, 400);
        return (
          <div key={c.who} className="chip" style={{ left: c.x, top: c.y + Math.sin(t / 700 + i) * 6, ...slide(k, 18) }}>
            {c.who === "You" ? <span className="face you">You</span> : <span className="face" style={{ background: hatColor(c.name) }}>{initials(c.name)}</span>}
            <span>{c.who}</span>
          </div>
        );
      })}

      <div className="top" style={{ opacity: (1 - end) * ease((t - 200) / 600) }}>
        <span className="brand" dangerouslySetInnerHTML={{ __html: logoSvg }} />
      </div>

      <div className="end" style={{ opacity: end }}>
        <span className="mark" dangerouslySetInnerHTML={{ __html: symbolSvg }} style={{ transform: `scale(${0.7 + 0.3 * ease((t - B.endHit + 300) / 500)})` }} />
        <h2 style={stamp(t, B.endHit + 900)}>See the job<br />before it&apos;s built.</h2>
        <div className="url" style={slide(ease((t - B.endHit - 1500) / 500), 14)}>rorker.com</div>
      </div>

      <div className="flash" style={{ opacity: flash }} />
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return <div className="count"><b>{String(n).padStart(2, "0")}</b><span>{label}</span></div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Film /></StrictMode>);
