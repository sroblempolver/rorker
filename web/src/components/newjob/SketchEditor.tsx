"use client";
// Draw the plan yourself, or fix what the plan reader got wrong: the uploaded drawing sits underneath,
// and simple tools trace over it. Rooms are rectangles you drag out (then drag a corner or a wall to
// reshape), a room can be cut in two, doors go on the wall between two rooms (or an outside wall),
// windows on outside walls, and things (a sink, a bed) are dropped where they are. Scale comes from one
// length you know. The result is the same sketch the reader makes, so the plan is built the same way.
import { nextQuestion, stagesFromSpec, type BuildSpec } from "@/lib/plan/buildSpec";
import { BuildQuestions } from "./BuildQuestions";
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Pt } from "@/lib/plan/types";
import type { Side, Sketch, SketchDoor, SketchFloor } from "@/lib/plan/sketch";
import { OUTSIDE, doorSpot, hugWall, trimOverlap, outsidePieces, edgesOf, flatten, moveCorner, nearSeg, pointInPoly, roomArea, sideOf, snapTo, splitPoly, wallAt, windowSpots, type Seg } from "@/lib/plan/sketchEdit";
import { bboxOf, centroid } from "@/lib/plan/geometry";
import { CATALOG } from "@/lib/plan/catalog";
import { MATERIAL_BASE, ROOM_MATERIAL } from "@/components/plan/style";
import { useEscape, editable } from "@/components/ui/hotkeys";
import { DOOR_W, WallView } from "./WallView";
import { tidyStroke } from "@/lib/plan/pen";
import { INCH, fmtArea, fmtLen, parseLength, roundLen, type Units } from "@/lib/plan/units";
import type { IntakePart } from "@/lib/intake/files";
import { StandardsPanel } from "./StandardsPanel";
import { CabinetEdit, CabinetPanel } from "./CabinetPanel";
import { DEFAULT_PICK, addHood, cabinetClick, faceOf, fitOnFace, fixtureAt, placeOnFace, slideCabinet, type CabPick, type FitAsk } from "@/lib/plan/cabinetLayout";
import { plumbingPoints } from "@/lib/plan/plumbing";
import { cabCode, defaults } from "@/lib/plan/cabinets";
import { Live3D, type Walls } from "./Live3D";
import { RoofPanel } from "./RoofPanel";
import { std, useStandards } from "@/lib/plan/standards";
import { halfSize, moveRoom, outward, pushWall, turnRoom, turnSide } from "@/lib/plan/roomEdit";
import { cleanOutline, cornerAt, nextCorner } from "@/lib/plan/corners";
import { itemLabel, tabForRoom, type TrayItem } from "@/lib/plan/tray";
import { CatalogTray, TRAY_DRAG, openTrayAt } from "./CatalogTray";
import { StairHole, StairPanel, StairSymbol, onStair } from "./StairPlan";
import { ChecksPanel, NUDGE_COLOR } from "./ChecksPanel";
import { floorBelow, floorRise, newStair, stairGeom } from "@/lib/plan/stairs";
import { runChecks, type Nudge } from "@/lib/plan/checks";
import { chain, dropLooseRoom, followWall, isJoined, isOutside, joinRoom, moveEnd, onOutline, onWall, refit, separateRoom, shiftWall, snapEnd, wallThickness } from "@/lib/plan/walls";
import { isClosedStroke, tidyLine } from "@/lib/plan/pen";
import type { SketchWall } from "@/lib/plan/sketch";
import { WallPanel } from "./WallPanel";
import { WallPieces } from "./WallPieces";
import { ItemBadge, badgeSpot } from "@/components/plan/ItemBadge";
import { isNumbered, itemNumbers, stampNumbers } from "@/lib/plan/numbers";
import { MarkLayer, useSuggest, type ViewAs } from "./SuggestPanel";
import { LibraryPanel, usePlacing } from "./LibraryPanel";
import { HomesPanel } from "./HomesPanel";
import { TradePanel } from "./TradePanel";
import { checksFirst, toolOrder, tradeOf } from "@/lib/plan/trades";
import { pieceOf, placePiece, saveToLibrary } from "@/lib/plan/library";

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
// every kind in the catalogue, by name, for changing what a placed thing is
const ALL_KINDS = Object.keys(CATALOG).sort((a, b) => CATALOG[a].label.localeCompare(CATALOG[b].label));
const DOOR_KINDS = [["door", "Door"], ["double_door", "Double door"], ["sliding_door", "Sliding door"], ["garage_door", "Garage door"], ["opening", "Open passage"]] as const;
const SIDES: Side[] = ["north", "east", "south", "west"];
const OPP: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

const ANGLE_OF: Record<Side, number> = { east: 0, south: 90, west: 180, north: -90 };
/** The room a thing is in, by name: the one it names, else the one its centre is in. */
function roomOfThing(f: SketchFloor, x: { room?: string; center: Pt }) {
  return (x.room ?? f.rooms.find((r) => pointInPoly(x.center, r.polygon))?.name ?? "").toLowerCase() || null;
}
type Tool = "select" | "room" | "pen" | "corners" | "split" | "door" | "window" | "balcony" | "thing" | "cabinet" | "eyedrop" | "remove" | "scale" | "match" | "picture" | "stairs";
const TOOLS: { id: Tool; label: string; key: string; help: string; menu?: boolean; picture?: boolean; more?: boolean }[] = [
  { id: "select", label: "Select", key: "v", help: "Click a room, wall, door, window or piece of furniture to change it. Drag a room to move it with everything in it, a corner to reshape it, or an arrow on a wall to push or pull that wall (the room next door and the furniture against it follow). Right-click a room's wall to separate its walls into pieces. Q turns the picked room or thing a quarter turn (Shift+Q the other way). Click a wall of the picked room to see it from the side. Arrow keys nudge. Drag empty space to look around, scroll to zoom." },
  { id: "pen", label: "Walls", key: "e", help: "Draw walls with the mouse or your finger. Every line is a wall; draw all the way round and it's a room. Wobbly lines come out straight and nearly square corners come out square; a wall drawn on a slant keeps its slant. Wall ends snap onto other walls, and walls that close a loop make a room. Then type the exact sizes." },
  { id: "stairs", label: "Stairs", key: "t", help: "Click where the stairs start and drag the way they go up. The steps come from the floor height and your standards; pick the stairs to make them an L or a U, wider, or turn them. The floor above gets the opening." },
  { id: "split", label: "Split room", key: "s", more: true, help: "Drag a line across a room to cut it in two (for two rooms read as one)." },
  { id: "door", label: "Door", key: "d", menu: true, help: "Click a wall between two rooms to put a door in it, or an outside wall for an outside door. A wall standing on its own takes one too." },
  { id: "window", label: "Window", key: "w", menu: true, help: "Click an outside wall of a room to add a window there, or a wall standing on its own. Click again for another." },
  { id: "balcony", label: "Balcony", key: "b", menu: true, help: "Click an outside wall of a room. Upstairs that adds a balcony with a patio door onto it; on the ground floor, a patio door out to the garden." },
  { id: "thing", label: "Furniture", key: "f", help: "Cabinets, sinks, toilets, beds, appliances. Pick one in the tray under the plan, then click where it goes. Near a wall it backs onto the wall and faces the room. Shift-click to keep placing the same thing." },
  { id: "cabinet", label: "Cabinets", key: "j", help: "Fill a kitchen wall with stock cabinets in one click, and the cabinet list. Single cabinets are in Furniture, Kitchen and Bath." },
  { id: "corners", label: "Corners", key: "c", more: true, help: "Click each corner of the room in turn. Walls turn in steady steps and lock onto other rooms' corners and walls. Type a length (like 12'6) and press Enter to make the wall that long. Click the first corner or double-click to make the room; Enter or Esc leaves the walls drawn so far as walls. Backspace takes back a corner." },
  { id: "eyedrop", label: "Copy", key: "i", more: true, help: "Click a piece of furniture to pick up another one just like it, same size, then click where it goes. Or click a room to copy its kind (kitchen, bedroom), or a wall to copy its thickness and height, then click the rooms or walls that should be the same." },
  { id: "remove", label: "Remove", key: "x", more: true, help: "Click a room, wall, door, window or piece of furniture to take it out. Undo brings it back." },
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

type Sel = { t: "room" | "door" | "window" | "thing" | "stair" | "wall"; i: number } | null;
type Drag =
  | { k: "pan"; c: Pt; v: View }
  | { k: "newRoom"; a: Pt; b: Pt }
  | { k: "split"; a: Pt; b: Pt }
  | { k: "pen"; pts: Pt[] }
  | { k: "move"; i: number; from: Pt; orig: Pt[]; of: SketchFloor; moved: boolean }
  | { k: "corner"; i: number; v: number; orig: Pt[] }
  | { k: "wall"; s: Seg; from: Pt; of: SketchFloor; i: number; e: number; moved: boolean; by: number }
  | { k: "thing"; i: number; from: Pt; orig: Pt }
  | { k: "picture"; from: Pt; orig: Pt }
  | { k: "stair"; a: Pt; b: Pt }
  | { k: "stairMove"; i: number; from: Pt; orig: Pt; moved: boolean }
  // a wall piece: one end (0 a, 1 b), or the whole wall when `end` is null
  | { k: "piece"; i: number; end: 0 | 1 | null; from: Pt; of: SketchFloor; moved: boolean; alone: boolean };
interface View { x: number; y: number; w: number }

const r10 = (v: number) => Math.round(v / 10) * 10;
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const blankFloor = (level: number): SketchFloor => ({ name: level === 0 ? "Ground floor" : `Level ${level}`, level, rooms: [], doors: [], windows: [], fixtures: [] });


export function SketchEditor({ initial, pictures, initialBackdrops, onDone, onCancel, doneLabel = "Use this plan", viewAs = "contractor", build, onBuild }: {
  initial: Sketch | null; pictures: Picture[]; initialBackdrops?: Record<number, Backdrop>;
  onDone: (sketch: Sketch, backdrops: Record<number, Backdrop>) => void; onCancel: () => void; doneLabel?: string;
  /** who is drawing: the contractor, or their client (whose changes are suggestions) */
  viewAs?: ViewAs;
  /** how the house is built (the build questions): "Build it" follows its stages. With `onBuild` the
   *  questions can be answered here too, from "How it's built" in the toolbar */
  build?: BuildSpec;
  onBuild?: (s: BuildSpec) => void;
}) {
  const [sk, setSk] = useState<Sketch>(() => (initial?.floors?.length ? flatten(initial) : { floors: [blankFloor(0)] }));
  const past = useRef<Sketch[]>([]);
  const [fi, setFi] = useState(0);
  const [tool, setTool] = useState<Tool>(initial?.floors?.length ? "select" : pictures.length ? "scale" : "pen");
  const [doorKind, setDoorKind] = useState<NonNullable<SketchDoor["kind"]>>("door");
  const [wallAdd, setWallAdd] = useState<"balcony" | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [thing, setThing] = useState<TrayItem>({ kind: "kitchen_sink" });
  /** a cabinet that didn't fit where it was put: the smaller ones on offer, applied when picked */
  const [ask, setAsk] = useState<FitAsk | null>(null);
  // corner by corner: the corners so far, a typed wall length, where the pointer is
  const [corners, setCorners] = useState<Pt[]>([]);
  const [typed, setTyped] = useState("");
  const [hover, setHover] = useState<Pt | null>(null);
  // the room kind the Copy tool picked up, put on each room clicked next
  const [pickedType, setPickedType] = useState<string | null>(null);
  // the wall thickness and height the Copy tool picked up
  const [pickedWall, setPickedWall] = useState<Pick<SketchWall, "thickness_mm" | "height_mm" | "half"> | null>(null);
  // what the Cabinets tool puts down next
  const [cabPick, setCabPick] = useState<CabPick>(DEFAULT_PICK);
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
  // the checks in the side panel, the one picked, and a standard opened from a check
  const [showChecks, setShowChecks] = useState(false);
  // the build questions in the side panel; opened by itself once when none are answered yet
  const [showBuild, setShowBuild] = useState(() => !!onBuild && !Object.keys(build ?? {}).length);
  // picking something or another tool brings the drawing help back
  useEffect(() => { if (sel) setShowBuild(false); }, [sel]);
  const firstTool = useRef(tool);
  useEffect(() => { if (tool !== firstTool.current) { firstTool.current = tool; setShowBuild(false); } }, [tool]);
  const [activeNudge, setActiveNudge] = useState<string | null>(null);
  const [stdFocus, setStdFocus] = useState<string | null>(null);
  const stdV = useStandards();
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
  // the client's suggestions and the contractor's answers; the homes list's lit home; a library room being put down
  const sg = useSuggest({ sk, setSk, past, future, fi, setFi, start: viewAs, units: "ft" });
  const [homeLit, setHomeLit] = useState<string | null>(null);
  const lib = usePlacing({ snap: (xs, ys) => {
    // either edge onto a wall nearby, else the grid
    const L = snapLines(), g = 6 * INCH;
    const by = (vs: number[], lines: number[]) => { let d: number | null = null; for (const v of vs) for (const l of lines) if (Math.abs(l - v) < 12 * px && (d == null || Math.abs(l - v) < Math.abs(d))) d = l - v; return d ?? Math.round(vs[0] / g) * g - vs[0]; };
    return [by(xs, L.xs), by(ys, L.ys)];
  } });
  useEffect(() => { setSel(null); setWall(null); }, [sg.as, sg.locked]);
  const commit = (next: Sketch) => { past.current.push(sk); if (past.current.length > 80) past.current.shift(); future.current = []; setSk(next); };
  const nums = useMemo(() => itemNumbers(floor.fixtures ?? [], (x) => roomOfThing(floor, x)), [floor]);
  const setFloor = (f0: SketchFloor, keepHistory = true) => {
    // every item keeps its number in its room once it has one (lib/plan/numbers.ts)
    const f = f0.fixtures?.some((x) => !x.no && isNumbered(x.kind)) ? { ...f0, fixtures: stampNumbers(f0.fixtures, (x) => roomOfThing(f0, x)) } : f0;
    const next = { ...sk, floors: sk.floors.map((x, i) => (i === fi ? f : x)) };
    if (keepHistory) commit(next); else setSk(next);
  };
  const undo = () => { if (sg.locked) return; const p = past.current.pop(); if (p) { future.current.push(sk); setSk(p); setSel(null); } };
  const redo = () => { if (sg.locked) return; const n = future.current.pop(); if (n) { past.current.push(sk); setSk(n); setSel(null); } };

  // kept in this browser as you go, so a crash or a closed tab doesn't lose the drawing
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [draft, setDraft] = useState<{ sk: Sketch; at: string } | null>(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? "null"); return d?.sk?.floors?.some((f: SketchFloor) => f.rooms.length) ? d : null; } catch { return null; }
  });
  const saveNow = () => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ sk: sg.plan(), at: new Date().toISOString() })); setSavedAt(new Date()); } catch { /* storage full or blocked */ }
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
      ? { ...JSON.parse(JSON.stringify(floor)), name, level: lv, fixtures: [], stairs: [], doors: (floor.doors ?? []).filter((d) => d.rooms[1] && !OUTSIDE.test(d.rooms[1])) }
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
    setFloor(pushWall(floor, s, size - (b[axis + 2] - b[axis])).floor, false);
  };
  const duplicate = (i: number) => {
    const r = floor.rooms[i], b = bboxOf(r.polygon), w = b[2] - b[0];
    setFloor({ ...floor, rooms: [...floor.rooms, { ...r, loose: undefined, name: uniqueName(r.name), polygon: r.polygon.map(([x, y]) => [x + w, y] as Pt) }] });
    setSel({ t: "room", i: floor.rooms.length });
  };

  const snapLines = (skip?: number) => {
    const xs: number[] = [], ys: number[] = [];
    floor.rooms.forEach((r, i) => { if (i !== skip) for (const p of r.polygon) { xs.push(p[0]); ys.push(p[1]); } });
    for (const r of below?.rooms ?? []) for (const p of r.polygon) { xs.push(p[0]); ys.push(p[1]); }
    for (const w of floor.walls ?? []) for (const p of [w.a, w.b]) { xs.push(p[0]); ys.push(p[1]); }
    return { xs, ys };
  };
  const snapPt = (p: Pt, skip?: number): Pt => { const { xs, ys } = snapLines(skip); const g = px > 40 ? 12 * INCH : px < 8 ? INCH : 6 * INCH; return [snapTo(p[0], xs, 12 * px, g), snapTo(p[1], ys, 12 * px, g)]; };
  const snapCorner = (p: Pt): Pt => {
    let best = p, d = 14 * px;
    for (const r of [...floor.rooms, ...(below?.rooms ?? [])]) for (const q of r.polygon) if (dist(p, q) < d) { d = dist(p, q); best = q; }
    for (const w of floor.walls ?? []) for (const q of [w.a, w.b]) if (dist(p, q) < d) { d = dist(p, q); best = q; }
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
  // the push and pull arrows of the picked room: one just outside the middle of each straight wall
  const handles = (() => {
    const r = tool === "select" && sel?.t === "room" ? floor.rooms[sel.i] : null;
    if (!r || r.loose) return [];
    return edgesOf(r.polygon).map((s, e) => ({ s, e })).filter(({ s }) => (Math.abs(s[0][0] - s[1][0]) < 1 || Math.abs(s[0][1] - s[1][1]) < 1) && dist(s[0], s[1]) > 40 * px)
      .map(({ s, e }) => { const n = outward(r.polygon, s); return { e, n, at: [(s[0][0] + s[1][0]) / 2 + n[0] * 16 * px, (s[0][1] + s[1][1]) / 2 + n[1] * 16 * px] as Pt }; });
  })();
  // wall pieces (lib/plan/walls.ts): the one under the pointer, and the floor once the walls change, with
  // a room for each loop they close and the rooms whose loop opened taken off until it closes again
  const pieceAt = (p: Pt) => {
    let best = -1, d = Infinity;
    (floor.walls ?? []).forEach((w, i) => { const h = onWall(p, w.a, w.b).d; if (h < Math.max(7 * px, wallThickness(w) / 2) && h < d) { d = h; best = i; } });
    return best;
  };
  const withWalls = (f: SketchFloor, walls: SketchWall[]) => {
    const used = new Set(sk.floors.flatMap((x) => x.rooms.map((r) => r.name.toLowerCase())));
    const name = () => { let k = f.rooms.length + 1, n = `Room ${k}`; while (used.has(n.toLowerCase())) n = `Room ${++k}`; used.add(n.toLowerCase()); return n; };
    const r = refit({ ...f, walls }, name);
    const say = r.opened.length && !r.made.length ? `${r.opened.join(", ")} is open now: its floor comes back when its walls meet again.`
      : r.made.length && !r.opened.length ? `The walls close a room (${r.made.join(", ")}). Undo takes it back.` : null;
    return { floor: r.floor, say };
  };
  // a door or window in a wall standing on its own (not a room's edge): kept on the piece itself
  const inPiece = (p: Pt, what: "door" | "window") => {
    const i = pieceAt(p);
    if (i < 0) return false;
    const w = floor.walls![i], { t } = onWall(p, w.a, w.b), at = Math.round(t * 100) / 100;
    const nw = what === "door" ? { ...w, doors: [...(w.doors ?? []), { at, kind: doorKind, ...(doorKind !== "door" ? { width_mm: DOOR_W[doorKind] } : {}) }] }
      : { ...w, windows: [...(w.windows ?? []), { at }] };
    setFloor({ ...floor, walls: floor.walls!.map((x, k) => (k === i ? nw : x)) });
    setSel({ t: "wall", i });
    setNote(`Added a ${what} to that wall. Pick the wall to move or take it out.`);
    return true;
  };
  const setWalls = (walls: SketchWall[], keepHistory = true, base = floor) => { const r = withWalls(base, walls); setFloor(r.floor, keepHistory); if (r.say) setNote(r.say); };
  // a room that follows its walls brings them along when it moves
  const moveAny = (of: SketchFloor, i: number, d: Pt): SketchFloor => {
    const f = moveRoom(of, i, d), r = of.rooms[i];
    if (!r.loose) return f;
    const sh = (p: Pt): Pt => [Math.round(p[0] + d[0]), Math.round(p[1] + d[1])];
    return withWalls(f, (of.walls ?? []).map((w) => (onOutline(w, r.polygon) ? { ...w, a: sh(w.a), b: sh(w.b) } : w))).floor;
  };
  // the wall a right-click lands on: a piece, or a room's edge (that room's walls come apart into pieces)
  const separateAt = (p: Pt) => {
    const wi = pieceAt(p);
    if (wi >= 0) { setSel({ t: "wall", i: wi }); setTool("select"); return; }
    let best: { ri: number; d: number } | null = null;
    floor.rooms.forEach((r, ri) => { if (r.loose) return; for (const s of edgesOf(r.polygon)) { const d = nearSeg(p, s).d + (pointInPoly(p, r.polygon) ? 0 : 1); if (d < 10 * px && (!best || d < best.d)) best = { ri, d }; } });
    if (!best) return;
    separate((best as { ri: number }).ri, p);
  };
  const separate = (ri: number, at?: Pt) => {
    const f = separateRoom(floor, ri), walls = f.walls ?? [];
    setFloor(f);
    const c = at ?? centroid(floor.rooms[ri].polygon);
    const near = walls.map((w, i) => ({ i, d: onWall(c, w.a, w.b).d })).sort((a, b) => a.d - b.d)[0];
    setSel(near && at ? { t: "wall", i: near.i } : { t: "room", i: ri });
    setTool("select");
    setWall(null);
    setNote("Its walls are pieces now: pick one to move it, or drag an end to make it longer or shorter. The room follows its walls.");
  };
  // stairs on this floor, and the openings cut in it by the stairs coming up from the floor below
  const rise = floorRise(sk, floor);
  const lower = floorBelow(sk, floor);
  const stairGs = useMemo(() => (floor.stairs ?? []).map((st) => stairGeom(st, rise)), [floor, rise, stdV]); // eslint-disable-line react-hooks/exhaustive-deps
  const holeGs = useMemo(() => (lower ? (lower.stairs ?? []).map((st) => stairGeom(st, floorRise(sk, lower))) : []), [lower, sk, stdV]); // eslint-disable-line react-hooks/exhaustive-deps
  const stairAt = (p: Pt) => stairGs.findIndex((g) => onStair(g, p));
  const stairTurn = (d: { a: Pt; b: Pt }) => {
    // the way it was dragged is the way up, in 15° steps; a plain click goes up the page
    if (dist(d.a, d.b) < 12 * px) return 270;
    return (((Math.round((Math.atan2(d.b[1] - d.a[1], d.b[0] - d.a[0]) * 180) / Math.PI / 15) * 15) % 360) + 360) % 360;
  };
  // the real rules, run again whenever the drawing or a standard changes
  const before = useMemo(() => (initial?.floors?.length ? flatten(initial) : null), [initial]);
  const checks = useMemo(() => runChecks(sk, before), [sk, before, stdV]); // eslint-disable-line react-hooks/exhaustive-deps
  // what the job is: the order of the tools, the checks first in the list, the side panel (lib/plan/trades.ts)
  const trade = tradeOf(sk);
  const fly = (to: Pt, floorIdx: number) => {
    const from = floorIdx === fi ? v : null;
    const w = Math.min(Math.max(from?.w ?? 9000, 4000), 9000), h = (w * box.h) / box.w;
    const target: View = { x: to[0] - w / 2, y: to[1] - h / 2, w };
    if (!from) { fitted.current = floorIdx; setView(target); return; }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 350), e = 1 - (1 - k) ** 3;
      setView({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const pickNudge = (n: Nudge) => {
    setActiveNudge(n.id); setShowChecks(true); setShowStd(false);
    if (n.floor !== fi) { setFi(n.floor); setClicks([]); setWall(null); }
    setSel(n.el ? { t: n.el.t, i: n.el.i } : null);
    fly(n.at, n.floor);
  };
  const ignoreNudge = (id: string, on: boolean) => { const cur = sk.ignored_checks ?? []; commit({ ...sk, ignored_checks: on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id) }); };
  const openStd = (key: string) => { setStdFocus(key); setShowStd(true); };

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

  const removeIt = (it: NonNullable<Sel>) => {
    if (it.t === "room") {
      const name = floor.rooms[it.i].name.toLowerCase();
      setFloor({ ...floor, rooms: floor.rooms.filter((_, i) => i !== it.i), ...(floor.rooms[it.i].loose ? { walls: dropLooseRoom(floor, it.i) } : {}),
        doors: (floor.doors ?? []).filter((d) => !d.rooms.some((n) => n.toLowerCase() === name)),
        windows: (floor.windows ?? []).filter((w) => w.room.toLowerCase() !== name) });
      setWall(null);
    } else if (it.t === "door") setFloor({ ...floor, doors: (floor.doors ?? []).filter((_, i) => i !== it.i) });
    else if (it.t === "window") setFloor({ ...floor, windows: (floor.windows ?? []).filter((_, i) => i !== it.i) });
    else if (it.t === "stair") setFloor({ ...floor, stairs: (floor.stairs ?? []).filter((_, i) => i !== it.i) });
    else if (it.t === "wall") setWalls((floor.walls ?? []).filter((_, i) => i !== it.i));
    else setFloor({ ...floor, fixtures: (floor.fixtures ?? []).filter((_, i) => i !== it.i) });
    setSel(null);
  };
  const deleteSel = () => { if (sel) removeIt(sel); };
  const pickTool = (t: Tool) => { setTool(t); setClicks([]); setCorners([]); setTyped(""); setPickedType(null); setPickedWall(null); if (t === "remove" || t === "eyedrop" || t === "corners") setSel(null); };
  // what a click at p lands on: furniture first, then doors, windows, the room
  const hitAt = (p: Pt): Sel => {
    const ti = thingAt(p);
    if (ti >= 0) return { t: "thing", i: ti };
    const di = doorSpots.findIndex((s) => s && nearSeg(p, s).d < 9 * px);
    if (di >= 0) return { t: "door", i: di };
    const wi = winSpots.findIndex((list) => list.some((s) => nearSeg(p, s).d < 9 * px));
    if (wi >= 0) return { t: "window", i: wi };
    const si = stairAt(p);
    if (si >= 0) return { t: "stair", i: si };
    const pi = pieceAt(p);
    if (pi >= 0) return { t: "wall", i: pi };
    const ri = roomAt(p);
    return ri >= 0 ? { t: "room", i: ri } : null;
  };
  // a quarter turn of the picked room (with its furniture and windows) or the picked thing
  const turn = (cw: boolean) => {
    if (sel?.t === "room" && floor.rooms[sel.i]?.loose) setNote("This room follows its walls. Join it into a room first to turn it.");
    else if (sel?.t === "room") setFloor(turnRoom(floor, sel.i, cw));
    else if (sel?.t === "thing") setFloor({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? { ...f, facing: f.facing ? turnSide(f.facing, cw) : cw ? "east" : "west" } : f)) });
  };

  // corner by corner: the next corner the pointer would put down, locked onto corners, walls and steady angles
  const cornerSnap = (p: Pt): Pt => {
    const c = snapCorner(p);
    if (c !== p) return c;
    if (!corners.length) return snapPt(p);
    const last = corners[corners.length - 1], q = nextCorner(last, p, std("draw.snapAngle"));
    // a square wall also lines up with the other rooms' walls
    if (Math.abs(q[0] - last[0]) < 1) return [last[0], snapPt(q)[1]];
    if (Math.abs(q[1] - last[1]) < 1) return [snapPt(q)[0], last[1]];
    return q;
  };
  const closeCorners = (pts = corners) => {
    const poly = cleanOutline(pts);
    setCorners([]);
    setTyped("");
    if (poly.length < 3 || roomArea({ name: "", polygon: poly }) < 0.3) { setNote("A room needs at least three corners around some floor."); return; }
    const name = uniqueName(`Room ${floor.rooms.length + 1}`);
    // rooms never overlap: where it runs into a neighbour it stops at the neighbour's wall
    const fit = trimOverlap(poly, floor.rooms.map((r) => r.polygon));
    if (!fit) { setNote("That's on top of another room. Draw it next to it (or use Split room to divide a room)."); return; }
    setFloor({ ...floor, rooms: [...floor.rooms, { name, type: "other", polygon: fit }] });
    setSel({ t: "room", i: floor.rooms.length });
  };
  // corners left open (Enter or Esc): the walls drawn so far stay as wall pieces
  const finishChain = () => {
    setTyped("");
    setCorners([]);
    if (corners.length < 2) return;
    const pts = corners.map((q, k) => (k === 0 || k === corners.length - 1 ? snapEnd(q, floor, 10 * px).p : q));
    setWalls([...(floor.walls ?? []), ...chain(pts)]);
    setSel(null);
  };
  const addCorner = (q: Pt) => {
    if (corners.length >= 3 && dist(q, corners[0]) < 10 * px) { closeCorners(); return; }
    if (corners.length && dist(q, corners[corners.length - 1]) < 5) return;
    setCorners([...corners, [Math.round(q[0]), Math.round(q[1])]]);
    setTyped("");
  };

  // keys: the tool letters, Delete, Ctrl+Z
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && editable(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // corner by corner: type a wall's length, Enter puts it down (or finishes), Backspace takes back
      if (tool === "corners" && corners.length) {
        if (/^[\d'".½ ]$/.test(e.key) || (typed && /^[a-z]$/i.test(e.key) && /^(f|ft|i|in|m|mm|c|cm)$/i.test((typed.match(/[a-z]*$/i)?.[0] ?? "") + e.key))) { e.preventDefault(); setTyped(typed + e.key); return; }
        if (e.key === "Backspace") { e.preventDefault(); if (typed) setTyped(typed.slice(0, -1)); else setCorners(corners.slice(0, -1)); return; }
        if (e.key === "Enter") {
          e.preventDefault();
          const len = typed ? parseLength(typed, lu) : null;
          if (len && hover) addCorner(cornerAt(corners[corners.length - 1], hover, len, std("draw.snapAngle")));
          else if (typed) setNote("Type a length like 12'6 or 150 in.");
          else finishChain();
          return;
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSel(); return; }
      if (e.key.toLowerCase() === "q" && (sel?.t === "room" || sel?.t === "thing")) { e.preventDefault(); turn(!e.shiftKey); return; }
      // arrows nudge the picked room or thing: 100 mm, 10 mm with Shift
      const dir: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (dir[e.key] && (sel?.t === "room" || sel?.t === "thing" || sel?.t === "wall")) {
        e.preventDefault();
        const st = e.shiftKey ? INCH / 2 : 6 * INCH, [dx, dy] = [dir[e.key][0] * st, dir[e.key][1] * st];
        if (sel.t === "room") setFloor(moveAny(floor, sel.i, [dx, dy]));
        else if (sel.t === "wall") setWalls(shiftWall(floor.walls ?? [], sel.i, [dx, dy]), true, followWall(floor, sel.i, [dx, dy]));
        else setFloor({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? { ...f, center: [f.center[0] + dx, f.center[1] + dy] as Pt } : f)) });
        return;
      }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) pickTool(t.id);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // a saved room from the library, put down where it was dragged to
  const dropPiece = () => {
    const at = lib.placing?.at;
    if (!lib.placing || !at) return;
    const r = placePiece(floor, lib.placing.piece, at, new Set(sk.floors.flatMap((f) => f.rooms.map((x) => x.name))));
    if (!r) { setNote("That's on top of a room. Put it beside the rooms."); return; }
    setFloor(r.floor);
    setSel({ t: "room", i: r.rooms[0] });
    setNote(`${lib.placing.item.name} is in. Drag it, or reshape it like any room.`);
    lib.stop();
    setTool("select");
  };
  useEscape(() => { if (lib.placing) lib.stop(); else if (drag) setDrag(null); else if (typed) setTyped(""); else if (corners.length) finishChain(); else if (pickedType) setPickedType(null); else if (pickedWall) setPickedWall(null); else if (clicks.length) setClicks([]); else if (sel) setSel(null); else if (wall) setWall(null); else setTool("select"); });

  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toMm(e);
    setNote(null);
    if (lib.placing) { dropPiece(); return; }
    // the client's version is only looked at, not changed
    if (sg.locked) { setSel(null); setDrag({ k: "pan", c: [e.clientX, e.clientY], v }); return; }
    if (e.button === 1 || e.shiftKey && tool !== "room" && tool !== "thing" && tool !== "corners") { setDrag({ k: "pan", c: [e.clientX, e.clientY], v }); return; }
    if (tool === "select") {
      // the picked wall piece: an end to stretch it, or the wall to move it
      const pw = sel?.t === "wall" ? floor.walls?.[sel.i] : null;
      if (pw && sel) {
        const end = dist(pw.a, p) < 10 * px ? 0 : dist(pw.b, p) < 10 * px ? 1 : null;
        if (end != null || onWall(p, pw.a, pw.b).d < Math.max(7 * px, wallThickness(pw) / 2)) { setDrag({ k: "piece", i: sel.i, end, from: p, of: floor, moved: false, alone: e.altKey }); return; }
      }
      if (sel?.t === "room" && !floor.rooms[sel.i]?.loose) {
        const poly = floor.rooms[sel.i].polygon;
        const vi = poly.findIndex((q) => dist(q, p) < 9 * px);
        if (vi >= 0) { past.current.push(sk); setDrag({ k: "corner", i: sel.i, v: vi, orig: poly }); return; }
        const es = edgesOf(poly);
        // the push and pull arrows first, then anywhere along the wall
        let ei = handles.findIndex((h) => dist(h.at, p) < 11 * px);
        if (ei < 0) ei = es.findIndex((s) => nearSeg(p, s).d < 7 * px && nearSeg(p, s).t > 0.08 && nearSeg(p, s).t < 0.92);
        else ei = handles[ei].e;
        if (ei >= 0) { setDrag({ k: "wall", s: es[ei], from: p, of: floor, i: sel.i, e: ei, moved: false, by: 0 }); return; }
      }
      const ti = thingAt(p), si = ti < 0 ? stairAt(p) : -1;
      if (si >= 0) { setSel({ t: "stair", i: si }); setDrag({ k: "stairMove", i: si, from: p, orig: floor.stairs![si].at, moved: false }); return; }
      if (ti >= 0) { setSel({ t: "thing", i: ti }); past.current.push(sk); setDrag({ k: "thing", i: ti, from: p, orig: floor.fixtures![ti].center }); return; }
      const di = doorSpots.findIndex((s) => s && nearSeg(p, s).d < 9 * px);
      if (di >= 0) { setSel({ t: "door", i: di }); return; }
      const wi = winSpots.findIndex((list) => list.some((s) => nearSeg(p, s).d < 9 * px));
      if (wi >= 0) { setSel({ t: "window", i: wi }); return; }
      const pi = pieceAt(p);
      if (pi >= 0) { setSel({ t: "wall", i: pi }); setWall(null); setDrag({ k: "piece", i: pi, end: null, from: p, of: floor, moved: false, alone: e.altKey }); return; }
      const ri = roomAt(p);
      if (ri >= 0) { setSel({ t: "room", i: ri }); setDrag({ k: "move", i: ri, from: p, orig: floor.rooms[ri].polygon, of: floor, moved: false }); return; }
      setSel(null);
      setDrag({ k: "pan", c: [e.clientX, e.clientY], v });
    } else if (tool === "room") {
      const a = snapPt(p);
      setDrag({ k: "newRoom", a, b: a });
    } else if (tool === "pen") {
      setDrag({ k: "pen", pts: [p] });
    } else if (tool === "split") {
      setDrag({ k: "split", a: p, b: p });
    } else if (tool === "stairs") {
      setDrag({ k: "stair", a: [r10(p[0]), r10(p[1])], b: p });
    } else if (tool === "picture") {
      if (bg) setDrag({ k: "picture", from: p, orig: bg.at });
    }
  };

  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (lib.placing) { lib.moveTo(toMm(e)); return; }
    if (!drag && (tool === "corners" || tool === "remove" || tool === "eyedrop" || tool === "thing")) { setHover(toMm(e)); return; }
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
      // its furniture comes along; the outline lands on the 10 mm grid like before
      const q0 = drag.orig[0];
      setFloor(moveAny(drag.of, drag.i, [r10(q0[0] + d[0]) - q0[0], r10(q0[1] + d[1]) - q0[1]]), false);
    } else if (drag.k === "piece") {
      if (!drag.moved && dist(p, drag.from) < 4 * px) return;
      if (!drag.moved) { past.current.push(sk); setDrag({ ...drag, moved: true }); }
      const all = drag.of.walls ?? [], w = all[drag.i], g = px > 40 ? 12 * INCH : px < 8 ? INCH : 6 * INCH;
      if (drag.end != null) {
        // an end: onto another wall's end or along another wall, else at a steady angle and a round length
        const anchor = drag.end ? w.a : w.b, s = snapEnd(p, drag.of, 10 * px, drag.i);
        let to = s.p;
        if (!s.hit) { const q = nextCorner(anchor, p, std("draw.snapAngle")), L = dist(anchor, q), k = L > 1 ? (Math.round(L / g) * g) / L : 0; to = [anchor[0] + (q[0] - anchor[0]) * k, anchor[1] + (q[1] - anchor[1]) * k]; }
        setWalls(moveEnd(all, drag.i, drag.end, to, drag.alone), false, drag.of);
      } else {
        // the whole wall: square across itself when other walls hang on it, lining up with other walls
        let d: Pt = [p[0] - drag.from[0], p[1] - drag.from[1]];
        const L = dist(w.a, w.b) || 1, n: Pt = [-(w.b[1] - w.a[1]) / L, (w.b[0] - w.a[0]) / L];
        if (isJoined(all, drag.i)) { const k = d[0] * n[0] + d[1] * n[1]; d = [n[0] * k, n[1] * k]; }
        const { xs, ys } = snapLines();
        const own = (v: number, ax: 0 | 1) => Math.abs(v - w.a[ax]) > 1 && Math.abs(v - w.b[ax]) > 1;
        if (Math.abs(w.a[1] - w.b[1]) < 1) d[1] = snapTo(w.a[1] + d[1], ys.filter((y) => own(y, 1)), 12 * px, g) - w.a[1];
        else if (Math.abs(w.a[0] - w.b[0]) < 1) d[0] = snapTo(w.a[0] + d[0], xs.filter((x) => own(x, 0)), 12 * px, g) - w.a[0];
        setWalls(shiftWall(all, drag.i, d), false, followWall(drag.of, drag.i, d));
      }
    } else if (drag.k === "corner") {
      const to = snapPt(p, drag.i);
      setFloor({ ...floor, rooms: floor.rooms.map((r, i) => (i === drag.i ? { ...r, polygon: moveCorner(drag.orig, drag.v, to) } : r)) }, false);
    } else if (drag.k === "wall") {
      if (!drag.moved && dist(p, drag.from) < 4 * px) return;
      if (!drag.moved) { past.current.push(sk); setDrag({ ...drag, moved: true }); }
      const h = Math.abs(drag.s[0][1] - drag.s[1][1]) < 1;
      // snap to the other walls where they were before this push
      const xs = [...drag.of.rooms, ...(below?.rooms ?? [])].flatMap((r) => r.polygon.map((q) => q[0])), ys = [...drag.of.rooms, ...(below?.rooms ?? [])].flatMap((r) => r.polygon.map((q) => q[1]));
      const line = h ? drag.s[0][1] : drag.s[0][0];
      const want = (h ? p[1] - drag.from[1] : p[0] - drag.from[0]) + line;
      const others = (h ? ys : xs).filter((x) => Math.abs(x - line) > 1);
      const res = pushWall(drag.of, drag.s, snapTo(want, others, 12 * px, 10) - line);
      setDrag({ ...drag, moved: true, by: res.by });
      setFloor(res.floor, false);
    } else if (drag.k === "thing") {
      const c: Pt = [r10(drag.orig[0] + p[0] - drag.from[0]), r10(drag.orig[1] + p[1] - drag.from[1])];
      const f0 = (floor.fixtures ?? [])[drag.i], ri = roomAt(c);
      // slides along a wall it's dragged near, back to the wall
      const hug = f0 && ri >= 0 && CATALOG[f0.kind]?.mount !== "ceiling" ? hugWall(floor.rooms[ri].polygon, c, f0.width_mm ?? 600, f0.depth_mm ?? 600, 250) : null;
      // a cabinet slides along the wall's inside face and lines up with its neighbours
      const slid = f0?.cab ? slideCabinet(floor, drag.i, c) : null;
      if (slid) { setFloor({ ...floor, fixtures: (floor.fixtures ?? []).map((f, i) => (i === drag.i ? slid : f)) }, false); return; }
      setFloor({ ...floor, fixtures: (floor.fixtures ?? []).map((f, i) => (i === drag.i ? { ...f, center: hug?.center ?? c, ...(hug ? { facing: hug.facing } : {}), room: ri >= 0 ? floor.rooms[ri].name : f.room } : f)) }, false);
    } else if (drag.k === "stair") setDrag({ ...drag, b: p });
    else if (drag.k === "stairMove") {
      if (!drag.moved && dist(p, drag.from) < 4 * px) return;
      if (!drag.moved) { past.current.push(sk); setDrag({ ...drag, moved: true }); }
      setFloor({ ...floor, stairs: floor.stairs!.map((x, i) => (i === drag.i ? { ...x, at: [r10(drag.orig[0] + p[0] - drag.from[0]), r10(drag.orig[1] + p[1] - drag.from[1])] as Pt } : x)) }, false);
    } else if (drag.k === "picture" && bg) {
      setBgs({ ...bgs, [fi]: { ...bg, at: [drag.orig[0] + p[0] - drag.from[0], drag.orig[1] + p[1] - drag.from[1]] } });
    }
  };

  /** the tray's pick as a Cabinets-tool pick (a stock cabinet, or something that goes in a run) */
  const pickOf = (it: TrayItem): CabPick | null => (it.cab || it.run ? { item: it.cab?.fam ?? it.run!, w: it.w, d: it.run ? it.d : undefined, h: it.h, config: it.cab?.config, hinge: it.cab?.hinge, mode: "place", fillBase: false, fillWall: false } : null);
  /** what a cabinet placement said: put it in, or ask before shrinking it to fit */
  const placed = (r: { floor?: SketchFloor; sel?: number; note?: string; ask?: FitAsk }) => {
    setAsk(r.ask ?? null);
    if (r.note) setNote(r.note); else if (r.ask) setNote(null);
    if (r.floor) { setFloor(r.floor); setSel(r.sel != null ? { t: "thing", i: r.sel } : null); }
    return !!r.floor;
  };
  /** the tray's pick put down at p on the plan (clicked or dropped there). True when it went in. */
  const placeThing = (p: Pt): boolean => {
    const pk = pickOf(thing);
    // a stock cabinet (or a range, toilet, tub) goes onto the nearest wall, beside its neighbours
    if (pk) return placed(cabinetClick(floor, p, pk));
    const spec = CATALOG[thing.kind];
    const ri = roomAt(p);
    const c: Pt = [r10(p[0]), r10(p[1])];
    const w = thing.w ?? spec?.w ?? 600, dp = thing.d ?? spec?.d ?? 600;
    // against a wall when it's put near one: back flat to the wall, facing the room
    const hug = ri >= 0 && spec?.mount !== "ceiling" ? hugWall(floor.rooms[ri].polygon, c, w, dp, 600) : null;
    const fx = { kind: thing.kind, name: thing.label ?? spec?.label, room: ri >= 0 ? floor.rooms[ri].name : undefined, center: hug?.center ?? c, width_mm: w, depth_mm: dp, facing: hug?.facing ?? facingFor(c, ri), ...(thing.h ? { height_mm: thing.h } : {}) };
    const h = addHood({ ...floor, fixtures: [...(floor.fixtures ?? []), fx] }, (floor.fixtures ?? []).length);
    setFloor(h.floor);
    setAsk(null);
    setNote(h.added ? "A hood went in over it: the code wants one over a range or cooktop." : null);
    setSel({ t: "thing", i: (floor.fixtures ?? []).length });
    return true;
  };
  /** the tray's pick dropped (or clicked) on the open wall view: `x` along the wall from its left end as
   *  you face it, `mid` how high off the floor it was let go */
  const placeOnWall = (x: number, mid: number) => {
    if (!seen) return;
    const fc = faceOf(floor, seen.room, seen.edge);
    if (!fc) { setNote("Things go on straight, square walls. This one is on a slant."); return; }
    const pk = pickOf(thing);
    if (pk) { placed(placeOnFace(floor, fc, x, pk, mid)); return; }
    // furniture: its back on the wall at x; a picture, shelf or TV hangs where it was let go
    const spec = CATALOG[thing.kind];
    const w = thing.w ?? spec?.w ?? 600, dp = thing.d ?? spec?.d ?? 600, h = thing.h ?? spec?.h ?? 600;
    const z = spec?.mount === "wall" ? Math.max(0, Math.round(mid - h / 2)) : 0;
    const fit = fitOnFace(floor, fc, x, w, z, h, -1, dp);
    const at = "x" in fit ? fit.x : x;
    const fx = fixtureAt(floor, fc, at, { w, d: dp, h, z }, thing.kind, thing.label ?? spec?.label ?? thing.kind);
    const r = addHood({ ...floor, fixtures: [...(floor.fixtures ?? []), fx] }, (floor.fixtures ?? []).length);
    setFloor(r.floor);
    setAsk(null);
    setNote(r.added ? "A hood went in over it: the code wants one over a range or cooktop." : null);
    setSel({ t: "thing", i: (floor.fixtures ?? []).length });
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
      const grid = px < 8 ? INCH : 6 * INCH;
      const poly = isClosedStroke(d.pts, 14 * px) ? tidyStroke(d.pts, grid) : null;
      // a line, not a shape: straight wall pieces, their ends snapped onto the walls they reach
      const line = poly ? null : tidyLine(d.pts, grid);
      if (line) {
        const pts = line.map((q, k) => (k === 0 || k === line.length - 1 ? snapEnd(q, floor, 14 * px).p : snapCorner(q)));
        setWalls([...(floor.walls ?? []), ...chain(pts)]);
        return;
      }
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
    if (d?.k === "stair") {
      setFloor({ ...floor, stairs: [...(floor.stairs ?? []), newStair(d.a, stairTurn(d))] });
      setSel({ t: "stair", i: (floor.stairs ?? []).length });
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
      if (!w && inPiece(p, "door")) return;
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
      if (!w && inPiece(p, "window")) return;
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
    } else if (tool === "corners") {
      if (corners.length >= 3 && dist(p, corners[0]) < 10 * px) closeCorners();
      else addCorner(cornerSnap(p));
    } else if (tool === "remove") {
      const it = hitAt(p);
      if (!it) { setNote("Click a room, door, window or piece of furniture to take it out."); return; }
      removeIt(it);
    } else if (tool === "eyedrop") {
      const it = hitAt(p);
      if (it?.t === "wall") {
        // a wall's thickness and height, put on each wall clicked next
        const w = floor.walls![it.i];
        if (pickedWall) { setWalls(floor.walls!.map((x, i) => (i === it.i ? { ...x, thickness_mm: pickedWall.thickness_mm, height_mm: pickedWall.height_mm, half: pickedWall.half } : x))); setNote("Done. Click more walls, or Esc to stop."); }
        else { setPickedWall({ thickness_mm: wallThickness(w, isOutside(floor.rooms, w)), height_mm: w.height_mm, half: w.half }); setNote("Copied that wall. Now click the walls that should be the same."); }
      } else if (it?.t === "thing") {
        // pick up one just like it: the same kind at the same size
        const f = floor.fixtures![it.i];
        setThing({ kind: f.kind, label: f.name && f.name !== CATALOG[f.kind]?.label ? f.name : undefined, w: f.width_mm, d: f.depth_mm, h: f.height_mm, ...(f.cab ? { cab: f.cab } : {}) });
        setTool("thing");
        setNote(`Picked up a ${(f.name ?? CATALOG[f.kind]?.label ?? f.kind).toLowerCase()}. Click where the next one goes (Shift-click for several).`);
      } else if (it?.t === "room") {
        const r = floor.rooms[it.i];
        if (pickedType) {
          setFloor({ ...floor, rooms: floor.rooms.map((q, i) => (i === it.i ? { ...q, type: pickedType } : q)) });
          setNote(`${r.name} is now a ${label(pickedType).toLowerCase()}. Click more rooms, or Esc to stop.`);
        } else {
          setPickedType(r.type ?? "other");
          setNote(`Copied ${label(r.type ?? "other").toLowerCase()}. Now click the rooms that should be the same.`);
        }
      } else setNote("Click a piece of furniture or a room to copy it.");
    } else if (tool === "thing") {
      // Shift-click keeps placing the same thing; a plain click puts it down and picks it to adjust
      if (placeThing(p) && !e.shiftKey) setTool("select");
    } else if (tool === "cabinet") {
      // a click on a cabinet picks it; anywhere else puts one in
      const ti = thingAt(p);
      if (cabPick.mode === "place" && ti >= 0 && floor.fixtures![ti].cab) { setSel({ t: "thing", i: ti }); return; }
      placed(cabinetClick(floor, p, cabPick));
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
        fixtures: (floor.fixtures ?? []).map((f) => ({ ...f, center: sc(f.center) })), walls: (floor.walls ?? []).map((w) => ({ ...w, a: sc(w.a), b: sc(w.b) })) });
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
  const stair = sel?.t === "stair" ? floor.stairs?.[sel.i] : null;
  const units = [...new Set(sk.floors.flatMap((f) => f.rooms.map((r) => r.unit).filter(Boolean) as string[]))];
  const fontMm = Math.max(120, 12 * px);
  const seen = wall && floor.rooms[wall.room] && wall.edge < floor.rooms[wall.room].polygon.length ? wall : null;
  const allRooms = sk.floors.reduce((n, f) => n + f.rooms.length, 0);

  const done = () => {
    const sk = sg.plan();
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
      {sg.banner}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-line bg-panel">
        {toolOrder(trade, TOOLS).filter((t) => !t.menu && !t.more).flatMap((t) => [
          <button key={t.id} onClick={() => pickTool(t.id)} title={`${t.label} (${t.key.toUpperCase()})`}
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
          value={TOOLS.find((x) => x.id === tool)?.more ? tool : ""} onChange={(e) => pickTool(e.target.value as Tool)}>
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
        <button className={`btn btn-sm ${showChecks && !showStd ? "btn-primary" : "btn-ghost"}`} onClick={() => { setShowChecks(!(showChecks && !showStd)); setShowStd(false); }} title="Building code and good practice, checked as you draw">
          {checks.open.length ? <><span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: NUDGE_COLOR[checks.open.some((n) => n.severity === "warn") ? "warn" : "info"] }} />{checks.open.length} to look at</> : "Checks"}
        </button>
        {sg.as === "contractor" && <button className={`btn btn-sm ${showStd ? "btn-primary" : "btn-ghost"}`} onClick={() => { setShowStd((x) => !x); setStdFocus(null); }} title="Your default sizes and the limits the checks use">Standards</button>}
        {onBuild && sg.as === "contractor" && (
          <button className={`btn btn-sm ${showBuild && !showStd && !showChecks ? "btn-primary" : "btn-ghost"}`} onClick={() => { setShowBuild(!(showBuild && !showStd && !showChecks)); setShowStd(false); setShowChecks(false); setShowRoof(false); }}
            title="Siding, wrap, studs, insulation, drywall, foundation and roof: they make the job's stages">
            {nextQuestion(build ?? {}) && <span className="inline-block h-2 w-2 rounded-full mr-1.5 bg-accent" />}How it&apos;s built
          </button>
        )}
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
        {sg.toggle}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
        <div className={show3d ? "grid xl:grid-cols-2" : ""}>
        <div className={`relative ${seen ? "h-[42vh] min-h-[300px]" : tool === "thing" ? "h-[48vh] min-h-[340px]" : "h-[62vh] min-h-[420px]"} bg-ink`}>
          <svg ref={svg} className="absolute inset-0 w-full h-full touch-none select-none" viewBox={`${v.x} ${v.y} ${v.w} ${vh}`}
            style={{ cursor: drag?.k === "pan" ? "grabbing" : tool === "select" ? "default" : tool === "picture" ? "move" : "crosshair" }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)} onPointerLeave={() => setHover(null)}
            onDragOver={(e) => { if (e.dataTransfer.types.includes(TRAY_DRAG)) { e.preventDefault(); setHover(toMm(e)); } }}
            onDrop={(e) => { if (!e.dataTransfer.types.includes(TRAY_DRAG)) return; e.preventDefault(); placeThing(toMm(e)); }}
            onDoubleClick={() => { if (tool === "corners" && corners.length >= 3) closeCorners(); }} onContextMenu={(e) => { e.preventDefault(); if (!corners.length && !drag) separateAt(toMm(e)); }}>
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
              const color = MATERIAL_BASE[ROOM_MATERIAL[(r.type ?? "other") as keyof typeof ROOM_MATERIAL] ?? "concrete"];
              return (
                <g key={i}>
                  <polygon points={r.polygon.map((q) => q.join(",")).join(" ")} fill={color} fillOpacity={bg ? 0.35 : 0.75} stroke="none" />
                  <text x={c[0]} y={c[1]} fontSize={fontMm} textAnchor="middle" dominantBaseline="middle" fill="#fff" stroke="#000" strokeWidth={fontMm * 0.18} paintOrder="stroke" style={{ pointerEvents: "none" }}>{r.name}</text>
                  <text x={c[0]} y={c[1] + fontMm * 1.2} fontSize={fontMm * 0.8} textAnchor="middle" dominantBaseline="middle" fill="#ddd" stroke="#000" strokeWidth={fontMm * 0.14} paintOrder="stroke" style={{ pointerEvents: "none" }}>{fmtArea(roomArea(r), lu)}</text>
                </g>
              );
            })}
            <WallPieces floor={floor} on={sel?.t === "wall" ? sel.i : null} px={px} fontMm={fontMm} units={lu}
              hot={hover && (tool === "remove" || tool === "eyedrop") && hitAt(hover)?.t === "wall" ? { i: hitAt(hover)!.i, col: tool === "remove" ? "#ff4d3d" : "#55b2ff" } : null} />
            {sel?.t === "room" && floor.rooms[sel.i] && <polygon points={floor.rooms[sel.i].polygon.map((q) => q.join(",")).join(" ")} fill="none" stroke="#ff6a1f" strokeWidth={3 * px} strokeDasharray={floor.rooms[sel.i].loose ? `${6 * px} ${4 * px}` : undefined} style={{ pointerEvents: "none" }} />}
            {(floor.fixtures ?? []).map((f, i) => {
              const across = f.facing === "east" || f.facing === "west";
              const w = (across ? f.depth_mm : f.width_mm) ?? 600, d = (across ? f.width_mm : f.depth_mm) ?? 600;
              const on = sel?.t === "thing" && sel.i === i;
              const [cx, cy] = f.center;
              const tip: Pt = f.facing === "north" ? [cx, cy - d / 2] : f.facing === "south" ? [cx, cy + d / 2] : f.facing === "east" ? [cx + w / 2, cy] : f.facing === "west" ? [cx - w / 2, cy] : [cx, cy];
              return (
                <g key={i}>
                  <rect x={cx - w / 2} y={cy - d / 2} width={w} height={d} fill="#f4efe6" fillOpacity={f.cab && f.elevation_mm ? 0.25 : 0.85} stroke={on ? "#ff6a1f" : "#17181b"} strokeWidth={(on ? 3 : 1.5) * px} strokeDasharray={f.cab && f.elevation_mm ? `${5 * px} ${3 * px}` : undefined} />
                  {nums.has(f) && Math.min(w, d) / px > 14 && <ItemBadge n={nums.get(f)!} r={fontMm * 0.5} hung={!!(f.cab && f.elevation_mm)} at={badgeSpot(f.center, [w / 2, d / 2], f.facing ? ANGLE_OF[f.facing] : null, !!(f.cab && f.elevation_mm))} />}
                  {f.facing && (!f.cab || on) && <line x1={cx} y1={cy} x2={tip[0]} y2={tip[1]} stroke="#ff6a1f" strokeWidth={2 * px} />}
                  {Math.min(w, d) / px > 26 && <text x={f.cab && !f.elevation_mm ? (cx + tip[0]) / 2 : cx} y={f.cab && !f.elevation_mm ? (cy + tip[1]) / 2 : cy} fontSize={fontMm * 0.7} fillOpacity={f.cab && f.elevation_mm ? 0.7 : 1} textAnchor="middle" dominantBaseline="middle" fill="#17181b" style={{ pointerEvents: "none" }}>{f.cab ? cabCode(f.cab, f.width_mm ?? 600, f.depth_mm ?? 600, f.height_mm ?? defaults(f.cab.fam).h) : (CATALOG[f.kind]?.label ?? f.kind).split(" ")[0]}</text>}
                </g>
              );
            })}
            {holeGs.map((g, i) => <StairHole key={`h${i}`} g={g} px={px} fontMm={fontMm} />)}
            {stairGs.map((g, i) => <StairSymbol key={`st${i}`} g={g} px={px} fontMm={fontMm} on={sel?.t === "stair" && sel.i === i} />)}
            {drag?.k === "stair" && <StairSymbol g={stairGeom(newStair(drag.a, stairTurn(drag)), rise)} px={px} fontMm={fontMm} on ghost />}
            {/* where the plumber is needed: water and drain at sinks, the dishwasher, toilets, tubs, showers */}
            {plumbingPoints(floor).map((q) => (
              <g key={`pl${q.i}`} transform={`translate(${q.at[0]} ${q.at[1]})`}>
                <title>{`Plumbing: ${q.what}. ${q.needs}.`}</title>
                <circle r={7 * px} fill="#55b2ff" stroke="#17181b" strokeWidth={1.5 * px} />
                <path d={`M0 ${-4 * px} C ${2.6 * px} ${-0.6 * px} ${3 * px} ${1 * px} ${3 * px} ${1.6 * px} A ${3 * px} ${3 * px} 0 0 1 ${-3 * px} ${1.6 * px} C ${-3 * px} ${1 * px} ${-2.6 * px} ${-0.6 * px} 0 ${-4 * px} Z`} fill="#fff" />
              </g>
            ))}
            {doorSpots.map((s, i) => s && <line key={`d${i}`} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={sel?.t === "door" && sel.i === i ? "#fff" : "#ff6a1f"} strokeWidth={7 * px} strokeLinecap="butt" />)}
            {winSpots.map((list, i) => list.map((s, k) => <line key={`w${i}-${k}`} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={sel?.t === "window" && sel.i === i ? "#fff" : "#8fd3f0"} strokeWidth={6 * px} />))}
            {room && !room.loose && room.polygon.map((q, k) => <rect key={k} x={q[0] - 5 * px} y={q[1] - 5 * px} width={10 * px} height={10 * px} fill="#ff6a1f" stroke="#fff" strokeWidth={px} />)}
            {/* push and pull: an arrow out of the room on each straight wall */}
            {handles.map((h) => {
              const on = drag?.k === "wall" && drag.e === h.e, ang = (Math.atan2(h.n[1], h.n[0]) * 180) / Math.PI;
              return (
                <g key={`h${h.e}`} transform={`translate(${h.at[0]} ${h.at[1]}) rotate(${ang}) scale(${px})`} style={{ cursor: Math.abs(h.n[0]) > 0.5 ? "ew-resize" : "ns-resize" }}>
                  <circle r={10} fill={on ? "#fff" : "#ff6a1f"} stroke={on ? "#ff6a1f" : "#fff"} strokeWidth={1.5} />
                  <path d="M-4.5 -5.5 L5.5 0 L-4.5 5.5 Z" fill={on ? "#ff6a1f" : "#fff"} />
                </g>
              );
            })}
            {drag?.k === "wall" && drag.moved && room && (() => {
              // live size of the room, and how far the wall has gone
              const b = bboxOf(room.polygon), c = centroid(room.polygon), h = handles.find((x) => x.e === drag.e), f = fontMm * 1.5;
              const size = `${fmtLen(b[2] - b[0], lu, true)} × ${fmtLen(b[3] - b[1], lu, true)}`;
              const by = h ? `${drag.by * (h.n[0] + h.n[1]) >= 0 ? "pulled out" : "pushed in"} ${fmtLen(Math.abs(drag.by), lu, true)}` : "";
              const w = Math.max(size.length, by.length) * f * 0.56;
              return (
                <g style={{ pointerEvents: "none" }} textAnchor="middle" dominantBaseline="middle">
                  <rect x={c[0] - w / 2} y={c[1] - f * 3.3} width={w} height={f * 2.5} rx={f * 0.3} fill="#17181b" fillOpacity={0.88} stroke="#ff6a1f" strokeWidth={1.5 * px} />
                  <text x={c[0]} y={c[1] - f * 2.6} fontSize={f} fill="#ff6a1f" fontWeight={700}>{size}</text>
                  <text x={c[0]} y={c[1] - f * 1.5} fontSize={f * 0.75} fill="#efe8da">{by}</text>
                </g>
              );
            })()}
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
            {tool === "corners" && (() => {
              // the walls so far, the one being drawn (with its length) and where it would end
              const last = corners[corners.length - 1], len = typed ? parseLength(typed, lu) : null;
              const next = hover && (last && len ? cornerAt(last, hover, len, std("draw.snapAngle")) : corners.length >= 3 && dist(hover, corners[0]) < 10 * px ? corners[0] : cornerSnap(hover));
              const mid: Pt | null = last && next ? [(last[0] + next[0]) / 2, (last[1] + next[1]) / 2] : null;
              return (
                <g style={{ pointerEvents: "none" }}>
                  {corners.length > 1 && <polyline points={corners.map((q) => q.join(",")).join(" ")} fill="none" stroke="#ff6a1f" strokeWidth={3 * px} strokeLinejoin="round" />}
                  {last && next && <line x1={last[0]} y1={last[1]} x2={next[0]} y2={next[1]} stroke="#ff6a1f" strokeWidth={2 * px} strokeDasharray={`${6 * px} ${4 * px}`} />}
                  {corners.length >= 2 && next && <line x1={next[0]} y1={next[1]} x2={corners[0][0]} y2={corners[0][1]} stroke="#55b2ff" strokeWidth={1.2 * px} strokeDasharray={`${3 * px} ${5 * px}`} />}
                  {corners.map((q, k) => <circle key={k} cx={q[0]} cy={q[1]} r={(k === 0 && corners.length >= 3 ? 7 : 4.5) * px} fill={k === 0 ? "#ff6a1f" : "#fff"} stroke={k === 0 ? "#fff" : "#ff6a1f"} strokeWidth={1.5 * px} />)}
                  {next && <circle cx={next[0]} cy={next[1]} r={4 * px} fill="none" stroke="#fff" strokeWidth={1.5 * px} />}
                  {mid && last && next && dist(last, next) > 1 && (
                    <text x={mid[0]} y={mid[1] - fontMm * 1.1} fontSize={fontMm * 1.35} fontWeight={700} textAnchor="middle" fill="#ff6a1f" stroke="#000" strokeWidth={fontMm * 0.2} paintOrder="stroke">{typed ? `${typed}▏` : fmtLen(dist(last, next), lu, true)}</text>
                  )}
                </g>
              );
            })()}
            {hover && (tool === "remove" || tool === "eyedrop") && (() => {
              // what a click would take out, or copy
              const it = hitAt(hover), col = tool === "remove" ? "#ff4d3d" : "#55b2ff";
              if (!it) return null;
              if (it.t === "room") return <polygon points={floor.rooms[it.i].polygon.map((q) => q.join(",")).join(" ")} fill={col} fillOpacity={0.18} stroke={col} strokeWidth={3 * px} style={{ pointerEvents: "none" }} />;
              if (it.t === "thing") { const f = floor.fixtures![it.i], [hw, hd] = halfSize(f); return <rect x={f.center[0] - hw} y={f.center[1] - hd} width={2 * hw} height={2 * hd} fill={col} fillOpacity={0.3} stroke={col} strokeWidth={3 * px} style={{ pointerEvents: "none" }} />; }
              if (it.t === "wall") return null;
              if (it.t === "stair") return <polygon points={stairGs[it.i].footprint.map((q) => q.join(",")).join(" ")} fill={col} fillOpacity={0.25} stroke={col} strokeWidth={3 * px} style={{ pointerEvents: "none" }} />;
              const segs = it.t === "door" ? [doorSpots[it.i]].filter(Boolean) as Seg[] : winSpots[it.i];
              return <g style={{ pointerEvents: "none" }}>{segs.map((s, k) => <line key={k} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={col} strokeWidth={9 * px} />)}</g>;
            })()}
            {hover && tool === "thing" && !drag && (() => {
              // where the picked-up thing would go
              const spec = CATALOG[thing.kind], ri = roomAt(hover), c: Pt = [r10(hover[0]), r10(hover[1])];
              const w = thing.w ?? spec?.w ?? 600, dp = thing.d ?? spec?.d ?? 600;
              const hug = ri >= 0 && spec?.mount !== "ceiling" ? hugWall(floor.rooms[ri].polygon, c, w, dp, 600) : null;
              const [hw, hd] = halfSize({ kind: thing.kind, center: c, width_mm: w, depth_mm: dp, facing: hug?.facing ?? facingFor(c, ri) });
              const at = hug?.center ?? c;
              return <rect x={at[0] - hw} y={at[1] - hd} width={2 * hw} height={2 * hd} fill={spec?.fill ?? "#f4efe6"} fillOpacity={0.55} stroke="#ff6a1f" strokeWidth={2 * px} strokeDasharray={`${5 * px} ${3 * px}`} style={{ pointerEvents: "none" }} />;
            })()}
            {/* a marker at each check on this floor */}
            {checks.open.filter((n) => n.floor === fi).map((n) => {
              // off the room's name when it would sit on it
              const onLabel = floor.rooms.some((r) => dist(centroid(r.polygon), n.at) < fontMm * 1.5);
              const at: Pt = onLabel ? [n.at[0], n.at[1] - fontMm * 1.6] : n.at;
              return (
              <g key={n.id} className="cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); pickNudge(n); }} onPointerUp={(e) => e.stopPropagation()}>
                <title>{n.title}</title>
                <circle cx={at[0]} cy={at[1]} r={(activeNudge === n.id ? 11 : 8) * px} fill={NUDGE_COLOR[n.severity]} stroke="#17181b" strokeWidth={2 * px} />
                <text x={at[0]} y={at[1]} fontSize={11 * px} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill="#17181b" style={{ pointerEvents: "none" }}>{n.severity === "warn" ? "!" : "i"}</text>
              </g>
              );
            })}
            <MarkLayer floor={floor} px={px} marks={sg.marks ?? (homeLit ? { rooms: floor.rooms.map((r, i) => (r.unit === homeLit ? i : -1)).filter((i) => i >= 0), things: [] } : null)} />
            {lib.ghost(px)}
          </svg>
          {!floor.rooms.length && !floor.walls?.length && !bg && !corners.length && (
            <p className="absolute inset-x-0 top-1/3 text-center text-muted text-[14px] pointer-events-none px-6">Pick Walls and draw around the first room. Rooms that touch share a wall.</p>
          )}
        </div>
        {show3d && (
          <div className="h-[44vh] xl:h-auto">
            <Live3D sketch={sk} fi={fi} sel={sel?.t === "room" || sel?.t === "thing" ? { t: sel.t, i: sel.i } : null} walls={walls3d} onWalls={setWalls3d}
              onPick={(f, s) => { if (f !== fi) { setFi(f); setClicks([]); setWall(null); } setSel(s); }}
              onFloor={(i) => { setFi(i); setSel(null); setClicks([]); setWall(null); }} roofOn={showRoof} onRoof={() => { setShowRoof((x) => !x); setShowStd(false); setShowBuild(false); }} marks={sg.locked ? sg.marks : null} build={build} />
          </div>
        )}
        </div>
        {tool === "thing" && <CatalogTray armed={thing} units={lu} startRoom={tabForRoom((sel?.t === "room" ? floor.rooms[sel.i] : hover ? floor.rooms[roomAt(hover)] : undefined)?.type)} onPick={(it) => { setThing(it); setNote(null); }} />}
        {seen && <WallView key={`${seen.room}-${seen.edge}`} nums={nums} floor={floor} room={seen.room} edge={seen.edge} height={floor.height_mm ?? std("house.ceiling")} units={lu} addOnOpen={wallAdd} onAdded={() => setWallAdd(null)} onChange={(f, h) => setFloor(f, h ?? true)} onClose={() => setWall(null)} onEdge={(edge) => setWall({ room: seen.room, edge })}
          armed={tool === "thing" ? itemLabel(thing) : null} onPlace={placeOnWall} />}
        </div>

        <aside className="border-t lg:border-t-0 lg:border-l border-line p-3 space-y-3 text-[13.5px] max-h-[62vh] overflow-y-auto scroll-thin">
          {showStd ? <StandardsPanel units={lu} focus={stdFocus} onClose={() => { setShowStd(false); setStdFocus(null); }} /> : showChecks ? (
            <ChecksPanel sk={sk} open={checksFirst(trade, checks.open)} ignored={checks.ignored} active={activeNudge} onPick={pickNudge} onStd={openStd} onClose={() => setShowChecks(false)}
              onIgnore={(n) => ignoreNudge(n.id, true)} onUnignore={(n) => ignoreNudge(n.id, false)} />
          ) : showBuild && onBuild ? (
            <div className="space-y-2">
              <BuildQuestions spec={build ?? {}} onSpec={onBuild} />
              {Object.keys(build ?? {}).length > 0 && <ol className="text-[12.5px] text-muted list-decimal pl-5 space-y-0.5" aria-label="The stages these answers make">{stagesFromSpec(build ?? {}).map((s) => <li key={s.key}>{s.name}</li>)}</ol>}
              <button className="btn btn-sm btn-ghost w-full" onClick={() => setShowBuild(false)}>Back to drawing</button>
            </div>
          ) : showRoof ? <RoofPanel sketch={sk} units={lu} onChange={(s, h) => (h === false ? setSk(s) : commit(s))} onClose={() => setShowRoof(false)} /> : <>
          {sg.clientPanel}
          {sg.as === "contractor" && !sg.locked && <>
            <TradePanel sk={sk} fi={fi} units={lu} open={checks.open} compact={!!sel} onChange={commit} onStd={openStd} onRoom={(f, i) => { setFi(f); setWall(null); setSel({ t: "room", i }); }} />
            {trade === "property" && !sel && <HomesPanel sk={sk} fi={fi} units={lu} lit={homeLit} onLight={setHomeLit} onChange={commit} onNote={setNote} onFloor={(i) => { setFi(i); setWall(null); }} />}
          </>}
          {sg.locked && <p className="text-[#55b2ff] leading-snug">This is your client&apos;s version, with their changes lit up. Approve them to put them in the plan.</p>}
          {lib.placing && <p className="text-accent leading-snug">Click on the plan where {lib.placing.item.name} goes. It snaps to the walls beside it. Esc to stop.</p>}
          <p className="text-muted leading-snug">{TOOLS.find((t) => t.id === tool)?.help}</p>
          {note && <p className="text-amber">{note}</p>}
          {ask && (
            <div className="rounded-md border border-amber p-2.5 space-y-1.5">
              <p className="text-amber leading-snug">{ask.text} Want it smaller?</p>
              {ask.options.map((o) => <button key={o.label} className="btn btn-sm w-full" onClick={() => { setFloor(o.floor); setSel({ t: "thing", i: o.sel }); setAsk(null); setNote(null); }}>{o.label}</button>)}
              <button className="btn btn-sm btn-ghost w-full" onClick={() => setAsk(null)}>Leave it out</button>
            </div>
          )}

          {tool === "cabinet" && !fix && <CabinetPanel pick={cabPick} onPick={setCabPick} floor={floor} units={lu} onCatalog={(at) => { openTrayAt(at); setTool("thing"); }} />}
          {tool === "thing" && (
            <p><span className="text-muted">Placing </span><span className="text-accent">{thing.label ?? CATALOG[thing.kind]?.label ?? thing.kind}</span>
              <span className="text-muted">, {fmtLen(thing.w ?? CATALOG[thing.kind]?.w ?? 600, lu)} × {fmtLen(thing.d ?? CATALOG[thing.kind]?.d ?? 600, lu)}</span></p>
          )}
          {tool === "eyedrop" && pickedType && <p>Copying <span className="text-accent">{label(pickedType).toLowerCase()}</span> to each room you click. Esc to stop.</p>}

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
                const b = bboxOf(room.polygon), rect = room.polygon.length === 4 && !room.loose;
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
                {sg.as === "contractor" && <button className="btn btn-sm" title="Keep this room with its furniture, doors and windows to use again" onClick={() => { saveToLibrary({ kind: "room", name: room.name, piece: pieceOf(floor, sel.i) }); setNote(`${room.name} is saved in your library.`); }}>Save to library</button>}
                {!room.loose && <button className="btn btn-sm" onClick={() => turn(true)} title="Turn the room and everything in it a quarter turn (Q, Shift+Q the other way)">Turn 90°</button>}
                <button className="btn btn-sm btn-ghost text-red" onClick={deleteSel}>Delete room</button>
              </div>
              {room.loose ? (
                <div className="space-y-1.5">
                  <p className="text-muted leading-snug">This room follows its walls: pick a wall to move it or change its length.</p>
                  <button className="btn btn-sm" onClick={() => setFloor(joinRoom(floor, sel.i))} title="Push and pull its walls as one room again">Join into a room</button>
                </div>
              ) : <button className="btn btn-sm" onClick={() => separate(sel.i)} title="Each wall becomes a piece of its own: move it, make it longer or shorter, or take it out (or right-click a wall)">Separate walls</button>}
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
          {stair && sel && (
            <StairPanel key={sel.i} st={stair} rise={rise} units={lu} onStart={() => past.current.push(sk)} onDelete={deleteSel} onStd={openStd}
              onChange={(x, h) => setFloor({ ...floor, stairs: floor.stairs!.map((y, i) => (i === sel.i ? x : y)) }, h ?? true)} />
          )}
          {sel?.t === "wall" && floor.walls?.[sel.i] && (
            <WallPanel key={sel.i} floor={floor} i={sel.i} units={lu} ceiling={floor.height_mm ?? std("house.ceiling")} onChange={(w) => setWalls(w)} onDelete={deleteSel}
              onJoin={(() => { const w = floor.walls![sel.i], ri = floor.rooms.findIndex((r) => r.loose && onOutline(w, r.polygon)); return ri >= 0 ? () => { setFloor(joinRoom(floor, ri)); setSel({ t: "room", i: ri }); } : null; })()}
              onCopy={() => { const w = floor.walls![sel.i], L = dist(w.a, w.b) || 1, o = 24 * INCH, n: Pt = [-(w.b[1] - w.a[1]) / L * o, (w.b[0] - w.a[0]) / L * o]; const c = { ...w, room: undefined, a: [w.a[0] + n[0], w.a[1] + n[1]] as Pt, b: [w.b[0] + n[0], w.b[1] + n[1]] as Pt }; setWalls([...floor.walls!, c]); setSel({ t: "wall", i: floor.walls!.length }); }} />
          )}
          {fix && sel && fix.cab && nums.has(fix) && <p className="text-[12px] text-muted -mb-1">Cabinet #{nums.get(fix)} in this room</p>}
          {fix && sel && fix.cab && <CabinetEdit fx={fix} units={lu} onDelete={deleteSel} onChange={(nx) => { const h = addHood({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? nx : f)) }, sel.i); setFloor(h.floor); if (h.added) setNote("A hood went in over it: the code wants one over a range or cooktop."); }} />}
          {fix && sel && !fix.cab && (
            <div className="space-y-2">
              <p className="eyebrow">{nums.has(fix) ? `#${nums.get(fix)} · ` : ""}{CATALOG[fix.kind]?.label ?? fix.kind}</p>
              <select className="input !h-9" value={fix.kind} aria-label="What it is" onChange={(e) => { const s = CATALOG[e.target.value]; setFloor({ ...floor, fixtures: floor.fixtures!.map((f, i) => (i === sel.i ? { ...f, kind: e.target.value, name: s?.label, width_mm: s?.w ?? f.width_mm, depth_mm: s?.d ?? f.depth_mm } : f)) }); }}>
                {ALL_KINDS.map((k) => <option key={k} value={k}>{CATALOG[k].label}</option>)}
                {!CATALOG[fix.kind] && <option value={fix.kind}>{fix.kind}</option>}
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
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => turn(true)} title="Q, Shift+Q the other way">Turn 90°</button>
                <button className="btn btn-sm btn-ghost text-red" onClick={deleteSel}>Delete</button>
              </div>
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
          {!sel && sg.as === "contractor" && !sg.locked && <>
            {trade !== "property" && <HomesPanel sk={sk} fi={fi} units={lu} lit={homeLit} onLight={setHomeLit} onChange={commit} onNote={setNote} onFloor={(i) => { setFi(i); setWall(null); }} />}
            <LibraryPanel sk={sk} floor={floor} units={lu} placingId={lib.placing?.item.id ?? null} onPlace={(it) => { setSel(null); setTool("select"); lib.start(it); }}
              onStart={(s, name) => { commit(flatten(s)); setFi(0); setSel(null); setView(null); setNote(`Started from ${name}. Undo takes you back.`); }} />
          </>}
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
        {sg.as === "client" ? <p className="flex-1 self-center text-muted text-[13px]">Your changes are suggestions. The plan changes when your contractor approves them.</p>
          : <button className="btn btn-primary flex-1" onClick={done} disabled={!allRooms || sg.locked}>{doneLabel}</button>}
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
