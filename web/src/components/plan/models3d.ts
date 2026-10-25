// Simple 3D models of the things in a plan, built from boxes and cylinders to their real sizes.
// Each model is made in its own frame: width along x, depth along z with the front facing +z,
// standing on y = 0, centred on the origin. Units are metres.
import * as THREE from "three";
import type { Fixture } from "@/lib/plan/types";
import { fixtureSize } from "@/lib/plan/edits";
import { fixtureBottom, fixtureHeight } from "./fixtures";

const C = {
  carcass: "#e4dccb", worktop: "#4a4844", plinth: "#2a2926", steel: "#b9bec4", black: "#1b1a17", white: "#f4efe6",
  timber: "#a07850", dark: "#6e4f37", fabric: "#6f7486", linen: "#e9e3d6", glass: "#8fd3f0", green: "#3f7a4a",
  pot: "#b0623a", lamp: "#f3c56b", stone: "#8d8a83", car: "#55606b", groove: "#9d9585",
};

/** Shared materials, so a plan with a hundred cabinets makes a handful of materials. */
export class Materials {
  private cache = new Map<string, THREE.MeshStandardMaterial>();
  constructor(public tint: string | null = null) {}
  get(color: string, o: { rough?: number; metal?: number; opacity?: number; emissive?: string } = {}) {
    const c = this.tint && !o.emissive && o.opacity == null ? this.tint : color;
    const key = `${c}|${o.rough ?? 0.75}|${o.metal ?? 0}|${o.opacity ?? 1}|${o.emissive ?? ""}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0 });
      if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
      if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = 0.8; }
      m.userData.shared = true; // freed with its Materials, not with the mesh
      this.cache.set(key, m);
    }
    return m;
  }
  dispose() { this.cache.forEach((m) => m.dispose()); this.cache.clear(); }
}

const geoBox = new THREE.BoxGeometry(1, 1, 1);
const geoCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const geoSphere = new THREE.IcosahedronGeometry(0.5, 1);
/** Geometries every model shares; never disposed with a scene. */
export const SHARED_GEOMETRY = new Set<THREE.BufferGeometry>([geoBox, geoCyl, geoSphere]);

type M = THREE.Material;
function box(g: THREE.Group, m: M, w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geoBox, m);
  mesh.scale.set(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001));
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function cyl(g: THREE.Group, m: M, r: number, h: number, x = 0, y = 0, z = 0, rx = 0) {
  const mesh = new THREE.Mesh(geoCyl, m);
  mesh.scale.set(r * 2, h, r * 2);
  mesh.position.set(x, y + (rx ? 0 : h / 2), z);
  mesh.rotation.x = rx;
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function ball(g: THREE.Group, m: M, r: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geoSphere, m);
  mesh.scale.setScalar(r * 2);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  g.add(mesh);
}

/** Door and drawer lines on a cabinet front (front face at z = d/2). */
function front(g: THREE.Group, mt: Materials, kind: string | null | undefined, w: number, y0: number, y1: number, d: number) {
  const m = mt.get(C.groove);
  const z = d / 2 + 0.002, t = 0.006;
  const h = y1 - y0;
  if (kind === "drawers") for (const f of [0.33, 0.66]) box(g, m, w - 0.02, t, 0.004, 0, y0 + h * f, z);
  else if (kind === "door_drawer" || kind === "sink") { box(g, m, w - 0.02, t, 0.004, 0, y1 - 0.16, z); if (w > 0.55) box(g, m, t, h - 0.18, 0.004, 0, y0, z); }
  else if (kind === "open" || kind === "panel" || kind === "appliance") return;
  else if (w > 0.55 || kind === "doors") box(g, m, t, h - 0.02, 0.004, 0, y0 + 0.01, z);
  // handles
  const hm = mt.get(C.steel, { metal: 0.6, rough: 0.35 });
  if (kind === "drawers") for (const f of [0.17, 0.5, 0.83]) box(g, hm, Math.min(0.2, w * 0.4), 0.012, 0.02, 0, y0 + h * f, z);
  else box(g, hm, 0.012, 0.14, 0.02, w > 0.55 ? 0.05 : w / 2 - 0.05, y1 - 0.2, z);
}

function counterUnit(g: THREE.Group, mt: Materials, f: Fixture, w: number, d: number, h: number) {
  const top = 0.035;
  box(g, mt.get(C.plinth), w - 0.01, 0.1, d - 0.08, 0, 0, -0.03);
  const body = f.kind === "dishwasher" || f.kind === "range" || f.kind === "oven" ? mt.get(C.steel, { metal: 0.5, rough: 0.35 }) : mt.get(C.carcass);
  box(g, body, w - 0.004, h - 0.1 - top, d - 0.02, 0, 0.1, -0.01);
  if (f.kind !== "filler") box(g, mt.get(C.worktop, { rough: 0.4 }), w, top, d + 0.01, 0, h - top, 0);
  const fr = f.kind === "dishwasher" ? "appliance" : f.front;
  if (f.kind === "range" || f.kind === "oven") {
    box(g, mt.get(C.black, { rough: 0.2 }), w * 0.75, (h - 0.1) * 0.45, 0.01, 0, 0.25, d / 2);
    box(g, mt.get(C.steel, { metal: 0.6, rough: 0.3 }), w * 0.7, 0.02, 0.03, 0, h - 0.2, d / 2);
  } else front(g, mt, fr, w, 0.1, h - top, d);
  if (f.kind === "range" || f.kind === "cooktop") {
    const bm = mt.get(C.black, { rough: 0.5 });
    for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) cyl(g, bm, Math.min(w, d) * 0.11, 0.012, (x * w) / 1.2, h, (z * d) / 1.2);
  }
  if (f.kind === "kitchen_sink" || f.front === "sink") {
    box(g, mt.get(C.steel, { metal: 0.7, rough: 0.25 }), Math.min(0.8, w * 0.8), 0.006, d * 0.6, 0, h, 0.02);
    box(g, mt.get(C.black), Math.min(0.74, w * 0.74), 0.004, d * 0.52, 0, h + 0.004, 0.02);
    const fm = mt.get(C.steel, { metal: 0.8, rough: 0.2 });
    cyl(g, fm, 0.015, 0.32, 0, h, -d / 2 + 0.07);
    box(g, fm, 0.025, 0.025, 0.2, 0, h + 0.3, -d / 2 + 0.16);
  }
}

function model(f: Fixture, mt: Materials, w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mt.get(C.timber), white = mt.get(C.white, { rough: 0.3 }), fabric = mt.get(C.fabric, { rough: 0.95 });
  const steel = mt.get(C.steel, { metal: 0.55, rough: 0.35 });
  switch (f.kind) {
    case "base_cabinet": case "kitchen_sink": case "dishwasher": case "range": case "cooktop": case "oven": case "island": case "filler":
      counterUnit(g, mt, f, w, d, h); break;
    case "wall_cabinet": case "tall_cabinet":
      box(g, mt.get(C.carcass), w - 0.004, h, d, 0, 0, 0);
      front(g, mt, f.front ?? "door", w, 0, h, d);
      break;
    case "range_hood":
      box(g, steel, w, 0.12, d, 0, 0, 0);
      box(g, steel, w * 0.35, h - 0.12, d * 0.45, 0, 0.12, -d * 0.25);
      break;
    case "fridge":
      box(g, steel, w - 0.01, h, d, 0, 0, 0);
      box(g, mt.get(C.black), w - 0.01, 0.008, 0.004, 0, h * 0.62, d / 2 + 0.002);
      box(g, mt.get(C.black), 0.02, 0.4, 0.03, w / 2 - 0.06, h * 0.68, d / 2 + 0.02);
      box(g, mt.get(C.black), 0.02, 0.5, 0.03, w / 2 - 0.06, h * 0.08 + 0.5, d / 2 + 0.02);
      break;
    case "toilet":
      box(g, white, w * 0.9, 0.38, Math.min(0.2, d * 0.28), 0, 0.42, -d / 2 + Math.min(0.1, d * 0.14));
      cyl(g, white, w * 0.36, 0.4, 0, 0, d * 0.08).scale.z = d * 0.62;
      box(g, white, w * 0.74, 0.03, d * 0.6, 0, 0.4, d * 0.08);
      break;
    case "washbasin":
      cyl(g, white, Math.min(w, d) * 0.12, 0.8, 0, 0, -d * 0.1);
      box(g, white, w, 0.14, d, 0, 0.76, 0);
      box(g, mt.get(C.glass, { rough: 0.2 }), w * 0.7, 0.005, d * 0.6, 0, 0.9, 0.02);
      cyl(g, steel, 0.015, 0.18, 0, 0.9, -d / 2 + 0.06);
      break;
    case "vanity": {
      const H = Math.min(h, 0.9);
      box(g, wood, w - 0.01, H - 0.03, d - 0.01, 0, 0, 0);
      front(g, mt, w > 0.9 ? "doors" : "door", w, 0.05, H - 0.03, d);
      box(g, white, w, 0.03, d + 0.01, 0, H - 0.03, 0);
      const n = w > 1.2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : (i === 0 ? -w / 4 : w / 4);
        box(g, mt.get("#d7d2c7", { rough: 0.2 }), Math.min(0.5, w * 0.4), 0.004, d * 0.55, x, H, 0.03);
        cyl(g, steel, 0.014, 0.2, x, H, -d / 2 + 0.06);
        box(g, steel, 0.02, 0.02, 0.12, x, H + 0.18, -d / 2 + 0.11);
      }
      break;
    }
    case "bathtub":
      box(g, white, w, Math.min(h, 0.58), d, 0, 0, 0);
      box(g, mt.get("#cfe6ee", { rough: 0.15 }), w - 0.12, 0.005, d - 0.12, 0, Math.min(h, 0.58), 0);
      break;
    case "shower":
      box(g, white, w, 0.06, d, 0, 0, 0);
      box(g, mt.get(C.glass, { opacity: 0.22, rough: 0.1 }), w, 1.95, d, 0, 0.06, 0);
      cyl(g, steel, 0.1, 0.02, 0, 2.0, 0);
      break;
    case "bed": {
      box(g, wood, w, 0.3, d, 0, 0, 0);
      box(g, mt.get(C.linen, { rough: 0.95 }), w - 0.06, 0.22, d - 0.08, 0, 0.3, 0.02);
      box(g, fabric, w - 0.04, 0.05, d * 0.6, 0, 0.52, d * 0.18);
      box(g, wood, w, 1.0, 0.06, 0, 0, -d / 2 + 0.03);
      const pw = w > 1.2 ? (w - 0.3) / 2 : w - 0.2;
      for (const x of w > 1.2 ? [-pw / 2 - 0.05, pw / 2 + 0.05] : [0]) box(g, mt.get(C.white, { rough: 0.95 }), pw, 0.12, 0.35, x, 0.52, -d / 2 + 0.3);
      break;
    }
    case "sofa": case "armchair": {
      const arm = Math.min(0.18, w * 0.15);
      box(g, fabric, w, 0.42, d, 0, 0, 0);
      box(g, fabric, w, 0.45, Math.min(0.22, d * 0.25), 0, 0.42, -d / 2 + Math.min(0.11, d * 0.125));
      box(g, fabric, arm, 0.22, d, -w / 2 + arm / 2, 0.42, 0);
      box(g, fabric, arm, 0.22, d, w / 2 - arm / 2, 0.42, 0);
      box(g, mt.get("#7d8296", { rough: 0.95 }), w - 2 * arm, 0.1, d - 0.25, 0, 0.42, 0.1);
      break;
    }
    case "chair": {
      const s = Math.min(w, d);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, wood, 0.035, 0.44, 0.035, (x * s) / 2.4, 0, (z * s) / 2.4);
      box(g, wood, s * 0.92, 0.04, s * 0.92, 0, 0.44, 0);
      box(g, wood, s * 0.92, 0.42, 0.03, 0, 0.48, -s * 0.44);
      break;
    }
    case "table": case "dining_table": case "desk": {
      const H = Math.min(h, 0.76);
      box(g, wood, w, 0.04, d, 0, H - 0.04, 0);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, wood, 0.05, H - 0.04, 0.05, x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06));
      break;
    }
    case "nightstand": case "sideboard": case "wardrobe":
      box(g, wood, w, h, d, 0, 0, 0);
      front(g, mt, f.kind === "nightstand" ? "drawers" : "doors", w, 0.02, h - 0.02, d);
      break;
    case "bookshelf": {
      const dk = mt.get(C.dark);
      box(g, dk, w, h, 0.02, 0, 0, -d / 2 + 0.01);
      box(g, wood, 0.025, h, d, -w / 2 + 0.0125, 0, 0);
      box(g, wood, 0.025, h, d, w / 2 - 0.0125, 0, 0);
      const n = Math.max(2, Math.round(h / 0.38));
      for (let i = 0; i <= n; i++) box(g, wood, w - 0.05, 0.022, d - 0.02, 0, (i * (h - 0.022)) / n, 0.01);
      break;
    }
    case "washing_machine": case "dryer":
      box(g, white, w, h, d, 0, 0, 0);
      cyl(g, mt.get(C.black, { rough: 0.2 }), Math.min(w, h) * 0.3, 0.02, 0, h * 0.45, d / 2, Math.PI / 2);
      break;
    case "water_heater":
      cyl(g, white, Math.min(w, d) / 2, h, 0, 0, 0);
      break;
    case "lamp":
      cyl(g, mt.get(C.black), 0.14, 0.03, 0, 0, 0);
      cyl(g, mt.get(C.black), 0.012, h - 0.3, 0, 0.03, 0);
      cyl(g, mt.get(C.lamp, { emissive: "#ffcf73" }), 0.17, 0.28, 0, h - 0.3, 0);
      break;
    case "plant":
      cyl(g, mt.get(C.pot), Math.min(w, d) * 0.25, 0.35, 0, 0, 0);
      ball(g, mt.get(C.green, { rough: 0.9 }), Math.min(w, d) * 0.45, 0, 0.35 + Math.min(w, d) * 0.4, 0);
      ball(g, mt.get(C.green, { rough: 0.9 }), Math.min(w, d) * 0.3, Math.min(w, d) * 0.2, 0.35 + Math.min(w, d) * 0.85, 0.05);
      break;
    case "tv":
      box(g, wood, w, 0.5, d, 0, 0, 0);
      box(g, mt.get(C.black, { rough: 0.2 }), w * 0.9, w * 0.5, 0.05, 0, 0.75, -d / 4);
      break;
    case "car": {
      const wm = mt.get(C.black, { rough: 0.9 });
      const along = w >= d ? "x" : "z";
      const L = Math.max(w, d), Wd = Math.min(w, d);
      const sub = new THREE.Group();
      box(sub, mt.get(C.car, { metal: 0.4, rough: 0.4 }), L, 0.6, Wd, 0, 0.25, 0);
      box(sub, mt.get("#3d4650", { metal: 0.3, rough: 0.3 }), L * 0.5, 0.45, Wd * 0.9, -L * 0.05, 0.85, 0);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(sub, wm, 0.33, 0.22, x * L * 0.33, 0.33, (z * Wd) / 2.1, Math.PI / 2);
      if (along === "z") sub.rotation.y = Math.PI / 2;
      g.add(sub);
      break;
    }
    case "fireplace":
      box(g, mt.get(C.stone), w, h, d, 0, 0, 0);
      box(g, mt.get(C.black), w * 0.55, h * 0.45, 0.01, 0, 0.15, d / 2);
      box(g, mt.get("#ff7d3b", { emissive: "#ff6a1f" }), w * 0.3, 0.08, 0.02, 0, 0.18, d / 2 - 0.02);
      break;
    case "towel_radiator":
      for (let i = 0; i < 8; i++) box(g, white, w, 0.03, 0.03, 0, 0.3 + i * 0.15, 0);
      break;
    default:
      box(g, mt.get(C.stone), w, h, d, 0, 0, 0);
  }
  return g;
}

/** The fixture as a 3D object placed in the plan frame (x = plan x, z = plan y, y up), floor at `base` m. */
export function fixtureObject(f: Fixture, mt: Materials, base: number): THREE.Object3D {
  const S = 0.001;
  const bottom = fixtureBottom(f);
  let h = (f.height_mm ?? fixtureHeight(f.kind)) * S;
  if (f.kind === "other") {
    // nobody knows what it is: its outline, stood up to a typical height
    const pts = f.outline.flat();
    const ring = pts.length >= 3 ? hullRing(pts) : null;
    const g = new THREE.Group();
    if (ring) {
      const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x * S, -y * S)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.min(h, 0.75), bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mt.get("#8d8a83", { opacity: 0.85 }));
      mesh.castShadow = true;
      g.add(mesh);
      g.position.y = base;
    }
    return g;
  }
  let w: number, d: number;
  let rot = 0;
  if (f.facing != null) {
    const s = fixtureSize(f);
    w = s.width * S; d = s.depth * S;
    rot = Math.PI / 2 - (f.facing * Math.PI) / 180;
  } else {
    w = (f.bbox[2] - f.bbox[0]) * S; d = (f.bbox[3] - f.bbox[1]) * S;
    // long things with no known front (sofas, beds) face across their short side
    if (["sofa", "bed", "bathtub", "bookshelf", "sideboard", "wardrobe"].includes(f.kind) && d > w * 1.15) { [w, d] = [d, w]; rot = Math.PI / 2; }
  }
  if (h <= 0) h = 0.85;
  const g = model(f, mt, Math.max(w, 0.05), Math.max(d, 0.05), h);
  const holder = new THREE.Group();
  holder.add(g);
  g.rotation.y = rot;
  holder.position.set(f.center[0] * S, base + bottom * S, f.center[1] * S);
  return holder;
}

function hullRing(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
