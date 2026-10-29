"use client";
// Draw the plan yourself, or fix what the plan reader got wrong: the uploaded drawing sits underneath,
// and simple tools trace over it. Rooms are rectangles you drag out (then drag a corner or a wall to
// reshape), a room can be cut in two, doors go on the wall between two rooms (or an outside wall),
// windows on outside walls, and things (a sink, a bed) are dropped where they are. Scale comes from one
// length you know. The result is the same sketch the reader makes, so the plan is built the same way.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Pt } from "@/lib/plan/types";
import type { Side, Sketch, SketchDoor, SketchFloor, SketchRoom } from "@/lib/plan/sketch";
import { OUTSIDE, doorSpot, hugWall, trimOverlap, outsidePieces, edgesOf, flatten, moveCorner, moveWall, nearSeg, pointInPoly, roomArea, sideOf, snapTo, splitPoly, wallAt, windowSpots, type Seg } from "@/lib/plan/sketchEdit";
import { bboxOf, centroid } from "@/lib/plan/geometry";
import { CATALOG } from "@/lib/plan/catalog";
import { MATERIAL_BASE, ROOM_MATERIAL } from "@/components/plan/style";
import { useEscape, editable } from "@/components/ui/hotkeys";
import { DOOR_W, WallView } from "./WallView";
import { tidyStroke } from "@/lib/plan/pen";
import { INCH, fmtArea, fmtLen, parseLength, roundLen, type Units } from "@/lib/plan/units";
import type { IntakePart } from "@/lib/intake/files";
import { StandardsPanel } from "./StandardsPanel";
import { Live3D, type Walls } from "./Live3D";
import { RoofPanel } from "./RoofPanel";
import { std, useStandards } from "@/lib/plan/standards";

/** A picture of the drawing to trace over. `mmPerPx` when its scale is known (an AutoCAD drawing). */
export interface Picture { name: string; url: string; mmPerPx?: number }
/** Where the picture sits under a floor: its top-left corner in mm and how big a pixel is. */
export interface Backdrop { pic: number; mmPerPx: number; at: Pt; opacity: number }

/** The pictures worth tracing from what was uploaded: whole drawings, not the close-ups of a PDF. */
export function picturesFrom(parts: IntakePart[]): Picture[] {
  return parts.filter((p): p is Extract<IntakePart, { kind: "image" }> => p.kind === "image" && !/close-up/i.test(p.name) && !/^close-up/i.test(p.note ?? ""))
    .map((p) => {
      const m = /1 pixel = ([\d.]+) mm/.exec(p.note ?? "");
      return { name: p.name, url: `data:${p.media_type};base64,${p.data}`, ...(m ? { mmPerPx: +m[1] } : {}) };
    });
}

const ROOM_TYPES = ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"] as const;
const TYPE_LABEL: Record<string, string> = { wc: "WC", stair_hall: "Stair hall" };
const label = (t: string) => TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
const THINGS: { group: string; kinds: string[] }[] = [
  { group: "Kitchen", kinds: ["base_cabinet", "kitchen_sink", "range", "fridge", "dishwasher", "island", "wall_cabinet", "tall_cabinet"] },
  { group: "Bath", kinds: ["toilet", "washbasin", "vanity", "bathtub", "shower"] },
  { group: "Rooms", kinds: ["bed", "sofa", "armchair", "dining_table", "table", "desk", "wardrobe", "tv", "fireplace"] },
  { group: "Other", kinds: ["washing_machine", "dryer", "water_heater", "car"] },
];
const DOOR_KINDS = [["door", "Door"], ["double_door", "Double door"], ["sliding_door", "Sliding door"], ["garage_door", "Garage door"], ["opening", "Open passage"]] as const;
const SIDES: Side[] = ["north", "east", "south", "west"];
const OPP: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

type Tool = "select" | "room" | "pen" | "split" | "door" | "window" | "balcony" | "thing" | "scale" | "match" | "picture";
const TOOLS: { id: Tool; label: string; key: string; help: string; menu?: boolean; picture?: boolean; more?: boolean }[] = [
  { id: "select", label: "Select", key: "v", help: "Click a room, door, window or piece of furniture to change it. Drag a room to move it, a corner to reshape it, or a wall to slide it (the room next door follows). Click a wall of the picked room to see it from the side. Arrow keys nudge. Drag empty space to look around, scroll to zoom." },
  { id: "pen", label: "Walls", key: "e", help: "Draw a room's walls with the mouse or your finger, all the way round. Wobbly lines come out straight and nearly square corners come out square; a wall drawn on a slant keeps its slant. Then type the exact sizes." },
  { id: "split", label: "Split room", key: "s", more: true, help: "Drag a line across a room to cut it in two (for two rooms read as one)." },
  { id: "door", label: "Door", key: "d", menu: true, help: "Click a wall between two rooms to put a door in it, or an outside wall for an outside door." },
  { id: "window", label: "Window", key: "w", menu: true, help: "Click an outside wall of a room to add a window there. Click again for another." },
  { id: "balcony", label: "Balcony", key: "b", menu: true, help: "Click an outside wall of a room. Upstairs that adds a balcony with a patio door onto it; on the ground floor, a patio door out to the garden." },
  { id: "thing", label: "Furniture", key: "f", help: "Cabinets, sinks, toilets, beds, appliances. Pick one, then click where it goes. Near a wall it backs onto the wall and faces the room." },
  { id: "scale", label: "Set scale", key: "k", picture: true, more: true, help: "Make the drawing underneath the right size: click both ends of something you know the length of (a wall, a dimension line), then type how long it is." },
  { id: "match", label: "Line up", key: "l", picture: true, more: true, help: "Lines the drawing up with the rooms: click a corner on the picture, then the room corner it should sit on. Do it for two corners far apart." },
  { id: "picture", label: "Move picture", key: "p", picture: true, more: true, help: "Drag the picture underneath to move it." },
  { id: "room", label: "Box room", key: "r", more: true, help: "Drag out a rectangular room, corner to corner. Edges snap to the rooms beside it so they share the wall." },
];
const DRAFT = "rorker-drawing-draft";
// what the Doors & windows menu puts in a wall
const OPENINGS = [
  ["door", "Door"], ["double_door", "Double door"], ["sliding_door", "Patio / sliding door"], ["garage_door", "Garage door"], ["opening", "Opening (no door)"],
  ["window", "Window"], ["balcony", "Balcony / patio door"],
] as const;

type Sel = { t: "room" | "door" | "window" | "thing"; i: number } | null;
type Drag =
  | { k: "pan"; c: Pt; v: View }
  | { k: "newRoom"; a: Pt; b: Pt }
  | { k: "split"; a: Pt; b: Pt }
  | { k: "pen"; pts: Pt[] }
  | { k: "move"; i: number; from: Pt; orig: Pt[]; moved: boolean }
  | { k: "corner"; i: number; v: number; orig: Pt[] }
  | { k: "wall"; s: Seg; from: Pt; orig: SketchRoom[]; i: number; e: number; moved: boolean }
  | { k: "thing"; i: number; from: Pt; orig: Pt }
  | { k: "picture"; from: Pt; orig: Pt };
interface View { x: number; y: number; w: number }

const r10 = (v: number) => Math.round(v / 10) * 10;
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const blankFloor = (level: number): SketchFloor => ({ name: level === 0 ? "Ground floor" : `Level ${level}`, level, rooms: [], doors: [], windows: [], fixtures: [] });


export function SketchEditor({ initial, pictures, initialBackdrops, onDone, onCancel, doneLabel = "Use this plan" }: {
  initial: Sketch | null; pictures: Picture[]; initialBackdrops?: Record<number, Backdrop>;
  onDone: (sketch: Sketch, backdrops: Record<number, Backdrop>) => void; onCancel: () => void; doneLabel?: string;
}) {
  const [sk, setSk] = useState<Sketch>(() => (initial?.floors?.length ? flatten(initial) : { floors: [blankFloor(0)] }));
  const past = useRef<Sketch[]>([]);
  const [fi, setFi] = useState(0);
  const [tool, setTool] = useState<Tool>(initial?.floors?.length ? "select" : pictures.length ? "scale" : "pen");
  const [doorKind, setDoorKind] = useState<NonNullable<SketchDoor["kind"]>>("door");
  const [wallAdd, setWallAdd] = useState<"balcony" | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [thing, setThing] = useState("kitchen_sink");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [clicks, setClicks] = useState<Pt[]>([]);
  const [lengthText, setLengthText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [sizes, setSizes] = useState<Record<number, [number, number]>>({});
  const [bgs, setBgs] = useState<Record<number, Backdrop>>(initialBackdrops ?? {});
  // the wall seen from the side (a room and which of its edges), and the "+ Floor" choice
  const [wall, setWall] = useState<{ room: number; edge: number } | null>(null);
  const [addingFloor, setAddingFloor] = useState(false);
  // the company's standards, open in the side panel
  const [showStd, setShowStd] = useState(false);
  // the live 3D beside the plan, its walls, and the roof panel
  const [show3d, setShow3d] = useState(false);
  const [walls3d, setWalls3d] = useState<Walls>("up");
  const [showRoof, setShowRoof] = useState(false);
  useStandards();
  // lengths are shown and typed in feet and inches
  const lu: Units = "ft";
  const svg = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 800, h: 560 });
  const floor = sk.floors[Math.min(fi, sk.floors.length - 1)];

  // the pictures' sizes, for placing them under the rooms
  useEffect(() => {
    pictures.forEach((p, i) => { const im = new Image(); im.onload = () => setSizes((s) => ({ ...s, [i]: [im.naturalWidth, im.naturalHeight] })); im.src = p.url; });
  }, [pictures]);
  // a floor's picture: the matching overview, at the drawing's own scale when known, else stretched over the rooms
  useEffect(() => {
    if (!pictures.length || bgs[fi]) return;
    const pic = Math.min(fi, pictures.length - 1);
    const size = sizes[pic];
    if (!size) return;
    const known = pictures[pic].mmPerPx;
    let b: Backdrop;
    if (known) b = { pic, mmPerPx: known, at: [0, 0], opacity: 0.55 };
    else if (floor.rooms.length) {
      const [x0, y0, x1, y1] = bboxOf(floor.rooms.flatMap((r) => r.polygon));
      const mmPerPx = ((x1 - x0) * 1.15) / size[0];
      b = { pic, mmPerPx, at: [(x0 + x1) / 2 - (size[0] * mmPerPx) / 2, (y0 + y1) / 2 - (size[1] * mmPerPx) / 2], opacity: 0.55 };
    } else b = { pic, mmPerPx: 10, at: [0, 0], opacity: 0.6 };
    setBgs((x) => ({ ...x, [fi]: b }));
  }, [fi, sizes, pictures, bgs, floor.rooms]);
  const bg = bgs[fi];
  // the floor this one is drawn on top of, shown underneath so rooms line up with its walls
  const below = floor.guide == null ? null : sk.floors.find((f) => f.level === floor.guide && f !== floor) ?? null;
  const belowOutline = useMemo(() => (below ? below.rooms.flatMap((_, i) => outsidePieces(below, i)) : []), [below]);

  // the camera
  const home = useMemo(() => {
    const pts: Pt[] = [...floor.rooms, ...(below?.rooms ?? [])].flatMap((r) => r.polygon);
    if (bg && sizes[bg.pic]) pts.push(bg.at, [bg.at[0] + sizes[bg.pic][0] * bg.mmPerPx, bg.at[1] + sizes[bg.pic][1] * bg.mmPerPx]);
    if (!pts.length) pts.push([0, 0], [15000, 10000]);
    const [x0, y0, x1, y1] = bboxOf(pts);
    return { x: x0, y: y0, w: Math.max(2000, x1 - x0), h: Math.max(2000, y1 - y0) };
  }, [floor, below, bg, sizes]);
  const fitView = (): View => {
    const aspect = box.h / box.w, pad = 0.05;
    let w = home.w * (1 + 2 * pad);
    if (w * aspect < home.h * (1 + 2 * pad)) w = (home.h * (1 + 2 * pad)) / aspect;
    return { x: home.x + home.w / 2 - w / 2, y: home.y + home.h / 2 - (w * aspect) / 2, w };
  };
  const [view, setView] = useState<View | null>(null);
  const fitted = useRef(-1);
  useEffect(() => { if (fitted.current !== fi && (bg || !pictures.length)) { fitted.current = fi; setView(fitView()); } }, [fi, bg, box]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth || 800, h: el.clientHeight || 560 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const v = view ?? fitView();
  const vh = (v.w * box.h) / box.w;
  const px = v.w / box.w; // mm per screen pixel
  const toMm = (e: { clientX: number; clientY: number }): Pt => {
    const r = svg.current!.getBoundingClientRect();
    return [v.x + ((e.clientX - r.left) / r.width) * v.w, v.y + ((e.clientY - r.top) / r.height) * vh];
  };
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((cur) => {
        const c = cur ?? fitView();
        const k = Math.exp(e.deltaY * 0.0015), h = (c.w * box.h) / box.w;
        const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        const w = Math.max(1500, Math.min(400000, c.w * k));
        return { x: c.x + fx * c.w - fx * w, y: c.y + fy * h - (fy * w * box.h) / box.w, w };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });
  const zoom = (k: number) => setView({ x: v.x + v.w / 2 - (v.w * k) / 2, y: v.y + vh / 2 - (vh * k) / 2, w: v.w * k });

  // changing the sketch, with undo
  const future = useRef<Sketch[]>([]);
  const commit = (next: Sketch) => { past.current.push(sk); if (past.current.length > 80) past.current.shift(); future.current = []; setSk(next); };
  const setFloor = (f: SketchFloor, keepHistory = true) => {
    const next = { ...sk, floors: sk.floors.map((x, i) => (i === fi ? f : x)) };
    if (keepHistory) commit(next); else setSk(next);
  };
  const undo = () => { const p = past.current.pop(); if (p) { future.current.push(sk); setSk(p); setSel(null); } };
  const redo = () => { const n = future.current.pop(); if (n) { past.current.push(sk); setSk(n); setSel(null); } };

  // kept in this browser as you go, so a crash or a closed tab doesn't lose the drawing
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [draft, setDraft] = useState<{ sk: Sketch; at: string } | null>(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? "null"); return d?.sk?.floors?.some((f: SketchFloor) => f.rooms.length) ? d : null; } catch { return null; }
  });
  const saveNow = () => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ sk, at: new Date().toISOString() })); setSavedAt(new Date()); } catch { /* storage full or blocked */ }
  };
  useEffect(() => {
    if (draft || !sk.floors.some((f) => f.rooms.length)) return;
    const t = setTimeout(saveNow, 800);
    return () => clearTimeout(t);
  }, [sk]); // eslint-disable-line react-hooks/exhaustive-deps

  // a new floor: empty, or a copy of the one you're on (rooms, inside doors and windows; no furniture)
  const ORD = ["Ground", "First", "Second", "Third", "Fourth", "Fifth"];
  const addFloor = (how: "copy" | "outline" | "empty") => {
    const copy = how === "copy";
    const lv = Math.max(...sk.floors.map((f) => f.level)) + 1;
    const name = lv < ORD.length ? `${ORD[lv]} floor` : `Level ${lv}`;
    const f: SketchFloor = copy
      ? { ...JSON.parse(JSON.stringify(floor)), name, level: lv, fixtures: [], doors: (floor.doors ?? []).filter((d) => d.rooms[1] && !OUTSIDE.test(d.rooms[1])) }
      : { ...blankFloor(lv), name, ...(how === "outline" ? { guide: floor.level } : {}) };
    commit({ ...sk, floors: [...sk.floors, f] });
    // the same picture underneath, lined up the same way, when copying
    if (copy && bgs[fi]) setBgs((b) => ({ ...b, [sk.floors.length]: { ...bgs[fi] } }));
    setFi(sk.floors.length);
    setSel(null);
    setWall(null);
    setAddingFloor(false);
    setNote(copy ? `${name} starts as a copy of ${floor.name || "the floor below"}. Rename and reshape the rooms, then add the stairs' doors and windows.`
      : how === "outline" ? `${floor.name || "The floor below"} shows underneath. Draw the rooms on top: their walls lock onto the walls below.` : null);
    if (how === "outline") setTool("pen");
  };
  // a rectangular room's size, changed by sliding its east or south wall (the room next door follows)
  const resize = (i: number, axis: 0 | 1, size: number) => {
    const r = floor.rooms[i], b = bboxOf(r.polygon);
    if (!(size >= 300)) return;
    const s: Seg = axis === 0 ? [[b[2], b[1]], [b[2], b[3]]] : [[b[0], b[3]], [b[2], b[3]]];
    setFloor({ ...floor, rooms: moveWall(floor.rooms, s, size - (b[axis + 2] - b[axis])) }, false);
  };
  const duplicate = (i: number) => {
    const r = floor.rooms[i], b = bboxOf(r.polygon), w = b[2] - b[0];
    setFloor({ ...floor, rooms: [...floor.rooms, { ...r, name: uniqueName(r.name), polygon: r.polygon.map(([x, y]) => [x + w, y] as Pt) }] });
    setSel({ t: "room", i: floor.rooms.length });
  };

  const snapLines = (skip?: number) => {
    const xs: number[] = [], ys: number[] = [];
    floor.rooms.forEach((r, i) => { if (i !== skip) for (const p of r.polygon) { xs.push(p[0]); ys.push(p[1]); } });
    for (const r of below?.rooms ?? []) for (const p of r.polygon) { xs.push(p[0]); ys.push(p[1]); }
    return { xs, ys };
  };
  const snapPt = (p: Pt, skip?: number): Pt => { const { xs, ys } = snapLines(skip); const g = px > 40 ? 12 * INCH : px < 8 ? INCH : 6 * INCH; return [snapTo(p[0], xs, 12 * px, g), snapTo(p[1], ys, 12 * px, g)]; };
  const snapCorner = (p: Pt): Pt => {
    let best = p, d = 14 * px;
    for (const r of [...floor.rooms, ...(below?.rooms ?? [])]) for (const q of r.polygon) if (dist(p, q) < d) { d = dist(p, q); best = q; }
    return best;
  };

  const roomAt = (p: Pt) => floor.rooms.map((r, i) => ({ r, i })).filter(({ r }) => pointInPoly(p, r.polygon)).sort((a, b) => roomArea(a.r) - roomArea(b.r))[0]?.i ?? -1;
  const thingAt = (p: Pt) => {
    const fx = floor.fixtures ?? [];
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], across = f.facing === "east" || f.facing === "west";
      const w = (across ? f.depth_mm : f.width_mm) ?? 600, d = (across ? f.width_mm : f.depth_mm) ?? 600;
      if (Math.abs(p[0] - f.center[0]) <= w / 2 && Math.abs(p[1] - f.center[1]) <= d / 2) return i;
    }
    return -1;
  };
  const doorSpots = useMemo(() => (floor.doors ?? []).map((d) => doorSpot(floor, d)), [floor]);
  const winSpots = useMemo(() => (floor.windows ?? []).map((w) => windowSpots(floor, w)), [floor]);

  const renameRoom = (f: SketchFloor, from: string, to: string): SketchFloor => {
    const same = (n?: string) => !!n && n.trim().toLowerCase() === from.trim().toLowerCase();
    return {
      ...f, rooms: f.rooms.map((r) => (same(r.name) ? { ...r, name: to } : r)),
      doors: (f.doors ?? []).map((d) => ({ ...d, rooms: d.rooms.map((n) => (same(n) ? to : n)) as [string, string] })),
      windows: (f.windows ?? []).map((w) => (same(w.room) ? { ...w, room: to } : w)),
      fixtures: (f.fixtures ?? []).map((x) => (same(x.room) ? { ...x, room: to } : x)),
    };
  };
  const uniqueName = (base: string) => { let n = base, k = 2; const all = new Set(sk.floors.flatMap((f) => f.rooms.map((r) => r.name.toLowerCase()))); while (all.has(n.toLowerCase())) n = `${base} ${k++}`; return n; };
  const facingFor = (c: Pt, ri: number): Side | undefined => {
    if (ri < 0) return undefined;
    const poly = floor.rooms[ri].polygon;
    const near = edgesOf(poly).map((s) => ({ s, d: nearSeg(c, s).d })).sort((a, b) => a.d - b.d)[0];
    return near ? OPP[sideOf(poly, near.s)] : undefined;
  };

  const deleteSel = () => {
    if (!sel) return;
    if (sel.t === "room") {
      const name = floor.rooms[sel.i].name.toLowerCase();
      setFloor({ ...floor, rooms: floor.rooms.filter((_, i) => i !== sel.i),
        doors: (floor.doors ?? []).filter((d) => !d.rooms.some((n) => n.toLowerCase() === name)),
        windows: (floor.windows ?? []).filter((w) => w.room.toLowerCase() !== name) });
      setWall(null);
    } else if (sel.t === "door") setFloor({ ...floor, doors: (floor.doors ?? []).filter((_, i) => i !== sel.i) });
    else if (sel.t === "window") setFloor({ ...floor, windows: (floor.windows ?? []).filter((_, i) => i !== sel.i) });
    else setFloor({ ...floor, fixtures: (floor.fixtures ?? []).filter((_, i) => i !== sel.i) });
    setSel(null);
  };

  // keys: the tool letters, Delete, Ctrl+Z
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && editable(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSel(); return; }
      // arrows nudge the picked room or thing: 100 mm, 10 mm with Shift
      const dir: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (dir[e.key] && (sel?.t === "room" || sel?.t === "thing")) {
        e.preventDefault();
        const st = e.shiftKey ? INCH / 2 : 6 * INCH, [dx, dy] = [dir[e.key][0] * st, dir[e.key][1] * st];
        if (sel.t === "room") setFloor({ ...floor, rooms: floor.rooms.map((r, i) => (i === sel.i ? { ...r, polygon: r.polygon.map(([x, y]) => [x + dx, y + dy] as Pt) } : r)) });
        else setFloor({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? { ...f, center: [f.center[0] + dx, f.center[1] + dy] as Pt } : f)) });
        return;
      }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) { setTool(t.id); setClicks([]); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEscape(() => { if (drag) setDrag(null); else if (clicks.length) setClicks([]); else if (sel) setSel(null); else if (wall) setWall(null); else setTool("select"); });

  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toMm(e);
    setNote(null);
    if (e.button === 1 || e.shiftKey && tool !== "room") { setDrag({ k: "pan", c: [e.clientX, e.clientY], v }); return; }
    if (tool === "select") {
      if (sel?.t === "room") {
        const poly = floor.rooms[sel.i].polygon;
        const vi = poly.findIndex((q) => dist(q, p) < 9 * px);
        if (vi >= 0) { past.current.push(sk); setDrag({ k: "corner", i: sel.i, v: vi, orig: poly }); return; }
        const es = edgesOf(poly);
        const ei = es.findIndex((s) => nearSeg(p, s).d < 7 * px && nearSeg(p, s).t > 0.08 && nearSeg(p, s).t < 0.92);
        if (ei >= 0) { setDrag({ k: "wall", s: es[ei], from: p, orig: floor.rooms, i: sel.i, e: ei, moved: false }); return; }
      }
      const ti = thingAt(p);
      if (ti >= 0) { setSel({ t: "thing", i: ti }); past.current.push(sk); setDrag({ k: "thing", i: ti, from: p, orig: floor.fixtures![ti].center }); return; }
      const di = doorSpots.findIndex((s) => s && nearSeg(p, s).d < 9 * px);
      if (di >= 0) { setSel({ t: "door", i: di }); return; }
      const wi = winSpots.findIndex((list) => list.some((s) => nearSeg(p, s).d < 9 * px));
      if (wi >= 0) { setSel({ t: "window", i: wi }); return; }
      const ri = roomAt(p);
      if (ri >= 0) { setSel({ t: "room", i: ri }); setDrag({ k: "move", i: ri, from: p, orig: floor.rooms[ri].polygon, moved: false }); return; }
      setSel(null);
      setDrag({ k: "pan", c: [e.clientX, e.clientY], v });
    } else if (tool === "room") {
      const a = snapPt(p);
      setDrag({ k: "newRoom", a, b: a });
    } else if (tool === "pen") {
      setDrag({ k: "pen", pts: [p] });
    } else if (tool === "split") {
      setDrag({ k: "split", a: p, b: p });
    } else if (tool === "picture") {
      if (bg) setDrag({ k: "picture", from: p, orig: bg.at });
    }
  };

  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toMm(e);
    if (drag.k === "pan") {
      const k = v.w / box.w;
      setView({ x: drag.v.x - (e.clientX - drag.c[0]) * k, y: drag.v.y - (e.clientY - drag.c[1]) * k, w: drag.v.w });
    } else if (drag.k === "newRoom") setDrag({ ...drag, b: snapPt(p) });
    else if (drag.k === "pen") { if (dist(p, drag.pts[drag.pts.length - 1]) > 3 * px) setDrag({ k: "pen", pts: [...drag.pts, p] }); }
    else if (drag.k === "split") setDrag({ ...drag, b: p });
    else if (drag.k === "move") {
      const raw: Pt = [p[0] - drag.from[0], p[1] - drag.from[1]];
      if (!drag.moved && Math.hypot(raw[0], raw[1]) < 4 * px) return;
      if (!drag.moved) { past.current.push(sk); setDrag({ ...drag, moved: true }); }
      // snap the moved room's corner nearest the pointer onto neighbouring walls
      const moved = drag.orig.map((q) => [q[0] + raw[0], q[1] + raw[1]] as Pt);
      const ref = moved.reduce((a, b) => (dist(a, p) < dist(b, p) ? a : b));
      const s = snapPt(ref, drag.i);
      const d: Pt = [s[0] - ref[0] + raw[0], s[1] - ref[1] + raw[1]];
      setFloor({ ...floor, rooms: floor.rooms.map((r, i) => (i === drag.i ? { ...r, polygon: drag.orig.map((q) => [r10(q[0] + d[0]), r10(q[1] + d[1])] as Pt) } : r)) }, false);
    } else if (drag.k === "corner") {
      const to = snapPt(p, drag.i);
      setFloor({ ...floor, rooms: floor.rooms.map((r, i) => (i === drag.i ? { ...r, polygon: moveCorner(drag.orig, drag.v, to) } : r)) }, false);
    } else if (drag.k === "wall") {
      if (!drag.moved && dist(p, drag.from) < 4 * px) return;
      if (!drag.moved) { past.current.push(sk); setDrag({ ...drag, moved: true }); }
      const h = Math.abs(drag.s[0][1] - drag.s[1][1]) < 1;
      const { xs, ys } = snapLines();
      const line = h ? drag.s[0][1] : drag.s[0][0];
      const want = (h ? p[1] - drag.from[1] : p[0] - drag.from[0]) + line;
      const others = (h ? ys : xs).filter((x) => Math.abs(x - line) > 1);
      const by = snapTo(want, others, 12 * px, 10) - line;
      setFloor({ ...floor, rooms: moveWall(drag.orig, drag.s, by) }, false);
    } else if (drag.k === "thing") {
      const c: Pt = [r10(drag.orig[0] + p[0] - drag.from[0]), r10(drag.orig[1] + p[1] - drag.from[1])];
      const f0 = (floor.fixtures ?? [])[drag.i], ri = roomAt(c);
      // slides along a wall it's dragged near, back to the wall
      const hug = f0 && ri >= 0 && CATALOG[f0.kind]?.mount !== "ceiling" ? hugWall(floor.rooms[ri].polygon, c, f0.width_mm ?? 600, f0.depth_mm ?? 600, 250) : null;
      setFloor({ ...floor, fixtures: (floor.fixtures ?? []).map((f, i) => (i === drag.i ? { ...f, center: hug?.center ?? c, ...(hug ? { facing: hug.facing } : {}), room: ri >= 0 ? floor.rooms[ri].name : f.room } : f)) }, false);
    } else if (drag.k === "picture" && bg) {
      setBgs({ ...bgs, [fi]: { ...bg, at: [drag.orig[0] + p[0] - drag.from[0], drag.orig[1] + p[1] - drag.from[1]] } });
    }
  };

  const up = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag;
    setDrag(null);
    const p = toMm(e);
    if (d?.k === "newRoom") {
      const [x0, x1] = [Math.min(d.a[0], d.b[0]), Math.max(d.a[0], d.b[0])], [y0, y1] = [Math.min(d.a[1], d.b[1]), Math.max(d.a[1], d.b[1])];
      if (x1 - x0 < 400 || y1 - y0 < 400) { setNote("Drag out a bigger box to make a room."); return; }
      const name = uniqueName(`Room ${floor.rooms.length + 1}`);
      const fit = trimOverlap([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], floor.rooms.map((r) => r.polygon));
      if (!fit) { setNote("That's on top of another room. Draw it next to it (or use Split room to divide a room)."); return; }
      setFloor({ ...floor, rooms: [...floor.rooms, { name, type: "other", polygon: fit }] });
      setSel({ t: "room", i: floor.rooms.length });
      return;
    }
    if (d?.k === "pen") {
      const poly = tidyStroke(d.pts, px < 8 ? INCH : 6 * INCH);
      if (!poly) { setNote("Draw the room's outline all the way round, like drawing a box on paper."); return; }
      const name = uniqueName(`Room ${floor.rooms.length + 1}`);
      // rooms never overlap: where it runs into a neighbour it stops at the neighbour's wall
      const fit = trimOverlap(poly.map((q) => snapCorner(snapPt(q))), floor.rooms.map((r) => r.polygon));
      if (!fit) { setNote("That's on top of another room. Draw it next to it (or use Split room to divide a room)."); return; }
      setFloor({ ...floor, rooms: [...floor.rooms, { name, type: "other", polygon: fit }] });
      setSel({ t: "room", i: floor.rooms.length });
      setNote(null);
      setTool("select");
      return;
    }
    if (d?.k === "split") {
      const ri = roomAt(d.a);
      const dx = Math.abs(d.b[0] - d.a[0]), dy = Math.abs(d.b[1] - d.a[1]);
      if (ri < 0 || Math.max(dx, dy) < 300) { setNote("Start the line inside the room and drag right across it."); return; }
      const axis = dx > dy ? "y" : "x";
      const { xs, ys } = snapLines();
      const at = axis === "y" ? snapTo((d.a[1] + d.b[1]) / 2, ys, 12 * px, 50) : snapTo((d.a[0] + d.b[0]) / 2, xs, 12 * px, 50);
      const r = floor.rooms[ri];
      const [A, B] = splitPoly(r.polygon, axis, at);
      if (A.length < 3 || B.length < 3) { setNote("That line doesn't cross the room."); return; }
      const second = { ...r, name: uniqueName(`${r.name} 2`), polygon: B };
      setFloor({ ...floor, rooms: [...floor.rooms.slice(0, ri), { ...r, polygon: A }, ...floor.rooms.slice(ri + 1), second] });
      setSel({ t: "room", i: floor.rooms.length });
      return;
    }
    // a click on a wall of the picked room opens it from the side
    if (d?.k === "wall" && !d.moved) { setWall({ room: d.i, edge: d.e }); return; }
    if (d) return;
    // single clicks
    if (tool === "door") {
      const w = wallAt(floor, p, 12 * px);
      if (!w) { setNote("Click right on a wall."); return; }
      const [a, b] = w.rooms;
      const door: SketchDoor = b == null ? { rooms: [floor.rooms[a].name, "outside"], side: w.side, at: Math.round(w.t * 100) / 100, kind: doorKind }
        : { rooms: [floor.rooms[a].name, floor.rooms[b].name], at: Math.round(w.t * 100) / 100, kind: doorKind };
      if (doorKind !== "door") door.width_mm = DOOR_W[doorKind];
      setFloor({ ...floor, doors: [...(floor.doors ?? []), door] });
      setSel({ t: "door", i: (floor.doors ?? []).length });
    } else if (tool === "balcony") {
      // open that wall from the side and add it there, where it can be dragged into place
      const w = wallAt(floor, p, 12 * px);
      if (!w) { setNote("Click right on an outside wall."); return; }
      if (w.rooms[1] != null) { setNote("A balcony goes on an outside wall. That wall is between two rooms."); return; }
      const poly = floor.rooms[w.rooms[0]].polygon;
      const edge = edgesOf(poly).map((s, k) => ({ k, d: nearSeg(p, s).d })).sort((x, y) => x.d - y.d)[0].k;
      setSel({ t: "room", i: w.rooms[0] });
      setWallAdd("balcony");
      setWall({ room: w.rooms[0], edge });
      setTool("select");
    } else if (tool === "window") {
      const w = wallAt(floor, p, 12 * px);
      if (!w) { setNote("Click right on an outside wall."); return; }
      if (w.rooms[1] != null) { setNote("Windows go on outside walls. That wall is between two rooms."); return; }
      const room = floor.rooms[w.rooms[0]].name;
      const list = floor.windows ?? [];
      const at = list.findIndex((x) => x.room.toLowerCase() === room.toLowerCase() && x.side === w.side);
      if (at >= 0) {
        setFloor({ ...floor, windows: list.map((x, i) => (i === at ? { ...x, count: Math.min(4, (x.count ?? 1) + 1) } : x)) });
        setSel({ t: "window", i: at });
      } else {
        setFloor({ ...floor, windows: [...list, { room, side: w.side, count: 1 }] });
        setSel({ t: "window", i: list.length });
      }
    } else if (tool === "thing") {
      const spec = CATALOG[thing];
      const ri = roomAt(p);
      const c: Pt = [r10(p[0]), r10(p[1])];
      const w = spec?.w ?? 600, dp = spec?.d ?? 600;
      // against a wall when it's put near one: back flat to the wall, facing the room
      const hug = ri >= 0 && spec?.mount !== "ceiling" ? hugWall(floor.rooms[ri].polygon, c, w, dp, 600) : null;
      const fx = { kind: thing, name: spec?.label, room: ri >= 0 ? floor.rooms[ri].name : undefined, center: hug?.center ?? c, width_mm: w, depth_mm: dp, facing: hug?.facing ?? facingFor(c, ri) };
      setFloor({ ...floor, fixtures: [...(floor.fixtures ?? []), fx] });
      setSel({ t: "thing", i: (floor.fixtures ?? []).length });
    } else if (tool === "scale") {
      setClicks((c) => (c.length >= 2 ? [p] : [...c, p]));
    } else if (tool === "match") {
      // picture corner, then the room corner it belongs on, twice
      const q = clicks.length % 2 === 1 ? snapCorner(p) : p;
      const next = [...clicks, q];
      if (next.length === 4 && bg) {
        const [p1, q1, p2, q2] = next;
        const k = dist(q1, q2) / Math.max(1, dist(p1, p2));
        setBgs({ ...bgs, [fi]: { ...bg, mmPerPx: bg.mmPerPx * k, at: [q1[0] - (p1[0] - bg.at[0]) * k, q1[1] - (p1[1] - bg.at[1]) * k] } });
        setClicks([]);
        setNote("Lined up. Check a few walls; do it again with two other corners if it's still off.");
      } else setClicks(next);
    }
  };

  const applyScale = (everything: boolean) => {
    const real = parseLength(lengthText, lu);
    if (clicks.length < 2 || !real) { setNote("Type the length, like 12' 6\" or 150 in."); return; }
    const k = real / Math.max(1, dist(clicks[0], clicks[1]));
    const o = clicks[0];
    const sc = (q: Pt): Pt => [r10(o[0] + (q[0] - o[0]) * k), r10(o[1] + (q[1] - o[1]) * k)];
    if (bg) setBgs({ ...bgs, [fi]: { ...bg, mmPerPx: bg.mmPerPx * k, at: [o[0] + (bg.at[0] - o[0]) * k, o[1] + (bg.at[1] - o[1]) * k] } });
    if (everything) {
      setFloor({ ...floor, rooms: floor.rooms.map((r) => ({ ...r, polygon: r.polygon.map(sc) })),
        fixtures: (floor.fixtures ?? []).map((f) => ({ ...f, center: sc(f.center) })) });
    }
    setClicks([]);
    setLengthText("");
    setView((cur) => cur && { x: o[0] + (cur.x - o[0]) * k, y: o[1] + (cur.y - o[1]) * k, w: cur.w * k });
    setNote(everything ? "Scaled the rooms and the picture." : "Picture scaled. Now draw rooms over it.");
    if (!floor.rooms.length) setTool("pen");
  };

  // the panel's edits
  const room = sel?.t === "room" ? floor.rooms[sel.i] : null;
  const door = sel?.t === "door" ? floor.doors?.[sel.i] : null;
  const win = sel?.t === "window" ? floor.windows?.[sel.i] : null;
  const fix = sel?.t === "thing" ? floor.fixtures?.[sel.i] : null;
  const units = [...new Set(sk.floors.flatMap((f) => f.rooms.map((r) => r.unit).filter(Boolean) as string[]))];
  const fontMm = Math.max(120, 12 * px);
  const seen = wall && floor.rooms[wall.room] && wall.edge < floor.rooms[wall.room].polygon.length ? wall : null;
  const allRooms = sk.floors.reduce((n, f) => n + f.rooms.length, 0);

  const done = () => {
    const units = [...new Set(sk.floors.flatMap((f) => f.rooms.map((r) => r.unit).filter(Boolean) as string[]))];
    try { localStorage.removeItem(DRAFT); } catch { /* nothing kept */ }
    onDone({ ...sk, units: units.length > 1 ? units.map((name) => ({ name })) : undefined }, bgs);
  };

  return (
    <section className="card overflow-hidden" aria-label="Draw the plan">
      {draft && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-line bg-panel text-[13px]">
          <span>You have a drawing from {new Date(draft.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} that wasn&apos;t finished.</span>
          <button className="btn btn-sm btn-primary" onClick={() => { commit(draft.sk); setFi(0); setDraft(null); setTool("select"); setView(null); }}>Pick up where I left off</button>
          <button className="btn btn-sm btn-ghost" onClick={() => { try { localStorage.removeItem(DRAFT); } catch { /* nothing kept */ } setDraft(null); }}>Start fresh</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-line bg-panel">
        {TOOLS.filter((t) => !t.menu && !t.more).flatMap((t) => [
          <button key={t.id} onClick={() => { setTool(t.id); setClicks([]); }} title={`${t.label} (${t.key.toUpperCase()})`}
            className={`btn btn-sm ${tool === t.id ? "btn-primary" : "btn-ghost"}`}>{t.label}</button>,
          // doors, windows and balconies in one menu, after Split room
          ...(t.id === "pen" ? [
            <select key="openings" aria-label="Doors and windows" title="Pick one, then click a wall"
              className={`btn btn-sm !pr-2 ${TOOLS.find((x) => x.id === tool)?.menu ? "btn-primary" : "btn-ghost"}`}
              value={tool === "door" ? doorKind : tool === "window" || tool === "balcony" ? tool : ""}
              onChange={(e) => { const v = e.target.value; setClicks([]); if (v === "window" || v === "balcony") setTool(v); else if (v) { setDoorKind(v as NonNullable<SketchDoor["kind"]>); setTool("door"); } }}>
              <option value="" disabled>Doors & windows</option>
              {OPENINGS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>,
          ] : []),
        ])}
        <select aria-label="More tools" className={`btn btn-sm !pr-2 ${TOOLS.find((x) => x.id === tool)?.more ? "btn-primary" : "btn-ghost"}`}
          value={TOOLS.find((x) => x.id === tool)?.more ? tool : ""} onChange={(e) => { setTool(e.target.value as Tool); setClicks([]); }}>
          <option value="" disabled>More</option>
          {TOOLS.filter((t) => t.more && (pictures.length || !t.picture)).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="mx-1 h-5 w-px bg-line" />
        <button className="btn btn-sm btn-ghost" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)">Undo</button>
        <button className="btn btn-sm btn-ghost" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)">Redo</button>
        <button className="btn btn-sm btn-ghost" onClick={saveNow} title="Saved in this browser as you go">{savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Save"}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => zoom(0.75)} aria-label="Zoom in">+</button>
        <button className="btn btn-sm btn-ghost" onClick={() => zoom(1.33)} aria-label="Zoom out">−</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setView(fitView())}>Fit</button>
        <button className={`btn btn-sm ml-auto ${show3d ? "btn-primary" : "btn-ghost"}`} onClick={() => setShow3d((x) => !x)} title="See the house in 3D as you draw">3D</button>
        <button className={`btn btn-sm ${showStd ? "btn-primary" : "btn-ghost"}`} onClick={() => setShowStd((x) => !x)} title="Your default sizes and the limits the checks use">Standards</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b border-line text-[13px]">
        {sk.floors.map((f, i) => (
          <button key={i} onClick={() => { setFi(i); setSel(null); setClicks([]); setWall(null); }} className={`chip !h-7 ${i === fi ? "!text-accent !border-accent" : ""}`}>{f.name || `Level ${f.level}`} · {f.rooms.length}</button>
        ))}
        {addingFloor ? (
          <>
            <button className="chip !h-7 !text-accent !border-accent" onClick={() => addFloor("copy")} disabled={!floor.rooms.length} title="Same rooms, doors and windows">Copy {floor.name || "this floor"}</button>
            <button className="chip !h-7" onClick={() => addFloor("outline")} disabled={!floor.rooms.length} title="Draw new rooms on top of this floor's walls">Same outline</button>
            <button className="chip !h-7" onClick={() => addFloor("empty")}>Start empty</button>
            <button className="chip !h-7" onClick={() => setAddingFloor(false)} aria-label="Cancel">✕</button>
          </>
        ) : <button className="chip !h-7" onClick={() => (floor.rooms.length ? setAddingFloor(true) : addFloor("empty"))}>+ Floor</button>}
        {floor.level > 0 && !addingFloor && sk.floors.some((f) => f.level < floor.level) && (
          <button className={`chip !h-7 ${below ? "!text-accent !border-accent" : ""}`} title="Show the floor underneath and lock rooms onto its walls"
            onClick={() => setFloor({ ...floor, guide: below ? undefined : Math.max(...sk.floors.filter((f) => f.level < floor.level).map((f) => f.level)) })}>Floor below</button>
        )}
        <span className="ml-auto text-muted">{allRooms} rooms</span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
        <div className={show3d ? "grid xl:grid-cols-2" : ""}>
        <div className={`relative ${seen ? "h-[42vh] min-h-[300px]" : "h-[62vh] min-h-[420px]"} bg-ink`}>
          <svg ref={svg} className="absolute inset-0 w-full h-full touch-none select-none" viewBox={`${v.x} ${v.y} ${v.w} ${vh}`}
            style={{ cursor: drag?.k === "pan" ? "grabbing" : tool === "select" ? "default" : tool === "picture" ? "move" : "crosshair" }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)} onContextMenu={(e) => e.preventDefault()}>
            {bg && sizes[bg.pic] && (
              <image href={pictures[bg.pic].url} x={bg.at[0]} y={bg.at[1]} width={sizes[bg.pic][0] * bg.mmPerPx} height={sizes[bg.pic][1] * bg.mmPerPx} opacity={bg.opacity} preserveAspectRatio="none" style={{ pointerEvents: "none" }} />
            )}
            {below && (
              <g style={{ pointerEvents: "none" }} fill="none">
                {below.rooms.map((r, i) => <polygon key={`b${i}`} points={r.polygon.map((q) => q.join(",")).join(" ")} stroke="#6e6a62" strokeWidth={1.2 * px} strokeDasharray={`${6 * px} ${5 * px}`} />)}
                {belowOutline.map((s, i) => <line key={`bo${i}`} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke="#9c978d" strokeWidth={3 * px} strokeOpacity={0.7} />)}
              </g>
            )}
            {floor.rooms.map((r, i) => {
              const c = centroid(r.polygon);
              const on = sel?.t === "room" && sel.i === i;
              const color = MATERIAL_BASE[ROOM_MATERIAL[(r.type ?? "other") as keyof typeof ROOM_MATERIAL] ?? "concrete"];
              return (
                <g key={i}>
                  <polygon points={r.polygon.map((q) => q.join(",")).join(" ")} fill={color} fillOpacity={bg ? 0.35 : 0.75} stroke={on ? "#ff6a1f" : "#efe8da"} strokeWidth={(on ? 3 : 2) * px} />
                  <text x={c[0]} y={c[1]} fontSize={fontMm} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="#000" strokeWidth={fontMm * 0.18} paintOrder="stroke" style={{ pointerEvents: "none" }}>{r.name}</text>
                  <text x={c[0]} y={c[1] + fontMm * 1.2} fontSize={fontMm * 0.8} textAnchor="middle" dominantBaseline="middle" fill="#ddd" stroke="#000" strokeWidth={fontMm * 0.14} paintOrder="stroke" style={{ pointerEvents: "none" }}>{fmtArea(roomArea(r), lu)}</text>
                </g>
              );
            })}
            {(floor.fixtures ?? []).map((f, i) => {
              const across = f.facing === "east" || f.facing === "west";
              const w = (across ? f.depth_mm : f.width_mm) ?? 600, d = (across ? f.width_mm : f.depth_mm) ?? 600;
              const on = sel?.t === "thing" && sel.i === i;
              const [cx, cy] = f.center;
              const tip: Pt = f.facing === "north" ? [cx, cy - d / 2] : f.facing === "south" ? [cx, cy + d / 2] : f.facing === "east" ? [cx + w / 2, cy] : f.facing === "west" ? [cx - w / 2, cy] : [cx, cy];
              return (
                <g key={i}>
                  <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#f4efe6" fillOpacity={0.85} stroke={on ? "#ff6a1f" : "#17181b"} strokeWidth={(on ? 3 : 1.5) * px} />
                  {f.facing && <line x1={cx} y1={cy} x2={tip[0]} y2={tip[1]} stroke="#ff6a1f" strokeWidth={2 * px} />}
                  {Math.min(w, d) / px > 26 && <text x={cx} y={cy} fontSize={fontMm * 0.7} textAnchor="middle" dominantBaseline="middle" fill="#17181b" style={{ pointerEvents: "none" }}>{(CATALOG[f.kind]?.label ?? f.kind).split(" ")[0]}</text>}
                </g>
              );
            })}
            {doorSpots.map((s, i) => s && <line key={`d${i}`} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={sel?.t === "door" && sel.i === i ? "#fff" : "#ff6a1f"} strokeWidth={7 * px} strokeLinecap="butt" />)}
            {winSpots.map((list, i) => list.map((s, k) => <line key={`w${i}-${k}`} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={sel?.t === "window" && sel.i === i ? "#fff" : "#8fd3f0"} strokeWidth={6 * px} />))}
            {room && room.polygon.map((q, k) => <rect key={k} x={q[0] - 5 * px} y={q[1] - 5 * px} width={10 * px} height={10 * px} fill="#ff6a1f" stroke="#fff" strokeWidth={px} />)}
            {room && edgesOf(room.polygon).map((s, k) => <circle key={`m${k}`} cx={(s[0][0] + s[1][0]) / 2} cy={(s[0][1] + s[1][1]) / 2} r={4 * px} fill="#fff" stroke="#ff6a1f" strokeWidth={1.5 * px} />)}
            {drag?.k === "pen" && <polyline points={drag.pts.map((q) => q.join(",")).join(" ")} fill="none" stroke="#ff6a1f" strokeWidth={2.5 * px} strokeLinejoin="round" strokeLinecap="round" />}
            {drag?.k === "newRoom" && <rect x={Math.min(drag.a[0], drag.b[0])} y={Math.min(drag.a[1], drag.b[1])} width={Math.abs(drag.b[0] - drag.a[0])} height={Math.abs(drag.b[1] - drag.a[1])} fill="#ff6a1f" fillOpacity={0.2} stroke="#ff6a1f" strokeWidth={2 * px} />}
            {drag?.k === "newRoom" && <text x={Math.max(drag.a[0], drag.b[0])} y={Math.max(drag.a[1], drag.b[1]) + fontMm} fontSize={fontMm} fill="#ff6a1f" textAnchor="end">{fmtLen(Math.abs(drag.b[0] - drag.a[0]), lu, true)} × {fmtLen(Math.abs(drag.b[1] - drag.a[1]), lu)}</text>}
            {drag?.k === "split" && <line x1={drag.a[0]} y1={drag.a[1]} x2={drag.b[0]} y2={drag.b[1]} stroke="#ff6a1f" strokeWidth={2 * px} strokeDasharray={`${6 * px} ${4 * px}`} />}
            {clicks.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r={6 * px} fill={tool === "match" && i % 2 === 1 ? "#3fb46a" : "#ff6a1f"} stroke="#fff" strokeWidth={1.5 * px} />)}
            {tool === "scale" && clicks.length === 2 && <line x1={clicks[0][0]} y1={clicks[0][1]} x2={clicks[1][0]} y2={clicks[1][1]} stroke="#ff6a1f" strokeWidth={2 * px} />}
            {/* the picked room's wall lengths, and the wall being looked at */}
            {room && edgesOf(room.polygon).map((s, k) => {
              const c = centroid(room.polygon), mx = (s[0][0] + s[1][0]) / 2, my = (s[0][1] + s[1][1]) / 2;
              const d = Math.hypot(c[0] - mx, c[1] - my) || 1, off = fontMm * 1.1;
              return <text key={`len${k}`} x={mx + ((c[0] - mx) / d) * off} y={my + ((c[1] - my) / d) * off} fontSize={fontMm * 0.8} textAnchor="middle" dominantBaseline="middle" fill="#ff6a1f" stroke="#000" strokeWidth={fontMm * 0.12} paintOrder="stroke" style={{ pointerEvents: "none" }}>{fmtLen(Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]), lu, true)}</text>;
            })}
            {seen && (() => { const [a, b] = edgesOf(floor.rooms[seen.room].polygon)[seen.edge]; return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ff6a1f" strokeWidth={6 * px} strokeOpacity={0.8} style={{ pointerEvents: "none" }} />; })()}
          </svg>
          {!floor.rooms.length && !bg && (
            <p className="absolute inset-x-0 top-1/3 text-center text-muted text-[14px] pointer-events-none px-6">Pick Walls and draw around the first room. Rooms that touch share a wall.</p>
          )}
        </div>
        {show3d && (
          <div className="h-[44vh] xl:h-auto">
            <Live3D sketch={sk} fi={fi} sel={sel?.t === "room" || sel?.t === "thing" ? { t: sel.t, i: sel.i } : null} walls={walls3d} onWalls={setWalls3d}
              onPick={(f, s) => { if (f !== fi) { setFi(f); setClicks([]); setWall(null); } setSel(s); }}
              onFloor={(i) => { setFi(i); setSel(null); setClicks([]); setWall(null); }} roofOn={showRoof} onRoof={() => { setShowRoof((x) => !x); setShowStd(false); }} />
          </div>
        )}
        </div>
        {seen && <WallView key={`${seen.room}-${seen.edge}`} floor={floor} room={seen.room} edge={seen.edge} height={floor.height_mm ?? std("house.ceiling")} units={lu} addOnOpen={wallAdd} onAdded={() => setWallAdd(null)} onChange={(f, h) => setFloor(f, h ?? true)} onClose={() => setWall(null)} onEdge={(edge) => setWall({ room: seen.room, edge })} />}
        </div>

        <aside className="border-t lg:border-t-0 lg:border-l border-line p-3 space-y-3 text-[13.5px] max-h-[62vh] overflow-y-auto scroll-thin">
          {showStd ? <StandardsPanel units={lu} onClose={() => setShowStd(false)} />
            : showRoof ? <RoofPanel sketch={sk} units={lu} onChange={(s, h) => (h === false ? setSk(s) : commit(s))} onClose={() => setShowRoof(false)} /> : <>
          <p className="text-muted leading-snug">{TOOLS.find((t) => t.id === tool)?.help}</p>
          {note && <p className="text-amber">{note}</p>}

          {tool === "thing" && (
            <div className="space-y-2">
              {THINGS.map((g) => (
                <div key={g.group}>
                  <p className="label !mb-1">{g.group}</p>
                  <div className="flex flex-wrap gap-1">{g.kinds.filter((k) => CATALOG[k]).map((k) => <button key={k} onClick={() => setThing(k)} className={`chip !h-7 ${thing === k ? "!text-accent !border-accent" : ""}`}>{CATALOG[k].label}</button>)}</div>
                </div>
              ))}
            </div>
          )}

          {tool === "scale" && clicks.length === 2 && (
            <div className="space-y-2">
              <label className="label" htmlFor="len">How long is that?</label>
              <input id="len" autoFocus className="input !h-9" value={lengthText} onChange={(e) => setLengthText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyScale(floor.rooms.length > 0); }} placeholder={"e.g. 12' 6\", 150 in or 3.6 m"} />
              <div className="flex gap-2">
                <button className="btn btn-sm btn-primary flex-1" onClick={() => applyScale(floor.rooms.length > 0)}>{floor.rooms.length ? "Scale everything" : "Set the scale"}</button>
                {floor.rooms.length > 0 && bg && <button className="btn btn-sm btn-ghost" onClick={() => applyScale(false)}>Picture only</button>}
              </div>
            </div>
          )}
          {tool === "match" && <p className="text-[13px]">{["Click a corner on the picture.", "Now click the room corner it belongs on.", "Click a second corner on the picture, far from the first.", "And the room corner for that one."][clicks.length]}</p>}

          {room && sel && (
            <div className="space-y-2">
              <p className="eyebrow">Room</p>
              <input className="input !h-9" value={room.name} aria-label="Room name"
                onChange={(e) => setFloor(renameRoom(floor, room.name, e.target.value), false)} onFocus={() => past.current.push(sk)} />
              <select className="input !h-9" value={room.type ?? "other"} aria-label="Room type" onChange={(e) => setFloor({ ...floor, rooms: floor.rooms.map((r, i) => (i === sel.i ? { ...r, type: e.target.value } : r)) })}>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
              <div>
                <label className="label !mb-1" htmlFor="unit">Home (for a drawing of several homes)</label>
                <input id="unit" className="input !h-9" list="units" value={room.unit ?? ""} placeholder="e.g. Unit 1, or leave empty"
                  onChange={(e) => setFloor({ ...floor, rooms: floor.rooms.map((r, i) => (i === sel.i ? { ...r, unit: e.target.value || undefined } : r)) }, false)} onFocus={() => past.current.push(sk)} />
                <datalist id="units">{units.map((u) => <option key={u} value={u} />)}</datalist>
              </div>
              {(() => {
                const b = bboxOf(room.polygon), rect = room.polygon.length === 4;
                return rect ? (
                  <div className="grid grid-cols-2 gap-2">
                    {([0, 1] as const).map((ax) => (
                      <div key={ax}><label className="label !mb-1" htmlFor={`size${ax}`}>{ax === 0 ? "Width (east–west)" : "Depth (north–south)"}</label>
                        <input id={`size${ax}`} key={`${sel.i}-${ax}-${b[ax + 2] - b[ax]}-${lu}`} className="input !h-9" defaultValue={fmtLen(b[ax + 2] - b[ax], lu, true)}
                          onFocus={() => past.current.push(sk)} onBlur={(e) => { const v = parseLength(e.target.value, lu); if (v) resize(sel.i, ax, roundLen(v, lu)); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></div>
                    ))}
                  </div>
                ) : null;
              })()}
              <p className="text-muted">{fmtArea(roomArea(room), lu)} · {(() => { const b = bboxOf(room.polygon); return `${fmtLen(b[2] - b[0], lu, true)} × ${fmtLen(b[3] - b[1], lu)}`; })()}</p>
              <div>
                <p className="label !mb-1">See a wall from the side</p>
                <div className="flex flex-wrap gap-1">{edgesOf(room.polygon).map((s, k) => (
                  <button key={k} onClick={() => setWall({ room: sel.i, edge: k })} className={`chip !h-7 ${seen?.room === sel.i && seen.edge === k ? "!text-accent !border-accent" : ""}`}>{sideOf(room.polygon, s)} · {fmtLen(Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]), lu)}</button>
                ))}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => duplicate(sel.i)}>Duplicate</button>
                <button className="btn btn-sm btn-ghost text-red" onClick={deleteSel}>Delete room</button>
              </div>
            </div>
          )}
          {door && sel && (
            <div className="space-y-2">
              <p className="eyebrow">Door</p>
              <p>{door.rooms[0]} ↔ {door.rooms[1]}{door.side ? ` (${door.side} side)` : ""}</p>
              <select className="input !h-9" value={door.kind ?? "door"} aria-label="Kind of door" onChange={(e) => setFloor({ ...floor, doors: floor.doors!.map((d, i) => (i === sel.i ? { ...d, kind: e.target.value as typeof d.kind } : d)) })}>
                {DOOR_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <label className="label !mb-1">Where along the wall</label>
              <input type="range" min={0} max={1} step={0.01} className="w-full" value={door.at ?? 0.5} onPointerDown={() => past.current.push(sk)}
                onChange={(e) => setFloor({ ...floor, doors: floor.doors!.map((d, i) => (i === sel.i ? { ...d, at: +e.target.value } : d)) }, false)} />
              <button className="btn btn-sm btn-ghost text-red" onClick={deleteSel}>Delete door</button>
            </div>
          )}
          {win && sel && (
            <div className="space-y-2">
              <p className="eyebrow">Windows</p>
              <p>{win.room}, {win.side} side</p>
              <div className="flex items-center gap-2">
                <span className="text-muted">How many</span>
                {[1, 2, 3, 4].map((n) => <button key={n} onClick={() => setFloor({ ...floor, windows: floor.windows!.map((w, i) => (i === sel.i ? { ...w, count: n } : w)) })} className={`chip !h-7 ${(win.count ?? 1) === n ? "!text-accent !border-accent" : ""}`}>{n}</button>)}
              </div>
              <button className="btn btn-sm btn-ghost text-red" onClick={deleteSel}>Delete windows</button>
            </div>
          )}
          {fix && sel && (
            <div className="space-y-2">
              <p className="eyebrow">{CATALOG[fix.kind]?.label ?? fix.kind}</p>
              <select className="input !h-9" value={fix.kind} aria-label="What it is" onChange={(e) => { const s = CATALOG[e.target.value]; setFloor({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? { ...f, kind: e.target.value, name: s?.label, width_mm: s?.w ?? f.width_mm, depth_mm: s?.d ?? f.depth_mm } : f)) }); }}>
                {THINGS.flatMap((g) => g.kinds).filter((k) => CATALOG[k]).map((k) => <option key={k} value={k}>{CATALOG[k].label}</option>)}
                {!THINGS.some((g) => g.kinds.includes(fix.kind)) && <option value={fix.kind}>{CATALOG[fix.kind]?.label ?? fix.kind}</option>}
              </select>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-muted">Faces</span>
                {SIDES.map((s) => <button key={s} onClick={() => setFloor({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? { ...f, facing: s } : f)) })} className={`chip !h-7 ${fix.facing === s ? "!text-accent !border-accent" : ""}`}>{s}</button>)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["width_mm", "depth_mm"] as const).map((k) => (
                  <div key={k}><label className="label !mb-1">{k === "width_mm" ? "Width mm" : "Depth mm"}</label>
                    <input type="number" className="input !h-9" value={fix[k] ?? ""} onFocus={() => past.current.push(sk)} onChange={(e) => setFloor({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? { ...f, [k]: +e.target.value || undefined } : f)) }, false)} /></div>
                ))}
              </div>
              <button className="btn btn-sm btn-ghost text-red" onClick={deleteSel}>Delete</button>
            </div>
          )}

          {!sel && (
            <div className="space-y-2 pt-1 border-t border-line">
              <p className="eyebrow pt-2">This floor</p>
              <input className="input !h-9" value={floor.name ?? ""} aria-label="Floor name" onFocus={() => past.current.push(sk)} onChange={(e) => setFloor({ ...floor, name: e.target.value }, false)} />
              <div className="flex items-center gap-2">
                <span className="text-muted">Level</span>
                <input type="number" className="input !h-9 !w-20" value={floor.level} onChange={(e) => setFloor({ ...floor, level: Math.round(+e.target.value) })} aria-label="Level (0 is the ground floor)" />
                {sk.floors.length > 1 && <button className="btn btn-sm btn-ghost text-red ml-auto" onClick={() => { commit({ ...sk, floors: sk.floors.filter((_, i) => i !== fi) }); setFi(0); }}>Delete floor</button>}
              </div>
              {(() => {
                const h = floor.height_mm ?? std("house.ceiling");
                return (
                  <div className="flex items-center gap-2">
                    <label className="text-muted" htmlFor="ceiling">Ceiling height</label>
                    <input id="ceiling" key={`ceiling-${fi}-${h}`} className={`input !h-9 !w-24 font-mono ${floor.height_mm ? "!border-accent" : ""}`} defaultValue={fmtLen(h, lu)}
                      onBlur={(e) => { const v = parseLength(e.target.value, lu); if (v && v >= 1800 && v <= 6000) setFloor({ ...floor, height_mm: roundLen(v, lu) }); else e.target.value = fmtLen(h, lu); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    {floor.height_mm != null && <button className="text-[12px] text-muted underline" onClick={() => setFloor({ ...floor, height_mm: undefined })}>Use my standard</button>}
                  </div>
                );
              })()}
            </div>
          )}
          {!sel && (
            <div className="pt-3 border-t border-line">
              <RoofPanel sketch={sk} units={lu} onChange={(s, h) => (h === false ? setSk(s) : commit(s))} />
            </div>
          )}
          {bg && !sel && (
            <div className="space-y-2 pt-1 border-t border-line">
              <p className="eyebrow pt-2">Picture underneath</p>
              {pictures.length > 1 && (
                <select className="input !h-9" value={bg.pic} aria-label="Which picture" onChange={(e) => setBgs({ ...bgs, [fi]: { ...bg, pic: +e.target.value } })}>
                  {pictures.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
                </select>
              )}
              <label className="label !mb-1">See-through</label>
              <input type="range" min={0} max={1} step={0.05} className="w-full" value={bg.opacity} onChange={(e) => setBgs({ ...bgs, [fi]: { ...bg, opacity: +e.target.value } })} aria-label="Picture opacity" />
            </div>
          )}
          </>}
        </aside>
      </div>
      <div className="flex gap-2 px-3 py-2 border-t border-line bg-panel">
        <button className="btn btn-primary flex-1" onClick={done} disabled={!allRooms}>{doneLabel}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
