"use client";
// The plan in 3D. Two modes:
//  - "building": every floor stacked with a roof. Orbit around it; as you zoom in, the roof, the floors
//    above and the walls facing you open up so you see inside from the side. Keep zooming and the
//    floor under the cursor opens as the usual top view.
//  - "floor": one floor (or one room) as a model you can tilt and walk around, every object at its
//    real size. Click to select, drag a selected object to move it, right-click or use the pin tool
//    to drop a pin exactly where you clicked, on the floor, a wall or an object.
// Orbit covers a half sphere: any direction around, from straight above down to eye level.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { JobItem, Pin, PinInput } from "@/lib/data/types";
import { floorBBox, frontView, labelPoint, pointInPoly, roomSides, sidePoint, unionBBox, type WallSide } from "@/lib/plan/geometry";
import type { ElementStatus, Floor, Opening, Plan, Pt, Room } from "@/lib/plan/types";
import type { ColorMode } from "./FloorCanvas";
import { hitTest } from "./FloorCanvas";
import { HIDDEN_KINDS, TOP_FILL, isWallMounted } from "./fixtures";
import { ITEM_SIZE } from "./items";
import { fixtureObject, Materials, SHARED_GEOMETRY } from "./models3d";
import { CHALK, GLASS, MATERIAL_BASE, PIN_COLOR, ROOM_MATERIAL, STATUS_COLOR, type Material } from "./style";
import type { Controls, PinTarget, ScreenPoint } from "./target";

const S = 0.001;

/** how much of the walls to draw: all of them, waist height, or none (to see what's inside) */
export type WallMode = "full" | "low" | "none";

interface Props {
  plan: Plan;
  mode: "building" | "floor";
  floor: Floor | null;
  room: Room | null;
  selected: string | null;
  selectedPin: string | null;
  selectedItem: string | null;
  states: Map<string, ElementStatus>;
  colorMode: ColorMode;
  pins: Pin[];
  items: JobItem[];
  pinMode: boolean;
  draft: PinTarget | null;
  wallMode: WallMode;
  /** leave out the objects and wall items: just the rooms, walls and floors */
  empty?: boolean;
  /** look but don't move anything (shared links, the new-project review) */
  locked?: boolean;
  controls: Controls;
  onSelect: (id: string | null) => void;
  onSelectPin: (id: string) => void;
  onSelectItem: (id: string) => void;
  onPlacePin: (t: PinTarget, at: ScreenPoint) => void;
  onMoveFixture: (id: string, dx: number, dy: number) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onMovePin: (id: string, input: Partial<PinInput>) => void;
  onOpenFloor: (floorId: string) => void;
  onLimitOut: () => void;
}

type Pick = { type: "fixture" | "wall" | "opening" | "room" | "stair" | "item" | "pin" | "roof"; id: string; floorId: string };
type Fade = { mats: THREE.Material[]; centre: THREE.Vector3; floorIndex: number; role: "wall" | "roof" | "slab" | "thing" };

// --------------------------------------------------------------------------- geometry helpers

function extrude(poly: Pt[], y0: number, y1: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * S, -y * S)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, (y1 - y0) * S), bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0 * S, 0);
  return geo;
}

function flat(poly: Pt[], y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, py]) => new THREE.Vector2(x * S, -py * S)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y * S, 0);
  return geo;
}

function label(text: string, opts: { color?: string; bg?: string; size?: number } = {}): THREE.Sprite {
  const c = document.createElement("canvas");
  const fs = 44;
  const ctx = c.getContext("2d")!;
  ctx.font = `800 ${fs}px "Barlow Condensed", system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  c.width = w; c.height = fs + 22;
  const x = c.getContext("2d")!;
  if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, c.width, c.height); }
  x.font = `800 ${fs}px "Barlow Condensed", system-ui, sans-serif`;
  x.fillStyle = opts.color ?? "#f4efe6";
  x.textBaseline = "middle";
  x.fillText(text, 14, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // a fixed size on screen, so labels stay readable close up and far away
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  const k = (opts.size ?? 0.024) / c.height;
  sp.scale.set(c.width * k, c.height * k, 1);
  sp.renderOrder = 10;
  return sp;
}

const openTop = (o: Opening) => (o.kind === "garage_door" ? 2300 : o.kind === "opening" ? 2400 : 2100);
const openBottom = (o: Opening) => (o.kind === "window" ? 900 : 0);

// the 2D plan's floor patterns (boards, tiles, carpet), drawn once to a canvas and laid at true size
const PATTERN: Record<Material, { w: number; h: number; draw: (g: CanvasRenderingContext2D, k: number) => void }> = {
  oak: { w: 1800, h: 480, draw: (g, k) => { g.fillStyle = MATERIAL_BASE.oak; g.fillRect(0, 0, 1800 * k, 480 * k); g.fillStyle = "#a5835d"; g.fillRect(0, 160 * k, 1800 * k, 160 * k); lines(g, k, "#6f5338", 9, "M0 0H1800M0 160H1800M0 320H1800M420 0V160M1260 0V160M0 160V320M900 160V320M600 320V480M1500 320V480"); } },
  walnut: { w: 1500, h: 420, draw: (g, k) => { g.fillStyle = MATERIAL_BASE.walnut; g.fillRect(0, 0, 1500 * k, 420 * k); g.fillStyle = "#76563c"; g.fillRect(0, 140 * k, 1500 * k, 140 * k); lines(g, k, "#4a3424", 9, "M0 0H1500M0 140H1500M0 280H1500M300 0V140M1100 0V140M700 140V280M0 280V420M1300 280V420"); } },
  tile: { w: 600, h: 600, draw: (g, k) => { g.fillStyle = MATERIAL_BASE.tile; g.fillRect(0, 0, 600 * k, 600 * k); g.fillStyle = "#96a2a5"; g.fillRect(0, 0, 300 * k, 300 * k); g.fillRect(300 * k, 300 * k, 300 * k, 300 * k); lines(g, k, "#6e797c", 14, "M0 0H600M0 300H600M0 0V600M300 0V600"); } },
  bathtile: { w: 200, h: 200, draw: (g, k) => { g.fillStyle = MATERIAL_BASE.bathtile; g.fillRect(0, 0, 200 * k, 200 * k); lines(g, k, "#7f9599", 8, "M0 0H200M0 100H200M0 0V200M100 0V200"); } },
  concrete: { w: 900, h: 900, draw: (g, k) => { g.fillStyle = MATERIAL_BASE.concrete; g.fillRect(0, 0, 900 * k, 900 * k); g.fillStyle = "#5f5d58"; for (const [x, y, rr] of [[120, 200, 18], [420, 520, 22], [260, 780, 10], [610, 90, 12], [760, 700, 14]]) { g.beginPath(); g.arc(x * k, y * k, rr * k, 0, 7); g.fill(); } lines(g, k, "#5a5853", 10, "M0 0H900M0 0V900"); } },
  carpet: { w: 120, h: 120, draw: (g, k) => { g.fillStyle = MATERIAL_BASE.carpet; g.fillRect(0, 0, 120 * k, 120 * k); g.fillStyle = "#777c8f"; g.beginPath(); g.arc(30 * k, 30 * k, 9 * k, 0, 7); g.fill(); g.fillStyle = "#686d7f"; g.beginPath(); g.arc(90 * k, 90 * k, 9 * k, 0, 7); g.fill(); } },
  deck: { w: 1200, h: 300, draw: (g, k) => { g.fillStyle = MATERIAL_BASE.deck; g.fillRect(0, 0, 1200 * k, 300 * k); lines(g, k, "#4d3a2a", 20, "M0 0H1200M0 150H1200"); } },
};
/** Strokes an SVG-style path of M, H and V commands (the 2D patterns' grout and board lines), in mm. */
function lines(g: CanvasRenderingContext2D, k: number, color: string, width: number, d: string) {
  g.strokeStyle = color;
  g.lineWidth = width * k;
  g.beginPath();
  let x = 0, y = 0;
  for (const [, cmd, a, b] of d.matchAll(/([MHV])(-?\d+)(?:\s+(-?\d+))?/g)) {
    if (cmd === "M") { x = +a; y = +b; g.moveTo(x * k, y * k); continue; }
    if (cmd === "H") x = +a; else y = +a;
    g.lineTo(x * k, y * k);
  }
  g.stroke();
}
const patternCanvas = new Map<Material, HTMLCanvasElement>();
function floorTexture(mat: Material): THREE.Texture {
  const pt = PATTERN[mat];
  let c = patternCanvas.get(mat);
  if (!c) {
    const k = 512 / Math.max(pt.w, pt.h);
    c = document.createElement("canvas");
    c.width = Math.round(pt.w * k); c.height = Math.round(pt.h * k);
    pt.draw(c.getContext("2d")!, k);
    patternCanvas.set(mat, c);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / (pt.w * S), 1 / (pt.h * S)); // the floor's UVs are in metres
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dispose(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.geometry && !SHARED_GEOMETRY.has(m.geometry)) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mt of mats) {
      if ((mt as THREE.Material).userData.shared) continue;
      const map = (mt as THREE.SpriteMaterial).map;
      if (map) map.dispose();
      mt.dispose();
    }
  });
}

// --------------------------------------------------------------------------- scene building

interface Built {
  root: THREE.Group;
  picks: THREE.Object3D[];
  byId: Map<string, THREE.Object3D>;
  fades: Fade[];
  floors: { id: string; y0: number; y1: number }[];
  /** for camera framing, metres */
  centre: THREE.Vector3;
  radius: number;
  /** pin labels, resized every frame: nearer pins read bigger, farther ones smaller */
  pinLabels: THREE.Sprite[];
}

function wallMaterial(color: string) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 1 });
  return m;
}

function buildScene(p: Props, mt: Materials): Built {
  const root = new THREE.Group();
  const picks: THREE.Object3D[] = [];
  const byId = new Map<string, THREE.Object3D>();
  const fades: Fade[] = [];
  const floorsAll = [...p.plan.floors].sort((a, b) => a.level - b.level);
  const shown = p.mode === "building" ? floorsAll : p.floor ? [p.floor] : [];
  const prog = p.colorMode === "progress";
  const statusTint = (id: string, fallback: string) => (prog ? (p.states.get(id) ? STATUS_COLOR[p.states.get(id)!] : "#5d5a53") : fallback);
  const floorsMeta: Built["floors"] = [];
  const pick = (o: THREE.Object3D, data: Pick) => { o.userData.pick = data; picks.push(o); byId.set(data.id, o); };

  const roomBox = p.room ? p.room.polygon.reduce((a, q) => [Math.min(a[0], q[0] - 300), Math.min(a[1], q[1] - 300), Math.max(a[2], q[0] + 300), Math.max(a[3], q[1] + 300)], [Infinity, Infinity, -Infinity, -Infinity]) : [0, 0, 0, 0];
  // a room seen from above in the 2D plan's colours: each object in its top-view colour
  const roomTint = new Map<string, Materials>();
  shown.forEach((fl) => {
    const fi = floorsAll.indexOf(fl);
    // a floor sits at its real height in both views, so an upper floor never looks like the ground floor
    const base = fl.elevation_mm || fi * (p.plan.building.exterior.storey_height_mm || 3000);
    const H = fl.height_mm || 2700;
    const wallH = p.wallMode === "low" ? 1100 : H;
    const walls = p.wallMode !== "none";
    floorsMeta.push({ id: fl.id, y0: base * S, y1: (base + H) * S });
    const g = new THREE.Group();
    g.position.y = base * S;
    root.add(g);
    const thing = (o: THREE.Object3D, centre: THREE.Vector3) => {
      const mats: THREE.Material[] = [];
      o.traverse((x) => { const m = (x as THREE.Mesh).material; if (m) for (const mm of Array.isArray(m) ? m : [m]) mats.push(mm); });
      fades.push({ mats, centre, floorIndex: fi, role: "thing" });
    };

    // an upper floor on its own stands on the floors below it, drawn as plain blocks
    if (p.mode === "floor") {
      const below = floorsAll.slice(0, fi);
      below.forEach((lf, li) => {
        const lb = lf.elevation_mm || li * (p.plan.building.exterior.storey_height_mm || 3000);
        const lh = Math.max(200, base - lb);
        const rings = lf.footprint.length ? lf.footprint : [[[lf.bounds[0], lf.bounds[1]], [lf.bounds[2], lf.bounds[1]], [lf.bounds[2], lf.bounds[3]], [lf.bounds[0], lf.bounds[3]]] as Pt[]];
        for (const ring of rings) {
          const block = new THREE.Mesh(extrude(ring, lb - base, lb - base + lh - 20), wallMaterial(li % 2 ? "#3b3a36" : "#45433e"));
          block.receiveShadow = true;
          g.add(block);
        }
      });
    }
    // slab under the floor, so stacked floors read as storeys
    if (p.mode === "building" || fi > 0) {
      for (const ring of fl.footprint.length ? fl.footprint : [[[fl.bounds[0], fl.bounds[1]], [fl.bounds[2], fl.bounds[1]], [fl.bounds[2], fl.bounds[3]], [fl.bounds[0], fl.bounds[3]]] as Pt[]]) {
        const m = wallMaterial("#8e877a");
        const slab = new THREE.Mesh(extrude(ring, -200, 0), m);
        slab.receiveShadow = true;
        g.add(slab);
        const b = floorBBox(fl);
        fades.push({ mats: [m], centre: new THREE.Vector3(((b[0] + b[2]) / 2) * S, base * S, ((b[1] + b[3]) / 2) * S), floorIndex: fi, role: "slab" });
        // a flat roof over this floor wherever the floor above doesn't cover it (a garage, a porch)
        if (p.mode === "building" && fi < floorsAll.length - 1 && p.wallMode === "full") {
          const rm = wallMaterial("#4a4844");
          const roofSlab = new THREE.Mesh(extrude(ring, H, H + 160), rm);
          roofSlab.castShadow = true;
          g.add(roofSlab);
          fades.push({ mats: [rm], centre: new THREE.Vector3(((b[0] + b[2]) / 2) * S, (base + H) * S, ((b[1] + b[3]) / 2) * S), floorIndex: fi, role: "roof" });
        }
      }
    }

    // room floors in their material
    for (const r of fl.rooms) {
      const mat = ROOM_MATERIAL[r.type] ?? "concrete";
      const patterned = p.mode === "floor" && !prog;
      const m = new THREE.MeshStandardMaterial({ color: patterned ? "#ffffff" : statusTint(r.id, MATERIAL_BASE[mat]), map: patterned ? floorTexture(mat) : null, roughness: 0.85, transparent: true });
      if (p.room && r.id !== p.room.id) { m.opacity = 0.35; }
      const mesh = new THREE.Mesh(flat(r.polygon, 2), m);
      mesh.receiveShadow = true;
      g.add(mesh);
      pick(mesh, { type: "room", id: r.id, floorId: fl.id });
      const lp = labelPoint(r.polygon);
      fades.push({ mats: [m], centre: new THREE.Vector3(lp[0] * S, base * S, lp[1] * S), floorIndex: fi, role: "slab" });
      if (p.mode === "floor" && !p.room) {
        const sp = label(r.name.toUpperCase(), { color: "#f4efe6", size: 0.022 });
        sp.position.set(lp[0] * S, 0.05, lp[1] * S);
        sp.material.opacity = 0.85;
        g.add(sp);
      }
    }

    // walls
    const near = (poly: Pt[]) => !p.room || poly.some((q) => q[0] >= roomBox[0] && q[0] <= roomBox[2] && q[1] >= roomBox[1] && q[1] <= roomBox[3]);
    for (const w of walls ? fl.walls.filter((x) => near(x.polygon)) : []) {
      const color = statusTint(w.id, w.exterior && p.mode === "building" ? "#d6ccb9" : "#efe8da");
      const m = wallMaterial(color);
      const mesh = new THREE.Mesh(extrude(w.polygon, 0, wallH), m);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      pick(mesh, { type: "wall", id: w.id, floorId: fl.id });
      const c = w.polygon.reduce((a, q) => [a[0] + q[0] / w.polygon.length, a[1] + q[1] / w.polygon.length], [0, 0]);
      fades.push({ mats: [m], centre: new THREE.Vector3(c[0] * S, (base + H / 2) * S, c[1] * S), floorIndex: fi, role: "wall" });
    }

    // doors and windows: header above, sill below, glass in a window
    for (const o of walls ? fl.openings.filter((x) => near(x.polygon)) : []) {
      const og = new THREE.Group();
      const m = wallMaterial(statusTint(o.id, o.exterior && p.mode === "building" ? "#d6ccb9" : "#efe8da"));
      const top = openTop(o), bot = openBottom(o);
      if (top < wallH) { const h = new THREE.Mesh(extrude(o.polygon, top, wallH), m); h.castShadow = true; og.add(h); }
      if (bot > 0) og.add(new THREE.Mesh(extrude(o.polygon, 0, Math.min(bot, wallH)), m));
      const gm = new THREE.MeshStandardMaterial({ color: GLASS, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1, depthWrite: false });
      if (o.kind === "window" || o.kind === "sliding_door") {
        if (Math.min(top, wallH) > bot) og.add(new THREE.Mesh(extrude(o.polygon, bot, Math.min(top, wallH)), gm));
      } else if (o.kind === "door" || o.kind === "double_door" || o.kind === "garage_door") {
        // a thin closed door in the frame, so doors read as doors
        const dm = new THREE.MeshStandardMaterial({ color: o.kind === "garage_door" ? "#c9c2b4" : "#8a6a48", roughness: 0.7, transparent: true });
        const dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L, t = 20;
        const leaf: Pt[] = [[o.a[0] + nx * t, o.a[1] + ny * t], [o.b[0] + nx * t, o.b[1] + ny * t], [o.b[0] - nx * t, o.b[1] - ny * t], [o.a[0] - nx * t, o.a[1] - ny * t]];
        if (p.mode === "building" || o.kind === "garage_door") og.add(new THREE.Mesh(extrude(leaf, 0, Math.min(top, wallH)), dm));
        fades.push({ mats: [dm], centre: new THREE.Vector3(((o.a[0] + o.b[0]) / 2) * S, (base + 1000) * S, ((o.a[1] + o.b[1]) / 2) * S), floorIndex: fi, role: "wall" });
      }
      g.add(og);
      pick(og, { type: "opening", id: o.id, floorId: fl.id });
      const c = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
      fades.push({ mats: [m, gm], centre: new THREE.Vector3(c[0] * S, (base + H / 2) * S, c[1] * S), floorIndex: fi, role: "wall" });
    }

    // stairs: a flight of steps across the stair outline
    for (const st of fl.stairs) {
      const b = st.polygon.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]);
      const sg = new THREE.Group();
      const n = Math.max(6, Math.round(H / 185));
      const alongX = b[2] - b[0] > b[3] - b[1];
      const L = alongX ? b[2] - b[0] : b[3] - b[1];
      const m = mt.get("#8a6a48");
      for (let i = 0; i < n; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(alongX ? (L / n) * S : (b[2] - b[0]) * S, ((i + 1) * H / n) * S, alongX ? (b[3] - b[1]) * S : (L / n) * S), m);
        step.castShadow = step.receiveShadow = true;
        const t = (i + 0.5) / n;
        step.position.set(alongX ? (b[0] + L * t) * S : ((b[0] + b[2]) / 2) * S, ((i + 1) * H / n / 2) * S, alongX ? ((b[1] + b[3]) / 2) * S : (b[1] + L * t) * S);
        sg.add(step);
      }
      g.add(sg);
      pick(sg, { type: "stair", id: st.id, floorId: fl.id });
    }

    // fixtures at real size
    // each storey gets its own materials in the building, so the floors above can fade on their own
    const fm = prog ? null : p.mode === "building" ? new Materials() : mt;
    if (fm && fm !== mt) g.userData.ownMaterials = fm;
    // a room's own view shows just that room's things
    for (const f of p.empty ? [] : p.room ? fl.fixtures.filter((x) => x.room_id ? x.room_id === p.room!.id : pointInPoly(x.center, p.room!.polygon)) : fl.fixtures) {
      if (HIDDEN_KINDS.has(f.kind)) continue;
      let tintMt = prog ? new Materials(p.states.get(f.id) ? STATUS_COLOR[p.states.get(f.id)!] : "#77736a") : fm!;
      if (!prog && p.room && TOP_FILL[f.kind]) {
        if (!roomTint.has(f.kind)) roomTint.set(f.kind, new Materials(TOP_FILL[f.kind]));
        tintMt = roomTint.get(f.kind)!;
      }
      const o = fixtureObject(f, tintMt, 0);
      if (prog) o.userData.ownMaterials = tintMt;
      // from above, wall cabinets and hoods would hide the counter: see through them, like the 2D plan
      if (!prog && p.room && isWallMounted(f)) {
        if (!roomTint.has("ghost")) roomTint.set("ghost", new Materials());
        const ghost = roomTint.get("ghost")!.get("#d9d2c4", { opacity: 0.12 });
        o.traverse((x) => { if ((x as THREE.Mesh).isMesh) { (x as THREE.Mesh).material = ghost; x.castShadow = false; } });
      }
      g.add(o);
      pick(o, { type: "fixture", id: f.id, floorId: fl.id });
      thing(o, new THREE.Vector3(f.center[0] * S, base * S, f.center[1] * S));
    }

    // things on the walls: outlets, switches, lights
    const sides = new Map<string, WallSide>();
    for (const r of fl.rooms) for (const s of roomSides(fl, r)) sides.set(s.key, s);
    for (const it of p.empty ? [] : p.items) {
      const side = sides.get(it.side);
      if (!side) continue;
      const [w, h] = ITEM_SIZE[it.kind];
      const pt = sidePoint(side, it.x, 8);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 70) * S, Math.max(h, 70) * S, 0.014), new THREE.MeshStandardMaterial({ color: it.id === p.selectedItem ? CHALK : "#fbf8f1", roughness: 0.4, transparent: true }));
      plate.position.set(pt[0] * S, it.y * S, pt[1] * S);
      plate.lookAt(plate.position.x + side.inward[0], plate.position.y, plate.position.z + side.inward[1]);
      plate.castShadow = true;
      g.add(plate);
      pick(plate, { type: "item", id: it.id, floorId: fl.id });
      plate.userData.side = side;
      thing(plate, new THREE.Vector3(pt[0] * S, base * S, pt[1] * S));
    }

    // pins as flags
    for (const pin of p.pins) {
      const at = pinPosition(p.plan, fl, sides, pin);
      if (!at) continue;
      const flag = pinFlag(String(pin.number), PIN_COLOR[pin.kind], pin.status === "done", pin.id === p.selectedPin);
      flag.position.set(at.x, at.y, at.z);
      if (at.side) flag.userData.side = at.side;
      g.add(flag);
      pick(flag, { type: "pin", id: pin.id, floorId: fl.id });
      thing(flag, new THREE.Vector3(at.x, base * S, at.z));
    }
    if (p.draft && (p.draft.floorId === fl.id || (p.draft.anchor?.view === "wall" && sides.has(p.draft.anchor.side ?? "")))) {
      const fake = { id: "draft", anchor: p.draft.anchor, element_id: p.draft.elementId, floor_id: p.draft.floorId, x: p.draft.x, y: p.draft.y } as unknown as Pin;
      const at = pinPosition(p.plan, fl, sides, fake);
      if (at) { const d = pinFlag("+", "#ff6a1f", false, true); d.position.set(at.x, at.y, at.z); g.add(d); }
    }
  });

  // pins on the outside of the building (roof, outside walls), placed in this view
  if (p.mode === "building" && floorsAll.length) {
    const pts = p.pins.filter((q) => q.anchor?.view === "point").map((q) => ({ pin: q as Pin | null, a: q.anchor! }));
    if (p.draft?.anchor?.view === "point") pts.push({ pin: null, a: p.draft.anchor });
    for (const { pin, a } of pts) {
      const flag = pin ? pinFlag(String(pin.number), PIN_COLOR[pin.kind], pin.status === "done", pin.id === p.selectedPin) : pinFlag("+", "#ff6a1f", false, true);
      flag.position.set(a.x * S, (a.z ?? 0) * S, a.y * S);
      root.add(flag);
      if (pin) pick(flag, { type: "pin", id: pin.id, floorId: pin.floor_id ?? floorsAll[0].id });
    }
  }

  // roof over the top floor, in the shape the reader guessed (gable, hip or flat). A top floor that
  // isn't close to a rectangle gets a flat roof that follows its outline instead of a box over the air.
  if (p.mode === "building" && floorsAll.length && p.wallMode === "full") {
    const top = floorsAll[floorsAll.length - 1];
    const ti = floorsAll.length - 1;
    const b = floorBBox(top);
    const base = (top.elevation_mm || ti * (p.plan.building.exterior.storey_height_mm || 3000)) + (top.height_mm || 2700);
    const rings = top.footprint.length ? top.footprint : [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]] as Pt[]];
    const area = rings.reduce((a, r) => a + Math.abs(r.reduce((q, pt, i) => { const n = r[(i + 1) % r.length]; return q + pt[0] * n[1] - n[0] * pt[1]; }, 0)) / 2, 0);
    const boxy = area / Math.max(1, (b[2] - b[0]) * (b[3] - b[1])) > 0.85;
    const kind = p.plan.building.exterior.roof;
    const m = new THREE.MeshStandardMaterial({ color: "#3a3a3c", roughness: 0.8, transparent: true, side: THREE.DoubleSide });
    const roof = new THREE.Group();
    if (kind === "flat" || !boxy) {
      for (const ring of rings) { const slab = new THREE.Mesh(extrude(ring, 0, 220), m); slab.castShadow = true; roof.add(slab); }
      roof.position.set(0, base * S, 0);
    } else {
      const w = (b[2] - b[0] + 900) * S, d = (b[3] - b[1] + 900) * S;
      const alongX = w >= d;
      const span = alongX ? d : w, len = alongX ? w : d;
      const peak = Math.min(3.2, span * 0.35);
      let geo: THREE.BufferGeometry;
      if (kind === "hip") {
        const L = len / 2, H2 = span / 2, r = Math.max(0, len - span) / 2;
        const A = [-L, 0, -H2], B = [L, 0, -H2], C = [L, 0, H2], D = [-L, 0, H2], R1 = [-r, peak, 0], R2 = [r, peak, 0];
        const tris = [D, C, R2, D, R2, R1, B, A, R1, B, R1, R2, A, D, R1, C, B, R2];
        geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
        geo.computeVertexNormals();
      } else {
        const tri = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, peak)]);
        geo = new THREE.ExtrudeGeometry(tri, { depth: len, bevelEnabled: false });
        geo.translate(0, 0, -len / 2);
        geo.rotateY(Math.PI / 2);
      }
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = true;
      // hip geometry runs along x already; the gable was turned to run along x above
      if (!alongX) mesh.rotation.y = Math.PI / 2;
      roof.add(mesh);
      roof.position.set(((b[0] + b[2]) / 2) * S, base * S, ((b[1] + b[3]) / 2) * S);
    }
    root.add(roof);
    fades.push({ mats: [m], centre: new THREE.Vector3(((b[0] + b[2]) / 2) * S, base * S, ((b[1] + b[3]) / 2) * S), floorIndex: floorsAll.length, role: "roof" });
    roof.traverse((o) => { if ((o as THREE.Mesh).isMesh) pick(o, { type: "roof", id: o === roof.children[0] ? "roof" : `roof-${o.id}`, floorId: top.id }); });
  }

  // framing
  let bb = p.mode === "building" ? unionBBox(floorsAll.map(floorBBox)) : p.floor ? floorBBox(p.floor) : [0, 0, 10000, 10000];
  if (p.mode === "floor" && p.room) bb = p.room.polygon.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const totalH = p.mode === "building" ? floorsMeta.length ? floorsMeta[floorsMeta.length - 1].y1 : 3 : 0;
  const centre = new THREE.Vector3(((bb[0] + bb[2]) / 2) * S, p.mode === "building" ? totalH * 0.3 : floorsMeta[0]?.y0 ?? 0, ((bb[1] + bb[3]) / 2) * S);
  const radius = Math.max(2, (Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2) * S, totalH / 2);
  // the room view's colour sets are freed with the scene
  roomTint.forEach((m) => { const holder = new THREE.Object3D(); holder.userData.ownMaterials = m; root.add(holder); });
  const pinLabels: THREE.Sprite[] = [];
  root.traverse((o) => { if (o.userData.pinLabel) pinLabels.push(o as THREE.Sprite); });
  return { root, picks, byId, fades, floors: floorsMeta, centre, radius, pinLabels };
}

function pinPosition(plan: Plan, fl: Floor, sides: Map<string, WallSide>, pin: Pin): { x: number; y: number; z: number; side?: WallSide } | null {
  if (pin.anchor?.view === "wall") {
    const side = sides.get(pin.anchor.side ?? "");
    if (!side) return null;
    const pt = sidePoint(side, pin.anchor.x, 40);
    return { x: pt[0] * S, y: -pin.anchor.y * S, z: pt[1] * S, side };
  }
  if (pin.anchor) return null; // site and outside pins live in those views
  let pt: Pt | null = pin.x != null && pin.y != null ? [pin.x, pin.y] : null;
  const onFloor = pin.floor_id === fl.id || (pin.element_id?.startsWith(fl.id + "-") ?? false);
  if (!onFloor) return null;
  let y = 0;
  if (pin.element_id) {
    const f = fl.fixtures.find((x) => x.id === pin.element_id);
    if (f) { if (!pt) pt = f.center; y = (f.elevation_mm ?? 0) + (f.height_mm ?? 850); }
    if (!pt) {
      const r = fl.rooms.find((x) => x.id === pin.element_id);
      const w = fl.walls.find((x) => x.id === pin.element_id);
      const o = fl.openings.find((x) => x.id === pin.element_id);
      if (r) pt = labelPoint(r.polygon);
      else if (w) { pt = w.polygon.reduce((a, q) => [a[0] + q[0] / w.polygon.length, a[1] + q[1] / w.polygon.length], [0, 0] as Pt); y = 1400; }
      else if (o) { pt = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2]; y = 1200; }
    }
  }
  void plan;
  return pt ? { x: pt[0] * S, y: y * S, z: pt[1] * S } : null;
}

const poleGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 8);
SHARED_GEOMETRY.add(poleGeo);
function pinFlag(text: string, color: string, done: boolean, selected: boolean): THREE.Group {
  const g = new THREE.Group();
  const pm = new THREE.MeshStandardMaterial({ color: selected ? CHALK : "#1b1a17", roughness: 0.5 });
  const pole = new THREE.Mesh(poleGeo, pm);
  pole.scale.y = 0.75;
  pole.position.y = 0.375;
  g.add(pole);
  const sp = label(`${text}`, { color: "#141310", bg: done ? "#9c978d" : color, size: selected ? 0.034 : 0.028 });
  sp.position.y = 0.82;
  sp.center.set(0, 0.5);
  sp.userData.pinLabel = true;
  sp.userData.base = sp.scale.clone();
  g.add(sp);
  // generous invisible hit target
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, 0.22), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.47;
  hit.userData.hit = true;
  g.add(hit);
  return g;
}

// --------------------------------------------------------------------------- the component

export function Plan3D(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(p);
  cb.current = p;
  const three = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    built: Built | null; mt: Materials; sel: THREE.Box3Helper; focus: number; hoverFloor: string | null; sun: THREE.DirectionalLight; lockUntil: number;
  } | null>(null);

  // one renderer for the life of the view
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#121315");
    scene.fog = new THREE.Fog("#121315", 60, 160);
    scene.add(new THREE.HemisphereLight("#e8eef5", "#3a3730", 1.1));
    const sun = new THREE.DirectionalLight("#fff3df", 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ color: "#1d1f1b", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.21;
    ground.receiveShadow = true;
    scene.add(ground);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // never below the ground: a half sphere
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    const sel = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(CHALK));
    sel.visible = false;
    (sel.material as THREE.Material).depthTest = false;
    sel.renderOrder = 20;
    // a see-through glow inside the outline, so what's selected (and so draggable) is easy to spot
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial({ color: CHALK, transparent: true, opacity: 0.18, depthWrite: false, depthTest: false }));
    glow.renderOrder = 19;
    sel.add(glow);
    scene.add(sel);
    const mt = new Materials();
    three.current = { renderer, scene, camera, controls, built: null, mt, sel, focus: 0, hoverFloor: null, sun, lockUntil: 0 };

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    const tmp = new THREE.Vector3();
    const tick = () => {
      controls.update();
      cutaway();
      // pins scale with distance, within limits: the ones nearer you (higher up, further out) read bigger
      const b = three.current?.built;
      if (b) {
        const ref = b.radius * 2.3;
        for (const sp of b.pinLabels) {
          const d = camera.position.distanceTo(sp.getWorldPosition(tmp)) || 1;
          sp.scale.copy(sp.userData.base as THREE.Vector3).multiplyScalar(Math.min(1.9, Math.max(0.5, ref / d)));
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      if (three.current?.built) dispose(three.current.built.root);
      mt.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  /** Open up what stands between you and the inside, more the closer you get. */
  function cutaway() {
    const t = three.current;
    if (!t?.built) return;
    const { camera, controls, built } = t;
    const target = controls.target;
    const dist = camera.position.distanceTo(target);
    const R = built.radius;
    const dir = new THREE.Vector3(camera.position.x - target.x, 0, camera.position.z - target.z);
    const polar = controls.getPolarAngle();
    dir.normalize();
    const building = cb.current.mode === "building";
    // 0 = closed up, 1 = fully open
    const open = building ? THREE.MathUtils.clamp((R * 2.7 - dist) / (R * 1.1), 0, 1) : polar < 0.3 ? 0 : THREE.MathUtils.clamp((polar - 0.3) / 0.4, 0, 1);
    const focus = t.focus;
    for (const f of built.fades) {
      let o = 1;
      const toward = (f.centre.x - target.x) * dir.x + (f.centre.z - target.z) * dir.z;
      if (building) {
        // a doll's house: the roof lifts off and the walls facing you fall away on every floor at once,
        // so all the floors show stacked; the floor under the cursor opens a little more
        if (f.role === "roof") o = 1 - open;
        else if (f.role === "wall" && toward > R * 0.05) o = 1 - open * (f.floorIndex === focus ? 0.95 : 0.88);
        else if (f.role === "slab" && f.floorIndex > focus) o = 1 - open * 0.3;
      } else if (f.role === "wall" && toward > R * 0.25) o = 1 - open * 0.85;
      for (const m of f.mats) {
        const base = (m.userData.baseOpacity as number | undefined) ?? (m.userData.baseOpacity = m.opacity);
        const v = base * o;
        if (Math.abs(m.opacity - v) > 0.004) {
          m.opacity = v;
          m.transparent = true;
          m.depthWrite = v > 0.98;
          m.visible = v > 0.03;
        }
      }
    }
  }

  // (re)build the model when the job changes
  const key = useMemo(() => ({}), [p.plan, p.mode, p.floor, p.room, p.items, p.pins, p.states, p.colorMode, p.wallMode, p.empty, p.draft, p.selectedPin, p.selectedItem]); // eslint-disable-line react-hooks/exhaustive-deps
  const framed = useRef<string>("");
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    if (t.built) {
      t.scene.remove(t.built.root);
      t.built.root.traverse((x) => { const own = x.userData.ownMaterials as Materials | undefined; if (own) own.dispose(); });
      dispose(t.built.root);
    }
    const built = buildScene(cb.current, t.mt);
    t.built = built;
    t.scene.add(built.root);
    // light and shadows sized to the model
    const R = built.radius;
    t.sun.position.set(built.centre.x + R * 1.2, R * 2.4 + 8, built.centre.z + R * 0.9);
    t.sun.target.position.copy(built.centre);
    const sc = t.sun.shadow.camera;
    sc.left = sc.bottom = -R * 1.6; sc.right = sc.top = R * 1.6; sc.near = 0.5; sc.far = R * 8 + 30;
    sc.updateProjectionMatrix();
    // frame the camera when the place changes, not when a pin is added
    const where = `${cb.current.mode}|${cb.current.floor?.id ?? ""}|${cb.current.room?.id ?? ""}`;
    if (framed.current !== where) {
      framed.current = where;
      frame(true);
      t.focus = 0;
    }
    highlight();
  }, [key]);  

  function frame(reset: boolean) {
    const t = three.current;
    if (!t?.built) return;
    const { camera, controls, built } = t;
    const R = built.radius;
    const building = cb.current.mode === "building";
    // in the building, zoom heads for the middle so it opens evenly; inside a floor, toward the cursor
    controls.zoomToCursor = !building;
    controls.minDistance = building ? R * 1.45 : cb.current.room ? 0.6 : 1.2;
    controls.maxDistance = building ? R * 6 : cb.current.room ? Math.max(R, 2.6) * 5 : R * 3.4;
    if (!reset) return;
    // a scroll that was still going when the level changed shouldn't carry on into the new one
    t.lockUntil = performance.now() + 800;
    // use up any glide left over from the last view before moving the camera
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    controls.target.copy(built.centre);
    const fv = building ? frontView(cb.current.plan) : null;
    // look at the front of the house from a little above, or at a floor from a high corner
    const az = building ? (fv?.side === "top" ? Math.PI : 0) + 0.55 : 0.6;
    const pol = building ? 1.12 : cb.current.room ? 0.3 : 0.75;
    // a room is small next to its own walls: stand back far enough to see all of it over them
    const r = building ? R * 3.3 : cb.current.room ? Math.max(R, 2.6) * 3.4 : R * 2.3;
    camera.position.set(built.centre.x + r * Math.sin(pol) * Math.sin(az), built.centre.y + r * Math.cos(pol), built.centre.z + r * Math.sin(pol) * Math.cos(az));
    controls.update();
  }

  function highlight() {
    const t = three.current;
    if (!t?.built) return;
    const id = cb.current.selected;
    const o = id ? t.built.byId.get(id) : null;
    if (o && (o.userData.pick as Pick).type !== "room") {
      t.sel.box.setFromObject(o);
      t.sel.visible = true;
    } else if (o && id !== cb.current.room?.id) {
      t.sel.box.setFromObject(o);
      t.sel.box.max.y += 0.02;
      t.sel.visible = true;
    } else t.sel.visible = false;
  }
  useEffect(highlight, [p.selected]);  

  // zoom buttons and fit
  useEffect(() => {
    p.controls({
      zoomBy: (f) => {
        const t = three.current;
        if (!t) return;
        const { camera, controls } = t;
        const off = camera.position.clone().sub(controls.target);
        const d = off.length();
        if (f > 1 && d <= controls.minDistance * 1.02) return limit("in");
        if (f < 1 && d >= controls.maxDistance * 0.98) return limit("out");
        off.setLength(THREE.MathUtils.clamp(d / f, controls.minDistance, controls.maxDistance));
        camera.position.copy(controls.target).add(off);
      },
      home: () => frame(true),
    });
  }, [p.controls]); // eslint-disable-line react-hooks/exhaustive-deps

  const cooldown = useRef(0);
  function limit(dir: "in" | "out") {
    if (performance.now() < cooldown.current) return;
    cooldown.current = performance.now() + 700;
    const t = three.current;
    if (dir === "out" && cb.current.mode === "floor") cb.current.onLimitOut();
    else if (dir === "out") cb.current.onLimitOut();
    else if (dir === "in" && cb.current.mode === "building" && t?.built) {
      const f = t.built.floors[t.focus] ?? t.built.floors[0];
      if (f) cb.current.onOpenFloor(f.id);
    }
  }

  // ------------------------------------------------------------------ pointer: pick, drag, pin
  useEffect(() => {
    const el = host.current!;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number; button: number; t: number } | null = null;
    let drag: null | {
      obj: THREE.Object3D; pick: Pick; plane: THREE.Plane; start: THREE.Vector3; origin: THREE.Vector3; moved: boolean; side?: WallSide; base: number;
    } = null;

    const cast = (e: { clientX: number; clientY: number }) => {
      const t = three.current;
      if (!t?.built) return null;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, t.camera);
      const hits = ray.intersectObjects(t.built.picks, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        // skip things that are faded away
        const m = (h.object as THREE.Mesh).material as THREE.Material | undefined;
        if (m && !Array.isArray(m) && (m.visible === false || m.opacity < 0.3) && !(h.object as THREE.Mesh).userData.hit) continue;
        while (o && !o.userData.pick) o = o.parent;
        if (o) return { obj: o, pick: o.userData.pick as Pick, point: h.point };
      }
      return null;
    };
    // in the building, the storey you clicked is the one at that height, whatever the ray hit first
    const floorAtY = (y: number, fallback: string) => {
      const fs = three.current?.built?.floors ?? [];
      let id = fallback;
      for (const f of fs) if (y >= f.y0 - 0.25) id = f.id;
      return id;
    };
    const floorBase = (floorId: string) => three.current?.built?.floors.find((f) => f.id === floorId)?.y0 ?? 0;
    const planeHit = (e: { clientX: number; clientY: number }, plane: THREE.Plane) => {
      const t = three.current!;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, t.camera);
      const out = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, out) ? out : null;
    };

    const target = (e: { clientX: number; clientY: number }): PinTarget | null => {
      const h = cast(e);
      const P = cb.current;
      if (!h) return null;
      const fl = P.plan.floors.find((f) => f.id === h.pick.floorId);
      if (!fl) return null;
      const base = floorBase(fl.id);
      const x = Math.round(h.point.x / S), y = Math.round(h.point.z / S), up = Math.round((h.point.y - base) / S);
      // the whole building: the pin stays on the exact spot you clicked, roof and outside walls included
      if (P.mode === "building") {
        const onIt = h.pick.type === "wall" || h.pick.type === "opening" ? h.pick.id : null;
        return { floorId: h.pick.type === "roof" ? null : fl.id, x: null, y: null, elementId: onIt, anchor: { view: "point", x, y, z: Math.max(0, Math.round(h.point.y / S)) } };
      }
      // a wall face, or something on it, high up: keep the exact spot on that wall
      if ((h.pick.type === "wall" || h.pick.type === "opening" || h.pick.type === "item") && P.mode === "floor") {
        let best: { side: WallSide; along: number; d: number } | null = null;
        const rooms = P.room ? [P.room, ...fl.rooms.filter((r) => r !== P.room)] : fl.rooms;
        for (const r of rooms) for (const s of roomSides(fl, r)) {
          const ux = (s.b[0] - s.a[0]) / s.length, uy = (s.b[1] - s.a[1]) / s.length;
          const along = (x - s.a[0]) * ux + (y - s.a[1]) * uy;
          if (along < 0 || along > s.length) continue;
          const off = (x - s.a[0]) * s.inward[0] + (y - s.a[1]) * s.inward[1];
          if (off < -40 || off > 200) continue; // the hit is on this side's inside face
          if (!best || Math.abs(off) < best.d) best = { side: s, along, d: Math.abs(off) };
        }
        if (best) return { floorId: fl.id, x: null, y: null, elementId: h.pick.type === "item" ? null : h.pick.id, anchor: { view: "wall", side: best.side.key, x: Math.round(best.along), y: -Math.max(0, up) } };
      }
      const el2 = h.pick.type === "fixture" || h.pick.type === "wall" || h.pick.type === "opening" || h.pick.type === "stair" ? h.pick.id : hitTest(fl, [x, y]);
      return { floorId: fl.id, x, y, elementId: el2, anchor: null };
    };

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, button: e.button, t: performance.now() };
      const P = cb.current;
      if (e.button !== 0 || P.pinMode || P.mode !== "floor") return;
      const h = cast(e);
      if (!h) return;
      const { pick } = h;
      // click once to select, then drag: a drag over something not selected just moves the view
    const movable = !P.locked && ((pick.type === "fixture" && pick.id === P.selected) || (pick.type === "item" && pick.id === P.selectedItem) || (pick.type === "pin" && pick.id === P.selectedPin));
      if (!movable) return;
      const base = floorBase(pick.floorId);
      const side = h.obj.userData.side as WallSide | undefined;
      const plane = side
        ? new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(side.inward[0], 0, side.inward[1]), new THREE.Vector3(side.a[0] * S, 0, side.a[1] * S))
        : new THREE.Plane(new THREE.Vector3(0, 1, 0), -(base + (pick.type === "pin" ? 0 : 0)));
      const start = planeHit(e, plane);
      if (!start) return;
      drag = { obj: h.obj, pick, plane, start, origin: h.obj.position.clone(), moved: false, side, base };
      three.current!.controls.enabled = false;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const t = three.current;
      if (!t) return;
      if (drag) {
        const q = planeHit(e, drag.plane);
        if (!q) return;
        const d = q.clone().sub(drag.start);
        if (!drag.moved && d.length() < 0.01) return;
        drag.moved = true;
        if (drag.side) drag.obj.position.set(drag.origin.x + d.x, Math.max(0.03, drag.origin.y + d.y), drag.origin.z + d.z);
        else drag.obj.position.set(drag.origin.x + d.x, drag.origin.y, drag.origin.z + d.z);
        if (drag.pick.id === cb.current.selected) { t.sel.box.setFromObject(drag.obj); }
        el.style.cursor = "grabbing";
        return;
      }
      if (cb.current.pinMode) return;
      const h = cast(e);
      if (cb.current.mode === "building") {
        const fid = h ? floorAtY(h.point.y, h.pick.floorId) : null;
        if (fid && t.built) { const i = t.built.floors.findIndex((f) => f.id === fid); if (i >= 0) t.focus = i; }
        el.style.cursor = h ? "pointer" : "";
      } else {
        el.style.cursor = h && (h.pick.type !== "room" || true) ? "pointer" : "";
      }
    };
    const onUp = (e: PointerEvent) => {
      const P = cb.current;
      const t = three.current;
      const wasDrag = drag;
      drag = null;
      if (t) t.controls.enabled = true;
      if (wasDrag?.moved) {
        el.style.cursor = "";
        const o = wasDrag.obj, id = wasDrag.pick.id;
        if (wasDrag.pick.type === "fixture") {
          const dx = Math.round(((o.position.x - wasDrag.origin.x) / S) / 10) * 10, dy = Math.round(((o.position.z - wasDrag.origin.z) / S) / 10) * 10;
          if (dx || dy) P.onMoveFixture(id, dx, dy);
        } else if (wasDrag.side) {
          const s = wasDrag.side;
          const ux = (s.b[0] - s.a[0]) / s.length, uy = (s.b[1] - s.a[1]) / s.length;
          const along = Math.round((o.position.x / S - s.a[0]) * ux + (o.position.z / S - s.a[1]) * uy);
          const up = Math.round((o.position.y - (wasDrag.pick.type === "pin" ? 0 : 0)) / S);
          if (wasDrag.pick.type === "item") P.onMoveItem(id, Math.max(0, Math.min(s.length, along)), Math.max(0, up));
          else P.onMovePin(id, { anchor: { view: "wall", side: s.key, x: Math.max(0, Math.min(s.length, along)), y: -Math.max(0, up) } });
        } else if (wasDrag.pick.type === "pin") {
          const fl = P.plan.floors.find((f) => f.id === wasDrag.pick.floorId);
          const x = Math.round(o.position.x / S), y = Math.round(o.position.z / S);
          const pin = P.pins.find((q) => q.id === id);
          P.onMovePin(id, { floor_id: wasDrag.pick.floorId, x, y, element_id: (fl && hitTest(fl, [x, y])) ?? pin?.element_id ?? null });
        }
        return;
      }
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
      const b = down.button;
      down = null;
      if (moved || b !== 0) return;
      if (P.pinMode) {
        const tg = target(e);
        if (tg) P.onPlacePin(tg, { x: e.clientX, y: e.clientY });
        return;
      }
      const h = cast(e);
      if (P.mode === "building") {
        if (h?.pick.type === "pin") return P.onSelectPin(h.pick.id);
        if (h) P.onOpenFloor(floorAtY(h.point.y, h.pick.floorId));
        return;
      }
      if (!h) return P.onSelect(null);
      if (h.pick.type === "pin") return P.onSelectPin(h.pick.id);
      if (h.pick.type === "item") return P.onSelectItem(h.pick.id);
      P.onSelect(h.pick.id);
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // that was a pan
      const tg = target(e);
      if (tg) cb.current.onPlacePin(tg, { x: e.clientX, y: e.clientY });
    };
    // zooming past the limits steps a level in or out, like the flat views
    const onWheel = (e: WheelEvent) => {
      const t = three.current;
      if (!t) return;
      if (performance.now() < t.lockUntil) { e.preventDefault(); e.stopPropagation(); return; }
      const d = t.camera.position.distanceTo(t.controls.target);
      if (e.deltaY < 0 && d <= t.controls.minDistance * 1.02) limit("in");
      else if (e.deltaY > 0 && d >= t.controls.maxDistance * 0.98) limit("out");
    };
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("contextmenu", onContext);
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("contextmenu", onContext);
      el.removeEventListener("wheel", onWheel, true);
    };
  }, []);  

  return <div ref={host} className="absolute inset-0" role="application" aria-label={p.mode === "building" ? "The building in 3D" : "The floor in 3D"} data-testid="plan-3d" />;
}

/** True when the browser can draw 3D. */
export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

