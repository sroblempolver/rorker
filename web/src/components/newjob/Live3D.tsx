"use client";
// The house in 3D beside the drawing, built again from the sketch as you draw (a moment after each
// change, so dragging a wall stays smooth). The camera stays where you left it. The floor you're drawing
// is the top of what's shown: the floors above lift off, like looking into a doll's house. Walls go up,
// cut away (the ones facing you drop) or down to waist height. Click a room or a piece of furniture to
// pick it in the plan. Keys: Page Up / Page Down change floor, Home / End raise and lower the walls.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plan3D, webglAvailable } from "@/components/plan/Plan3D";
import { planFromSketch, type Sketch } from "@/lib/plan/sketch";
import { useStandards } from "@/lib/plan/standards";
import type { ElementStatus, Plan } from "@/lib/plan/types";
import { editable } from "@/components/ui/hotkeys";

export type Walls = "up" | "cut" | "down";
const WALLS: Walls[] = ["up", "cut", "down"];
const WALL_LABEL: Record<Walls, string> = { up: "Walls up", cut: "Cut away", down: "Walls down" };
const WALL_HELP: Record<Walls, string> = { up: "Every wall standing, roof on", cut: "The walls facing you drop so you see in", down: "Walls at waist height" };
/** What's picked in the plan: a room or a piece of furniture on a floor (the sketch's own numbering). */
export type LiveSel = { t: "room" | "thing"; i: number } | null;

const glass = "bg-[#17181b]/90 backdrop-blur-sm border border-line";
const NO_PINS: never[] = [];
const noop = () => {};

/** Which sketch floor each plan floor came from (planFromSketch leaves out empty floors, lowest first). */
const floorOrder = (sk: Sketch) => sk.floors.map((f, i) => ({ f, i })).filter(({ f }) => f.rooms?.length || f.walls?.length).sort((a, b) => a.f.level - b.f.level).map(({ i }) => i);
// the rooms and furniture planFromSketch numbers (it skips broken outlines and unplaced objects)
const roomsOf = (sk: Sketch, i: number) => sk.floors[i].rooms.map((r, k) => (Array.isArray(r.polygon) && r.polygon.length >= 3 ? k : -1)).filter((k) => k >= 0);
const thingsOf = (sk: Sketch, i: number) => (sk.floors[i].fixtures ?? []).map((f, k) => (Array.isArray(f.center) && f.kind ? k : -1)).filter((k) => k >= 0);
const num = (n: number) => String(n + 1).padStart(2, "0");

export function Live3D({ sketch, fi, sel, walls, onWalls, onPick, onFloor, onRoof, roofOn, marks }: {
  sketch: Sketch; fi: number; sel: LiveSel; walls: Walls; onWalls: (w: Walls) => void;
  /** a click in 3D: the floor and what's on it (null for empty space) */
  onPick: (fi: number, sel: LiveSel) => void;
  onFloor: (fi: number) => void; onRoof: () => void; roofOn: boolean;
  /** rooms and things to light up on this floor (a client's changes): the rest goes grey */
  marks?: { rooms: number[]; things: number[] } | null;
}) {
  const [gl, setGl] = useState(true);
  useEffect(() => setGl(webglAvailable()), []);
  const stdv = useStandards();
  // the plan, with the sketch it was built from (the ids map back through that one)
  const [built, setBuilt] = useState<{ plan: Plan; sk: Sketch } | null>(null);
  const last = useRef(0);
  useEffect(() => {
    // after a short pause, or every 0.6 s while something is being dragged
    const wait = Math.max(0, Math.min(220, 600 - (performance.now() - last.current)));
    const t = setTimeout(() => { last.current = performance.now(); setBuilt({ plan: planFromSketch(sketch, { kind: "sketch", filename: "drawing" }).plan, sk: sketch }); }, wait);
    return () => clearTimeout(t);
  }, [sketch, stdv]);

  const level = sketch.floors[fi]?.level ?? 0;
  const above = !!built?.plan.floors.some((f) => f.level > level);
  const shown = useMemo(() => (built ? { ...built.plan, floors: built.plan.floors.filter((f) => f.level <= level) } : null), [built, level]);
  const live = useMemo(() => ({ open: walls === "cut" ? 1 : 0, roof: !above }), [walls, above]);
  const states = useMemo(() => new Map(), []);
  const ctl = useRef<{ zoomBy: (f: number) => void; home: () => void } | null>(null);
  const controls = useCallback((api: { zoomBy: (f: number) => void; home: () => void }) => { ctl.current = api; }, []);
  // the whole house stays in view as it grows, until you move the camera; then it stays where you put it
  const touched = useRef(false);
  useEffect(() => { if (shown?.floors.length && !touched.current) ctl.current?.home(); }, [shown]);

  // the picked room or thing, by its id in the plan
  const selected = useMemo(() => {
    if (!built || !sel) return null;
    const k = floorOrder(built.sk).indexOf(fi);
    const f = built.plan.floors[k];
    if (!f || !built.sk.floors[fi]) return null;
    const n = (sel.t === "room" ? roomsOf : thingsOf)(built.sk, fi).indexOf(sel.i);
    return n < 0 ? null : `${f.id}-${sel.t === "room" ? "R" : "F"}${num(n)}`;
  }, [built, sel, fi]);

  // lit up: the marked rooms, their walls and the marked things, by their ids in the plan
  const lit = useMemo(() => {
    if (!built || !marks) return null;
    const f = built.plan.floors[floorOrder(built.sk).indexOf(fi)];
    if (!f || !built.sk.floors[fi]) return null;
    const m = new Map<string, ElementStatus>();
    for (const i of marks.rooms) { const n = roomsOf(built.sk, fi).indexOf(i); if (n >= 0) m.set(`${f.id}-R${num(n)}`, "in_progress"); }
    for (const i of marks.things) { const n = thingsOf(built.sk, fi).indexOf(i); if (n >= 0) m.set(`${f.id}-F${num(n)}`, "in_progress"); }
    // the floors keep their finish, so a lit room shows by its walls
    for (const w of f.walls) if (w.room_ids.some((id) => m.has(id))) m.set(w.id, "in_progress");
    return m.size ? m : null;
  }, [built, marks, fi]);

  const pick = (id: string | null) => {
    if (!id || !built) return onPick(fi, null);
    if (id.startsWith("roof")) return onRoof();
    const k = built.plan.floors.findIndex((f) => id.startsWith(`${f.id}-`));
    const f = built.plan.floors[k], at = floorOrder(built.sk)[k];
    if (!f || at == null) return;
    // a wall, door or window picks the room it belongs to
    const el = [...f.walls, ...f.openings].find((x) => x.id === id);
    const rid = el ? el.room_ids[0] : id;
    const m = /-(R|F)(\d+)$/.exec(rid ?? "");
    if (!m) return onPick(at, null);
    const i = (m[1] === "R" ? roomsOf : thingsOf)(built.sk, at)[+m[2] - 1];
    onPick(at, i == null ? null : { t: m[1] === "R" ? "room" : "thing", i });
  };

  // floors by height, for the up and down arrows (the 2D floor tabs follow)
  const byLevel = sketch.floors.map((f, i) => ({ l: f.level, i })).sort((a, b) => a.l - b.l).map((x) => x.i);
  const step = (d: 1 | -1) => { const k = byLevel.indexOf(fi) + d; if (k >= 0 && k < byLevel.length) onFloor(byLevel[k]); };
  const wallStep = (d: 1 | -1) => onWalls(WALLS[Math.max(0, Math.min(WALLS.length - 1, WALLS.indexOf(walls) + d))]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target instanceof Element && editable(e.target)) || e.ctrlKey || e.metaKey || e.altKey) return;
      const go = { PageUp: () => step(1), PageDown: () => step(-1), Home: () => wallStep(-1), End: () => wallStep(1) }[e.key];
      if (go) { e.preventDefault(); go(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const cur = sketch.floors[fi];
  const k = byLevel.indexOf(fi);
  return (
    <div className="relative h-full min-h-[300px] bg-ink border-t xl:border-t-0 xl:border-l border-line" aria-label="The house in 3D"
      onPointerDownCapture={(e) => { if (!(e.target as Element).closest("button")) touched.current = true; }} onWheelCapture={() => { touched.current = true; }}>
      {gl && shown ? (
        <Plan3D plan={shown} mode="building" floor={null} room={null} selected={selected} selectedPin={null} selectedItem={null} states={lit ?? states} colorMode={lit ? "progress" : "type"}
          pins={NO_PINS} items={NO_PINS} pinMode={false} draft={null} wallMode={walls === "down" ? "low" : "full"} locked live={live} controls={controls}
          onSelect={pick} onSelectPin={noop} onSelectItem={noop} onPlacePin={noop} onMoveFixture={noop} onMoveItem={noop} onMovePin={noop} onOpenFloor={noop} onLimitOut={noop} />
      ) : (
        <p className="absolute inset-x-0 top-1/3 text-center text-muted text-[14px] px-6">{gl ? "Building the 3D…" : "This browser can't show 3D."}</p>
      )}
      {built && !built.plan.floors.length && <p className="absolute inset-x-0 top-1/3 text-center text-muted text-[14px] px-6 pointer-events-none">Draw a room and it stands up here.</p>}
      <div className="absolute left-2 top-2 right-2 flex flex-wrap gap-1.5 items-start pointer-events-none">
        <button onClick={() => onWalls(WALLS[(WALLS.indexOf(walls) + 1) % WALLS.length])} title={`${WALL_HELP[walls]}. Click to change (Home / End)`}
          className={`pointer-events-auto h-8 px-2.5 rounded-[4px] text-[12px] font-display font-bold tracking-[0.08em] uppercase ${glass} hover:bg-panel-3`}>{WALL_LABEL[walls]}</button>
        <div className={`pointer-events-auto flex items-center rounded-[4px] overflow-hidden ${glass}`} role="group" aria-label="Floor">
          <button onClick={() => step(-1)} disabled={k <= 0} title="Floor down (Page Down)" aria-label="Floor down" className="h-8 w-8 hover:bg-panel-3 disabled:opacity-30">▼</button>
          <span className="px-1.5 text-[12px] font-display font-bold tracking-[0.08em] uppercase whitespace-nowrap">{cur?.name || `Level ${cur?.level ?? 0}`}</span>
          <button onClick={() => step(1)} disabled={k >= byLevel.length - 1} title="Floor up (Page Up)" aria-label="Floor up" className="h-8 w-8 hover:bg-panel-3 disabled:opacity-30">▲</button>
        </div>
        <button onClick={onRoof} aria-pressed={roofOn} title="Roof shape, pitch, overhang and foundation"
          className={`pointer-events-auto h-8 px-2.5 rounded-[4px] text-[12px] font-display font-bold tracking-[0.08em] uppercase ${glass} hover:bg-panel-3 ${roofOn ? "!text-accent !border-accent" : ""}`}>Roof</button>
        <button onClick={() => { touched.current = false; ctl.current?.home(); }} title="See the whole house" className={`pointer-events-auto h-8 px-2.5 rounded-[4px] text-[12px] font-display font-bold tracking-[0.08em] uppercase ml-auto ${glass} hover:bg-panel-3`}>Fit</button>
      </div>
      {above && <p className="absolute left-2 bottom-2 text-[12px] text-muted pointer-events-none">Floors above lifted off</p>}
    </div>
  );
}
