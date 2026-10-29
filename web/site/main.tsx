// rorker.com: the marketing site. One live 3D house sits behind the whole page (the app's own view on
// the sample house). At the top a cursor works it for 30 seconds (explainer.ts); the visitor can take
// the controls at any time. Further down, each section sets what the house shows, and its buttons,
// sliders and cards change the house live. Features come from features.ts.
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Vector3 } from "three";
import { webglAvailable } from "@/components/plan/Plan3D";
import type { PinTarget } from "@/components/plan/target";
import type { Pin, PinKind } from "@/lib/data/types";
import type { ElementStatus } from "@/lib/plan/types";
import { clearMarks, showMarks } from "@/lib/plan/marks";
import { hatColor, initials } from "@/components/team/Avatar";
import { PIN_COLOR, STATUS_COLOR } from "@/components/plan/style";
import logoSvg from "../public/brand/rorker-horizontal-orange.svg";
import symbolSvg from "../public/brand/symbol-orange.svg";
import { BASE_SCENE, GROUND, House, director, feetInches, floorY, makePin, plan, roomByType, roomPlanPoint, squareFeet, type Pose, type Scene } from "./stage";
import { CHAPTERS, CREW, EMPTY_HUD, explainer, type Ctx, type Hud, type Note, type Target } from "./explainer";
import { FEATURES, type Feature, type ScenePreset } from "./features";

const APP = "https://build.rorker.com/";
const S = 0.001;
type V3 = [number, number, number];

// ------------------------------------------------------------------------------------------ small parts

function Face({ name, size = 26 }: { name: string; size?: number }) {
  return <span className="face" style={{ width: size, height: size, fontSize: size * 0.4, background: hatColor(name) }} title={name}>{initials(name)}</span>;
}

function Tag({ children, tone }: { children: ReactNode; tone?: "live" | "new" | "next" | "plain" }) {
  return <span className={`tag tag-${tone ?? "plain"}`}><i />{children}</span>;
}

const KIND_LABEL: Record<PinKind, string> = { task: "Task", issue: "Issue", note: "Note", material: "Material" };

/** Something stuck to a spot in the house: follows it on screen every frame. */
function Anchor({ world, className, children, dx = 0, dy = 0 }: { world: V3; className?: string; children: ReactNode; dx?: number; dy?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const at = useRef(world);
  at.current = world;
  useEffect(() => director.each(() => {
    const el = ref.current;
    if (!el) return;
    const s = director.toScreen(new Vector3(...at.current));
    // keep it on the screen
    const x = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, s.x + dx));
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(s.y + dy)}px)`;
    el.style.opacity = s.on ? "1" : "0";
  }), [dx, dy]);
  return <div ref={ref} className={`anchor ${className ?? ""}`}>{children}</div>;
}

// ------------------------------------------------------------------------------------------ the cursor

interface CursorApi { to(t: Target, ms: number): Promise<void>; down(): void; up(): void; show(): void; hide(): void }

function point(t: Target): { x: number; y: number } | null {
  if ("world" in t) { const s = director.toScreen(t.world()); return s.on ? s : null; }
  if ("el" in t) {
    const e = document.querySelector(`[data-hud="${CSS.escape(t.el)}"]`);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return null;
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.58 };
  }
  return { x: t.x * innerWidth, y: t.y * innerHeight };
}
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function useCursor(ref: React.RefObject<HTMLDivElement | null>): CursorApi {
  const st = useRef({ pos: { x: innerWidth * 0.6, y: innerHeight * 0.6 }, from: { x: 0, y: 0 }, target: null as Target | null, t0: 0, dur: 0, done: null as null | (() => void), shown: false });
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = st.current, el = ref.current;
      if (!el) return;
      if (s.target) {
        const p = point(s.target);
        const k = s.dur ? Math.min(1, (now - s.t0) / s.dur) : 1;
        if (p) { const e = ease(k); s.pos = { x: s.from.x + (p.x - s.from.x) * e, y: s.from.y + (p.y - s.from.y) * e }; }
        if (k >= 1 && s.done) { const d = s.done; s.done = null; d(); }
      }
      el.style.transform = `translate(${s.pos.x}px, ${s.pos.y}px)`;
      el.style.opacity = s.shown ? "1" : "0";
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
  return useMemo<CursorApi>(() => ({
    to: (t, ms) => new Promise<void>((done) => {
      const s = st.current;
      if (s.done) s.done();
      Object.assign(s, { from: { ...s.pos }, target: t, t0: performance.now(), dur: ms, done });
      if (!ms) { const p = point(t); if (p) s.pos = p; s.done = null; done(); }
    }),
    down: () => ref.current?.classList.add("down"),
    up: () => {
      const el = ref.current;
      if (!el) return;
      el.classList.remove("down");
      const ring = el.querySelector(".ripple");
      ring?.classList.remove("go");
      void (ring as HTMLElement | null)?.offsetWidth;
      ring?.classList.add("go");
    },
    show: () => { st.current.shown = true; },
    hide: () => { st.current.shown = false; st.current.target = null; if (st.current.done) { const d = st.current.done; st.current.done = null; d(); } },
  }), [ref]);
}

// ------------------------------------------------------------------------------------------ the explainer runner

class Stop extends Error {}

function useExplainer(setScene: React.Dispatch<React.SetStateAction<Scene>>, setHud: React.Dispatch<React.SetStateAction<Hud>>, cursor: CursorApi) {
  const run = useRef(0);
  const ff = useRef(-1);
  const start = useCallback((from = 0) => {
    const id = ++run.current;
    ff.current = from;
    const check = () => { if (run.current !== id) throw new Stop(); };
    const fast = () => ff.current >= 0;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, fast() ? 0 : ms)).then(check);
    let mins = 7 * 60 + 38, logId = 0;
    const clock = () => { const h = Math.floor(mins / 60), m = mins % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
    const ctx: Ctx = {
      scene: (p) => { check(); setScene((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) })); },
      hud: (p) => { check(); setHud((h) => ({ ...h, ...(typeof p === "function" ? p(h) : p) })); },
      pose: (p) => { check(); director.pose(p); if (fast()) director.snap(); },
      to: async (t, ms = 700) => { check(); await cursor.to(t, fast() ? 0 : ms); check(); },
      click: async () => { check(); if (fast()) return; cursor.down(); await sleep(120); cursor.up(); await sleep(80); },
      down: () => { check(); cursor.down(); },
      up: () => { check(); cursor.up(); },
      wait: sleep,
      type: async (text, set, cps = 40) => {
        check();
        if (fast()) return set(text);
        for (let i = 1; i <= text.length; i++) { set(text.slice(0, i)); await sleep(1000 / cps); }
      },
      count: async (a, b, ms, set) => {
        check();
        if (fast()) return set(b);
        const t0 = performance.now();
        for (;;) { const k = Math.min(1, (performance.now() - t0) / ms); set(a + (b - a) * k); if (k >= 1) break; await sleep(30); }
      },
      log: (text, tone) => {
        check();
        mins += 3 + ((logId * 7) % 6);
        const line = { id: ++logId, time: clock(), text, tone };
        setHud((h) => ({ ...h, log: [...h.log.slice(-4), line] }));
      },
      chapter: (i) => {
        check();
        if (i === 0) { mins = 7 * 60 + 38; logId = 0; }
        if (i >= ff.current) ff.current = -1;
        setHud((h) => ({ ...h, chapter: i }));
      },
    };
    cursor.show();
    (async () => {
      while (run.current === id) {
        try { await explainer(ctx); }
        catch (e) { if (!(e instanceof Stop)) console.error(e); return; }
      }
    })();
  }, [cursor, setHud, setScene]);
  const stop = useCallback(() => { run.current++; cursor.hide(); }, [cursor]);
  return useMemo(() => ({ start, stop }), [start, stop]);
}

// ------------------------------------------------------------------------------------------ section scenes

const G = GROUND;
const KITCHEN = roomByType(G, "kitchen");
const LAV = G.rooms.find((r) => r.type === "wc") ?? roomByType(G, "laundry");
const LIVING = roomByType(G, "living");

/** the pins every section below the top starts with */
const SECTION_PINS: Pin[] = [
  makePin({ id: "s1", number: 1, kind: "task", title: "Rough-in counter outlets", element_id: KITCHEN.id, floor_id: G.id, tagged: ["Aisha Khan"] }),
  makePin({ id: "s2", number: 2, kind: "issue", title: "Leak under the vanity", element_id: LAV.id, floor_id: G.id, tagged: ["Tom Reilly"] }),
  makePin({ id: "s3", number: 3, kind: "note", title: "Client wants the TV wall 6\" deeper", element_id: LIVING.id, floor_id: G.id }),
];

/** a made-up eight-week schedule for the ground floor, for the progress slider */
const SCHEDULE = G.rooms.filter((r) => r.type !== "garage").map((r, i) => ({ id: r.id, start: 1 + ((i * 3) % 6), weeks: 2 + (i % 2) }));
function weekStates(week: number): Record<string, ElementStatus> {
  const out: Record<string, ElementStatus> = {};
  for (const r of G.rooms.filter((x) => x.type === "garage")) out[r.id] = "existing";
  for (const s of SCHEDULE) out[s.id] = week >= s.start + s.weeks ? "done" : week >= s.start ? "in_progress" : "not_built";
  return out;
}

const LOOKS = [
  { look: "slab", label: "Slab", line: "Chalk lines on the slab. Every wall where the drawing puts it." },
  { look: "framing", label: "Framing", line: "Studs at 16 inches, headers over every door and window." },
  { look: "drywall", label: "Sheetrock", line: "Bare board, no trim. What the crew sees that week." },
  { look: "finished", label: "Finished", line: "Siding, trim, roof and the lot. What the client is paying for." },
] as const;

function presetPose(k: ScenePreset): Pose {
  switch (k) {
    case "outside": return { az: 0.65, pol: 1.0, dist: 3.3, spin: 0.05 };
    case "stages": return { az: -0.55, pol: 0.88, dist: 3.5, spin: 0.035 };
    case "pins": return { az: 0.4, pol: 0.55, dist: 2.2 };
    case "crew": return { az: -0.45, pol: 0.68, dist: 2.0 };
    case "progress": return { az: 0.05, pol: 0.24, dist: 2.3 };
    case "assistant": return { az: 0.2, pol: 0.5, dist: 2.1 };
    case "build": return { az: 0.85, pol: 0.62, dist: 1.9 };
    case "jobs": return { az: 0.3, pol: 0.62, dist: 5.4, spin: 0.07 };
  }
}

// ------------------------------------------------------------------------------------------ the page

type Section = "hero" | "stages" | "pins" | "ask" | "progress" | "features" | "end";

function App() {
  const gl = useMemo(() => webglAvailable(), []);
  const [hero, setHero] = useState<Scene>({ ...BASE_SCENE, look: "slab" });
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [active, setActive] = useState<Section>("hero");
  const [driving, setDriving] = useState(false);
  const [paused, setPaused] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursor = useCursor(cursorRef);
  const runner = useExplainer(setHero, setHud, cursor);
  const chapterAt = useRef(0);
  chapterAt.current = hud.chapter;
  const activeRef = useRef<Section>("hero");

  // the sections' own live state
  const [look, setLook] = useState(0);
  const [extraPins, setExtraPins] = useState<Pin[]>([]);
  const [week, setWeek] = useState(4);
  const [hover, setHover] = useState<ScenePreset | null>(null);

  // which part of the page is in the middle of the screen
  useEffect(() => {
    const onScroll = () => {
      const mid = innerHeight * 0.5;
      let at: Section = "hero";
      document.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) at = el.dataset.section as Section;
      });
      setActive(at);
      activeRef.current = at;
      // the stage section scrubs through the build stages as you scroll it
      const st = document.querySelector<HTMLElement>("[data-section=stages]");
      if (st) {
        const r = st.getBoundingClientRect();
        const k = Math.min(0.999, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
        setLook(Math.floor(k * 4));
      }
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
  }, []);

  // the explainer plays while the top is on screen, and picks up where it left off
  useEffect(() => {
    if (active !== "hero" || driving || paused || !gl) return;
    director.take();
    runner.start(chapterAt.current);
    return () => runner.stop();
  }, [active, driving, paused, gl, runner]);

  // leaving the top hands the camera back to the page
  useEffect(() => {
    if (active !== "hero" && driving) { setDriving(false); director.take(); }
  }, [active, driving]);

  const wide = useWide();
  useEffect(() => {
    director.shift = !wide ? 0 : active === "hero" ? 0.06 : active === "end" ? 0 : 0.17;
  }, [active, wide]);

  const sectionScene = useMemo<Scene>(() => {
    const floorPins = { ...BASE_SCENE, mode: "floor" as const, floorId: G.id, pins: [...SECTION_PINS, ...extraPins] };
    switch (active) {
      case "stages": return { ...BASE_SCENE, look: LOOKS[look].look };
      case "pins": return floorPins;
      case "ask": return floorPins;
      case "progress": return { ...BASE_SCENE, mode: "floor", floorId: G.id, colorMode: "progress", states: weekStates(week) };
      case "features": {
        const k = hover ?? "jobs";
        if (k === "pins" || k === "crew" || k === "assistant") return floorPins;
        if (k === "progress") return { ...BASE_SCENE, mode: "floor", floorId: G.id, colorMode: "progress", states: weekStates(5) };
        if (k === "build") return { ...BASE_SCENE, mode: "floor", floorId: G.id, wallMode: "low" };
        if (k === "stages") return { ...BASE_SCENE, look: "framing" };
        return BASE_SCENE;
      }
      default: return BASE_SCENE;
    }
  }, [active, look, extraPins, week, hover]);

  useEffect(() => {
    if (active === "hero") return;
    const k: ScenePreset = active === "stages" ? "stages" : active === "pins" ? "pins" : active === "ask" ? "assistant" : active === "progress" ? "progress" : active === "features" ? hover ?? "jobs" : "outside";
    director.pose(presetPose(k));
  }, [active, hover]);

  const scene = active === "hero" ? hero : sectionScene;

  // ---------------------------------------------------------------- the visitor drives
  const takeControls = useCallback(() => {
    runner.stop();
    clearMarks();
    setDriving(true);
    setHero((s) => ({ ...BASE_SCENE, pins: s.pins }));
    setHud((h) => ({ ...EMPTY_HUD, jobs: h.jobs, chapter: h.chapter, tags: [], log: h.log }));
    director.release();
  }, [runner]);
  const replay = useCallback(() => {
    setDriving(false);
    setPaused(false);
    chapterAt.current = 0;
    setHud((h) => ({ ...h, chapter: 0 }));
    director.take();
    if (activeRef.current === "hero") runner.start(0);
    else scrollTo({ top: 0, behavior: "smooth" });
  }, [runner]);
  const jump = useCallback((i: number) => {
    setDriving(false);
    setPaused(false);
    runner.stop();
    chapterAt.current = i;
    setHud((h) => ({ ...h, chapter: i }));
    director.take();
    runner.start(i);
  }, [runner]);

  const onOpenFloor = useCallback((id: string) => {
    if (!driving) return;
    setHero((s) => ({ ...s, mode: "floor", floorId: id }));
    const f = plan.floors.find((x) => x.id === id);
    setHud((h) => ({ ...h, breadcrumb: ["All jobs", "14 Hadley Rd", f?.name ?? "Floor"] }));
  }, [driving]);
  const onLimitOut = useCallback(() => {
    if (!driving) return;
    setHero((s) => ({ ...s, mode: "building", floorId: null }));
    setHud((h) => ({ ...h, breadcrumb: ["All jobs", "14 Hadley Rd"] }));
  }, [driving]);
  const onPlacePin = useCallback((t: PinTarget) => {
    if (!driving) return;
    let world: V3;
    if (t.anchor?.view === "point") world = [t.anchor.x * S, (t.anchor.z ?? 0) * S + 0.4, t.anchor.y * S];
    else if (t.x != null && t.y != null && t.floorId) world = [t.x * S, floorY(t.floorId) + 0.6, t.y * S];
    else return;
    setHero((s) => {
      const p = makePin({ kind: "task", title: "", floor_id: t.floorId, x: t.x, y: t.y, element_id: t.elementId, anchor: t.anchor, number: s.pins.length + 1 });
      setHud((h) => ({ ...h, note: { pinId: p.id, kind: "task", title: "", due: "Fri", tagged: [], world, editing: true } }));
      return { ...s, pins: [...s.pins, p], selectedPin: p.id, pinMode: false };
    });
  }, [driving]);
  const saveNote = useCallback(() => {
    const n = hud.note;
    if (!n) return;
    const title = n.title.trim() || "New task";
    setHero((s) => ({ ...s, selectedPin: null, pins: s.pins.map((p) => (p.id === n.pinId ? { ...p, title, kind: n.kind, tagged: n.tagged } : p)) }));
    setHud((h) => ({
      ...h, note: null,
      tags: n.tagged.length ? [...h.tags.filter((x) => x.pinId !== n.pinId), { pinId: n.pinId, who: n.tagged, world: [n.world[0], n.world[1] + 0.9, n.world[2]] }] : h.tags,
      log: [...h.log.slice(-4), { id: Date.now(), time: "Now", text: `You pinned "${title}"${n.tagged.length ? `, ${n.tagged.join(" and ")} tagged` : ""}`, tone: "new" }],
    }));
  }, [hud.note]);
  const zoom = (f: number) => {
    const r = director.rig();
    if (!r) return;
    const off = r.camera.position.clone().sub(r.orbit.target);
    off.setLength(Math.min(r.orbit.maxDistance, Math.max(r.orbit.minDistance, off.length() / f)));
    r.camera.position.copy(r.orbit.target).add(off);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!driving || (e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "Escape") { if (hud.note) setHud((h) => ({ ...h, note: null })); else onLimitOut(); }
      if (e.key.toLowerCase() === "p") setHero((s) => ({ ...s, pinMode: !s.pinMode }));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [driving, hud.note, onLimitOut]);

  return (
    <>
      <div className="world" aria-hidden={!driving}>
        {gl ? <House scene={scene} onOpenFloor={onOpenFloor} onPlacePin={onPlacePin} onLimitOut={onLimitOut} /> : <div className="no-gl" />}
      </div>
      <div className={`shade shade-${active}`} />
      <Catcher active={active} driving={driving} scene={scene} onTake={takeControls} />

      <Header />
      <main>
        <HeroSection hud={hud} driving={driving} paused={paused} gl={gl} active={active === "hero"} pinMode={hero.pinMode}
          onTake={takeControls} onReplay={replay} onJump={jump} onPause={() => setPaused((p) => !p)}
          onPinTool={() => setHero((s) => ({ ...s, pinMode: !s.pinMode }))} onZoom={zoom} onOut={onLimitOut}
          setNote={(n) => setHud((h) => ({ ...h, note: h.note && { ...h.note, ...n } }))} onSave={saveNote} onClose={() => setHud((h) => ({ ...h, note: null }))} />
        <StagesSection look={look} onLook={(i) => {
          const el = document.querySelector<HTMLElement>("[data-section=stages]");
          if (el) scrollTo({ top: el.offsetTop + (el.offsetHeight - innerHeight) * ((i + 0.5) / 4), behavior: "smooth" });
        }} />
        <PinsSection pins={[...SECTION_PINS, ...extraPins]} onDrop={(kind) => setExtraPins((ps) => dropPin(ps, kind))} onClear={() => setExtraPins([])} />
        <AskSection active={active === "ask"} />
        <ProgressSection week={week} onWeek={setWeek} />
        <FeaturesSection onHover={setHover} />
        <NewSection />
        <EndSection onReplay={replay} />
      </main>
      <Footer />

      {active === "hero" && <HeroAnchors hud={hud} />}
      <div ref={cursorRef} className="cursor" aria-hidden>
        <svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.6 15.2 L17 15 Z" fill="#f4f1ea" stroke="#141513" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        <span className="ripple" />
        {hud.dragFile && <span className="drag-file"><FileIcon /> house.dwg</span>}
        {hud.dragging && <span className="drag-face"><Face name={hud.dragging} size={30} /></span>}
        {hero.pinMode && active === "hero" && !driving && <span className="tool-badge">P</span>}
      </div>
    </>
  );
}

function useWide() {
  const [wide, setWide] = useState(() => innerWidth >= 900);
  useEffect(() => { const f = () => setWide(innerWidth >= 900); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  return wide;
}

function dropPin(ps: Pin[], kind: PinKind): Pin[] {
  const titles: Record<PinKind, string[]> = {
    task: ["Hang the new door", "Patch and paint the ceiling", "Set the vanity", "Move the switch 6\" left"],
    issue: ["Crack over the window", "Floor out of level 3/8\"", "Breaker trips on the range"],
    note: ["Client picked the oak floor", "Keep the drive clear Tuesday", "Inspector coming at 10"],
    material: ["130 ft² floor tile", "4 sheets 1/2\" drywall", "2x4x8 studs, 40 pcs"],
  };
  const taken = new Set([...SECTION_PINS, ...ps].map((p) => p.element_id));
  const rooms = G.rooms.filter((r) => !taken.has(r.id));
  const room = rooms[Math.floor(Math.random() * rooms.length)] ?? G.rooms[ps.length % G.rooms.length];
  const list = titles[kind];
  const who = kind === "task" || kind === "issue" ? [CREW[ps.length % 3].name] : [];
  const next = [...ps, makePin({ id: `x${Date.now()}`, number: SECTION_PINS.length + ps.length + 1, kind, title: list[ps.length % list.length], element_id: room.id, floor_id: G.id, tagged: who })];
  return next.length > 8 ? next.slice(-8) : next;
}

// ------------------------------------------------------------------------------------------ the visitor's mouse

/** Over the house, the room under the mouse is named, and the house leans a little toward the mouse. */
function Catcher({ active, driving, scene, onTake }: { active: Section; driving: boolean; scene: Scene; onTake: () => void }) {
  const tip = useRef<HTMLDivElement>(null);
  const sc = useRef(scene);
  sc.current = scene;
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = tip.current;
      if (!el) return;
      director.lean = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
      const over = (e.target as HTMLElement).closest(".catcher, .world");
      const s = sc.current;
      const ids = s.mode === "floor" && s.floorId ? [s.floorId] : s.look === "slab" ? [G.id] : plan.floors.map((f) => f.id);
      const hit = over && e.pointerType === "mouse" ? director.pick(e.clientX, e.clientY, ids) : null;
      if (!hit?.room) { el.style.opacity = "0"; return; }
      const r = hit.room;
      el.innerHTML = `<b>${r.id}</b> ${r.name}<span>${hit.floor.name} · ${squareFeet(r.area_m2)}</span><span class="xy">x ${feetInches(hit.at[0])}  y ${feetInches(hit.at[1])}</span>`;
      el.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 16}px)`;
      el.style.opacity = "1";
    };
    const hide = () => { if (tip.current) tip.current.style.opacity = "0"; };
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerdown", hide);
    return () => { removeEventListener("pointermove", onMove); removeEventListener("pointerdown", hide); };
  }, []);
  return (
    <>
      <div className={`catcher ${driving ? "off" : ""}`} onClick={() => active === "hero" && !driving && onTake()} title={active === "hero" && !driving ? "Click to take the controls" : undefined} />
      <div ref={tip} className="readout" />
    </>
  );
}

// ------------------------------------------------------------------------------------------ header and footer

function Header() {
  const [solid, setSolid] = useState(false);
  useEffect(() => { const f = () => setSolid(scrollY > 40); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  return (
    <header className={`top ${solid ? "solid" : ""}`}>
      <a href="#" className="brand" aria-label="Rorker" dangerouslySetInnerHTML={{ __html: logoSvg }} />
      <nav>
        <a href="#how">How it works</a>
        <a href="#features">Features</a>
        <a href="#new">What&apos;s new</a>
        <a href={APP} className="btn btn-solid btn-sm">Open the app</a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <span className="foot-mark" dangerouslySetInnerHTML={{ __html: symbolSvg }} />
      <span>Rorker. Job software for contractors.</span>
      <a href={APP}>build.rorker.com</a>
      <span className="mono">© 2026</span>
    </footer>
  );
}

// ------------------------------------------------------------------------------------------ the top: the live explainer

function HeroSection(p: {
  hud: Hud; driving: boolean; paused: boolean; gl: boolean; active: boolean; pinMode: boolean;
  onTake: () => void; onReplay: () => void; onJump: (i: number) => void; onPause: () => void; onPinTool: () => void; onZoom: (f: number) => void; onOut: () => void;
  setNote: (n: Partial<Note>) => void; onSave: () => void; onClose: () => void;
}) {
  const { hud } = p;
  const ch = CHAPTERS[hud.chapter] ?? CHAPTERS[0];
  return (
    <section className="hero" data-section="hero" id="top">
      <div className="hero-copy">
        <Tag tone="live">Live, in your browser</Tag>
        <h1>Run every job<br />from above.</h1>
        <p>Rorker turns the drawing into the house, in 3D. Pin the work where it goes, tag your crew, and watch the job move. Built for contractors.</p>
        <div className="row">
          {p.driving
            ? <button className="btn btn-solid" onClick={p.onReplay}>Play the demo again</button>
            : <button className="btn btn-solid" onClick={p.onTake} disabled={!p.gl}>Take the controls</button>}
          <a className="btn btn-line" href={APP} data-hud="open-app">Open the app</a>
        </div>
      </div>

      <div className="hud-top">
        <span className="crumbs">{hud.breadcrumb.map((b, i) => <span key={i}>{b}</span>)}</span>
        <span className={`live ${p.driving ? "you" : ""}`}><i />{p.driving ? "You're driving" : p.paused ? "Paused" : "Live demo"}</span>
      </div>

      {hud.banner && <div className="banner" key={hud.banner.title}><b>{hud.banner.title}</b><span>{hud.banner.sub}</span></div>}

      <div className="side">
      <aside className="panel jobs">
        <div className="panel-head"><span>Jobs</span><span className="mono">{hud.jobs.length}</span><button className="mini" data-hud="new-job">+ New job</button></div>
        {hud.newJob && (
          <div className="newjob">
            <div className={`drop ${hud.newJob.file ? "has" : ""}`} data-hud="drop">
              {hud.newJob.file ? <><FileIcon /> house.dwg</> : "Drop the drawing here"}
              {hud.newJob.phase === "reading" && <span className="bar"><i style={{ width: `${hud.newJob.progress * 100}%` }} /></span>}
            </div>
            {!hud.newJob.file && <div className="tray"><span className="mono">Downloads</span><span className={`file ${hud.dragFile ? "lifted" : ""}`} data-hud="file"><FileIcon /> house.dwg</span><span className="file dim"><FileIcon /> kitchen.pdf</span></div>}
            {hud.newJob.phase === "read" && <div className="read-ok">Read. Every room numbered.</div>}
          </div>
        )}
        {hud.jobs.map((j) => (
          <div key={j.id} className={`job ${j.fresh ? "fresh" : ""}`}>
            <div className="job-top"><b>{j.name}</b><span className="mono">{j.pct}%</span></div>
            <div className="job-sub">{j.sub} · {j.stage}{j.late ? <em> · {j.late} late</em> : null}</div>
            <span className="bar"><i style={{ width: `${j.pct}%` }} /></span>
          </div>
        ))}
      </aside>

      <aside className="panel crew">
        <div className="panel-head"><span>Crew</span><span className="mono">{CREW.length}</span></div>
        {CREW.map((m) => {
          const on = hud.tags.some((t) => t.who.includes(m.name)) || hud.note?.tagged.includes(m.name);
          return (
            <button key={m.name} className={`member ${hud.dragging === m.name ? "lifted" : ""} ${on ? "on" : ""}`} data-hud={`crew-${m.name}`}
              onClick={() => p.driving && hud.note && p.setNote({ tagged: hud.note.tagged.includes(m.name) ? hud.note.tagged.filter((x) => x !== m.name) : [...hud.note.tagged, m.name] })}>
              <Face name={m.name} size={26} /><span><b>{m.name}</b><small>{m.title}</small></span>{on && <i className="dot" />}
            </button>
          );
        })}
        {p.driving && <div className="hint">With a pin open, click a name to tag them.</div>}
      </aside>
      </div>

      <div className="tools">
        <button className={`tool ${hud.hot === "pin-tool" || (p.driving && p.pinMode) ? "hot" : ""}`} data-hud="pin-tool" onClick={p.driving ? p.onPinTool : undefined}><PinIcon /> Pin <kbd>P</kbd></button>
        <button className="tool" onClick={p.driving ? p.onOut : undefined}><BuildIcon /> {p.driving ? "Back out" : "Build"} <kbd>{p.driving ? "Esc" : "B"}</kbd></button>
        {p.driving && <><button className="tool icon" onClick={() => p.onZoom(1.25)} aria-label="Zoom in">+</button><button className="tool icon" onClick={() => p.onZoom(0.8)} aria-label="Zoom out">−</button></>}
        <div className={`ask ${hud.ask?.listening ? "listening" : ""}`}>
          <button className="mic" data-hud="mic" aria-label="Ask"><MicIcon /></button>
          <span className="ask-q">{hud.ask?.q || <em>Ask about any job</em>}</span>
        </div>
      </div>
      {hud.ask?.a && <div className="answer"><span className="mono">Rorker</span>{hud.ask.a}</div>}

      <div className="log">
        {hud.log.map((l) => <div key={l.id} className={`log-line ${l.tone ?? ""}`}><span className="mono">{l.time}</span>{l.text}</div>)}
      </div>

      <div className="caption">
        {p.driving
          ? <div className="driving-help"><b>You&apos;re driving.</b> Drag to turn the house. Click a floor to go in. Pick Pin (or press P) and click to drop one. Esc backs out.</div>
          : <>
              <div className="cap-num mono">{String(hud.chapter + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}</div>
              <div className="cap-title" key={ch.key}>{ch.title}</div>
              <div className="cap-line">{ch.line}</div>
            </>}
        <div className="chapters">
          {CHAPTERS.map((c, i) => <button key={c.key} className={i === hud.chapter && !p.driving ? "on" : i < hud.chapter ? "past" : ""} onClick={() => p.onJump(i)} aria-label={c.title}><span>{c.title}</span></button>)}
          <button className="pause" onClick={p.driving ? p.onReplay : p.onPause}>{p.driving ? "Replay" : p.paused ? "Play" : "Pause"}</button>
        </div>
      </div>

      {hud.end && <div className="endcard"><span dangerouslySetInnerHTML={{ __html: symbolSvg }} /><b>That was 30 seconds.</b><span>Your whole business, from above.</span></div>}
      <div className="scroll-cue mono">Scroll</div>
      {p.active && hud.note && <NoteCard note={hud.note} editing={p.driving} setNote={p.setNote} onSave={p.onSave} onClose={p.onClose} />}
    </section>
  );
}

function NoteCard({ note, editing, setNote, onSave, onClose }: { note: Note; editing: boolean; setNote: (n: Partial<Note>) => void; onSave: () => void; onClose: () => void }) {
  return (
    <Anchor world={note.world} className="note-anchor" dx={26} dy={-40}>
      <div className="note" style={{ "--k": PIN_COLOR[note.kind] } as CSSProperties}>
        <div className="note-kinds">
          {(Object.keys(KIND_LABEL) as PinKind[]).map((k) => <button key={k} className={k === note.kind ? "on" : ""} style={{ "--k": PIN_COLOR[k] } as CSSProperties} onClick={() => editing && setNote({ kind: k })}>{KIND_LABEL[k]}</button>)}
          {editing && <button className="x" onClick={onClose} aria-label="Close">×</button>}
        </div>
        {editing
          ? <input autoFocus value={note.title} placeholder="What needs doing here?" onChange={(e) => setNote({ title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && onSave()} />
          : <div className="note-title">{note.title}<i className="caret" /></div>}
        <div className="note-tags" data-hud="note-tags">
          {note.tagged.length ? note.tagged.map((n) => <span key={n} className="who"><Face name={n} size={20} />{n}</span>) : <span className="muted">Drag someone here to tag them</span>}
        </div>
        <div className="note-foot"><span className="mono">Due {note.due}</span><button className="btn btn-solid btn-sm" data-hud="note-save" onClick={editing ? onSave : undefined}>Save</button></div>
      </div>
    </Anchor>
  );
}

function HeroAnchors({ hud }: { hud: Hud }) {
  return <>{hud.tags.map((t) => <Anchor key={t.pinId} world={t.world} className="pin-faces" dx={-14} dy={-30}>{t.who.map((w) => <Face key={w} name={w} size={24} />)}</Anchor>)}</>;
}

// ------------------------------------------------------------------------------------------ sections

function SectionLabel({ n, children }: { n: string; children: ReactNode }) {
  return <div className="label"><span className="punch" /><span className="mono">{n}</span>{children}</div>;
}

function StagesSection({ look, onLook }: { look: number; onLook: (i: number) => void }) {
  const counts = useMemo(() => {
    const rooms = plan.floors.reduce((n, f) => n + f.rooms.length, 0);
    const doors = plan.floors.reduce((n, f) => n + f.openings.filter((o) => o.kind.includes("door")).length, 0);
    const windows = plan.floors.reduce((n, f) => n + f.openings.filter((o) => o.kind.includes("window")).length, 0);
    return { rooms, doors, windows };
  }, []);
  return (
    <section className="sec tall" data-section="stages" id="how">
      <div className="sticky">
        <div className="card">
          <SectionLabel n="S-01">From drawing to house</SectionLabel>
          <h2>Drop in the drawing. Get the house.</h2>
          <p>AutoCAD, PDF or a photo of the plan. Rorker reads every room, wall, door, window and fixture, numbers them, and builds the house in 3D. Then it shows the house at the stage the job is at.</p>
          <div className="stat-row">
            <div><b className="mono">{counts.rooms}</b><span>rooms</span></div>
            <div><b className="mono">{counts.doors}</b><span>doors</span></div>
            <div><b className="mono">{counts.windows}</b><span>windows</span></div>
            <div><b className="mono">{plan.floors.length}</b><span>floors</span></div>
          </div>
          <div className="steps">
            {LOOKS.map((l, i) => (
              <button key={l.look} className={i === look ? "on" : i < look ? "past" : ""} onClick={() => onLook(i)}>
                <span className="mono">{String(i + 1).padStart(2, "0")}</span><b>{l.label}</b>{i === look && <small>{l.line}</small>}
              </button>
            ))}
          </div>
          <div className="formats mono">DWG · DXF · PDF · PHOTO · HAND SKETCH</div>
        </div>
      </div>
    </section>
  );
}

function PinsSection({ pins, onDrop, onClear }: { pins: Pin[]; onDrop: (k: PinKind) => void; onClear: () => void }) {
  return (
    <section className="sec" data-section="pins">
      <div className="card">
        <SectionLabel n="S-02">Pins and people</SectionLabel>
        <h2>Put the work where it goes.</h2>
        <p>A task on the kitchen counter, a crack over the window, the tile order for the upstairs bath. Every pin sits on the exact spot, with who&apos;s on it and when it&apos;s due.</p>
        <div className="drop-row">
          {(Object.keys(KIND_LABEL) as PinKind[]).map((k) => (
            <button key={k} className="kind" style={{ "--k": PIN_COLOR[k] } as CSSProperties} onClick={() => onDrop(k)}><i />Drop {k === "issue" ? "an" : "a"} {KIND_LABEL[k].toLowerCase()}</button>
          ))}
        </div>
        <ul className="pin-list">
          {pins.slice().reverse().map((p) => (
            <li key={p.id} style={{ "--k": PIN_COLOR[p.kind] } as CSSProperties}>
              <span className="num mono">{p.number}</span><span className="t">{p.title}</span>
              <span className="where mono">{p.element_id}</span>
              {p.tagged.map((n) => <Face key={n} name={n} size={20} />)}
            </li>
          ))}
        </ul>
        {pins.length > 3 && <button className="link" onClick={onClear}>Clear the ones you dropped</button>}
      </div>
    </section>
  );
}

const QUESTIONS: { q: string; a: string; marks: () => { id: string; label: string; color: string }[] }[] = [
  { q: "Where's the leak?", a: `In the ${LAV.name.toLowerCase()}, under the vanity. Tom has it, due today. He has to close it with a photo.`, marks: () => [{ id: LAV.id, label: "Leak", color: "#ff4fa3" }] },
  { q: "What's left in the kitchen?", a: "One task: rough-in the counter outlets. Aisha, due Friday. Then the cabinets can go in.", marks: () => [{ id: KITCHEN.id, label: "Counter outlets", color: "#3b9bff" }] },
  { q: "Which rooms are done?", a: "The dining room and the family room. The living room and foyer are in progress.", marks: () => G.rooms.filter((r) => r.type === "dining" || r.type === "family").map((r, i) => ({ id: r.id, label: r.name, color: ["#34d07a", "#ffd23f"][i % 2] })) },
  { q: "Where does the TV wall go?", a: `The ${LIVING.name.toLowerCase()}, the wall facing the windows. The client wants it 6 inches deeper; that's pin 3.`, marks: () => [{ id: LIVING.id, label: "TV wall", color: "#a77bff" }] },
];

function AskSection({ active }: { active: boolean }) {
  const [i, setI] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (i == null || !active) return;
    const q = QUESTIONS[i];
    showMarks(q.marks().map((m) => { const [x, y] = roomPlanPoint(m.id); return { floor_id: G.id, x, y, z: 900, label: m.label, color: m.color, id: m.id }; }));
    let n = 0;
    setTyped("");
    const t = setInterval(() => { n += 2; setTyped(q.a.slice(0, n)); if (n >= q.a.length) clearInterval(t); }, 18);
    return () => clearInterval(t);
  }, [i, active]);
  useEffect(() => { if (!active) clearMarks(); }, [active]);
  return (
    <section className="sec" data-section="ask">
      <div className="card">
        <SectionLabel n="S-03">The assistant</SectionLabel>
        <h2>Ask it out loud.</h2>
        <p>One tap and talk, from the truck or the site. It knows every job, answers in plain words, and puts a blinking dot on the spot it means. Tell it to change something and it does.</p>
        <div className="chips">
          {QUESTIONS.map((q, k) => <button key={q.q} className={k === i ? "on" : ""} onClick={() => setI(k)}><MicIcon />{q.q}</button>)}
        </div>
        <div className="reply">
          {i == null ? <span className="muted">Pick a question. Watch the house.</span> : <><span className="mono">Rorker</span>{typed}</>}
        </div>
      </div>
    </section>
  );
}

function ProgressSection({ week, onWeek }: { week: number; onWeek: (w: number) => void }) {
  const st = weekStates(week);
  const vals = Object.values(st).filter((v) => v !== "existing");
  const done = vals.filter((v) => v === "done").length;
  const pct = Math.round((done / Math.max(1, vals.length)) * 100);
  return (
    <section className="sec" data-section="progress">
      <div className="card">
        <SectionLabel n="S-04">Progress</SectionLabel>
        <h2>See the whole job at a glance.</h2>
        <p>Rooms take the colour of the work: red not started, yellow in progress, green done, grey existing. Drag through the weeks and watch the ground floor fill in.</p>
        <div className="week">
          <div className="week-top"><b className="mono">Week {week}</b><span className="mono">{pct}% done</span></div>
          <input type="range" min={1} max={9} value={week} onChange={(e) => onWeek(Number(e.target.value))} aria-label="Week of the job" />
          <span className="bar big"><i style={{ width: `${pct}%` }} /></span>
        </div>
        <div className="legend">
          {(["not_built", "in_progress", "done", "existing"] as ElementStatus[]).map((s) => <span key={s}><i style={{ background: STATUS_COLOR[s] }} />{STATUS_WORD[s]}</span>)}
        </div>
      </div>
    </section>
  );
}

const STATUS_WORD: Record<ElementStatus, string> = { not_built: "Not started", in_progress: "In progress", done: "Done", existing: "Existing", demolish: "Demolish" };

const GROUPS = ["All", "Plan", "Crew", "Assistant", "Money", "Materials", "Clients"] as const;
const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function FeaturesSection({ onHover }: { onHover: (k: ScenePreset | null) => void }) {
  const [g, setG] = useState<(typeof GROUPS)[number]>("All");
  const list = FEATURES.filter((f) => g === "All" || f.group === g);
  const live = FEATURES.filter((f) => f.status !== "next").length, next = FEATURES.length - live;
  return (
    <section className="sec wide" data-section="features" id="features">
      <div className="card head">
        <SectionLabel n="S-05">What it does</SectionLabel>
        <h2>{live} things it does today. {next} on the way.</h2>
        <p>Point at a card and the house shows it.</p>
        <div className="filters">{GROUPS.map((x) => <button key={x} className={x === g ? "on" : ""} onClick={() => setG(x)}>{x}</button>)}</div>
      </div>
      <div className="grid" onMouseLeave={() => onHover(null)}>
        {list.map((f, i) => <FeatureCard key={f.id} f={f} i={i} onHover={onHover} />)}
      </div>
    </section>
  );
}

function FeatureCard({ f, i, onHover }: { f: Feature; i: number; onHover: (k: ScenePreset | null) => void }) {
  return (
    <article className={`feat feat-${f.status}`} tabIndex={0} onMouseEnter={() => onHover(f.scene)} onFocus={() => onHover(f.scene)}>
      <div className="feat-top">
        <span className="mono">{f.group.toUpperCase()}-{String(i + 1).padStart(2, "0")}</span>
        <Tag tone={f.status}>{f.status === "next" ? "Next" : f.status === "new" ? `New · ${day(f.shipped!)}` : "Live"}</Tag>
      </div>
      <h3>{f.title}</h3>
      <p>{f.body}</p>
    </article>
  );
}

function NewSection() {
  const byDay = useMemo(() => {
    const m = new Map<string, Feature[]>();
    for (const f of FEATURES.filter((x) => x.shipped).sort((a, b) => b.shipped!.localeCompare(a.shipped!))) m.set(f.shipped!, [...(m.get(f.shipped!) ?? []), f]);
    return [...m.entries()];
  }, []);
  return (
    <section className="sec wide" data-section="features" id="new">
      <div className="card log-card">
        <SectionLabel n="S-06">What&apos;s new</SectionLabel>
        <h2>Shipped this month.</h2>
        <ol className="shipped">
          {byDay.map(([d, fs]) => (
            <li key={d}><span className="mono when">{day(d)}</span><div>{fs.map((f) => <div key={f.id}><b>{f.title}</b> <span>{f.body.split(". ")[0]}.</span></div>)}</div></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function EndSection({ onReplay }: { onReplay: () => void }) {
  return (
    <section className="sec end" data-section="end">
      <div className="end-in">
        <SectionLabel n="S-07">Built for the trade</SectionLabel>
        <h2>Your next job,<br />from above.</h2>
        <ul className="creed">
          <li>Plain words. Feet and inches. No training day.</li>
          <li>Your crew gets a link, not another app.</li>
          <li>The assistant does the typing.</li>
        </ul>
        <div className="row center">
          <a className="btn btn-solid" href={APP}>Open the app</a>
          <button className="btn btn-line" onClick={onReplay}>Watch the 30 seconds again</button>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------ icons

const FileIcon = () => <svg width="12" height="14" viewBox="0 0 12 14"><path d="M1 1h6l4 4v8H1z" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M7 1v4h4" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
const PinIcon = () => <svg width="12" height="14" viewBox="0 0 12 14"><path d="M2 13V1h8l-2 3 2 3H2" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
const BuildIcon = () => <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 13V5l6-4 6 4v8H9V8H5v5z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
const MicIcon = () => <svg width="12" height="14" viewBox="0 0 12 14"><rect x="3.5" y="1" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M1 7a5 5 0 0 0 10 0M6 12v1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
