// The pieces every 3D model is built from: rounded boxes, tapers, rods and balls at real sizes in metres,
// shared materials with wood grain, upholstery weave, stone and reflective metal and glass, and a few
// built-up parts (shaker cabinet fronts, a faucet) used across the catalogue.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Part } from "@/lib/plan/catalog";
import { skyEnv, stone, weave, woodGrain } from "./looks3d";

export const C = {
  carcass: "#e4dccb", door: "#efe8da", worktop: "#4a4844", plinth: "#2a2926", steel: "#b9bec4", black: "#1b1a17", white: "#f4efe6",
  timber: "#a07850", dark: "#6e4f37", fabric: "#6f7486", cushion: "#7d8296", linen: "#e9e3d6", glass: "#8fd3f0", green: "#3f7a4a",
  leaf: "#4f8a55", pot: "#b0623a", lamp: "#f3c56b", shade: "#efe3c8", stone: "#8d8a83", car: "#55606b", nickel: "#a9abad", porcelain: "#f7f5f0",
};

export type Look = { rough?: number; metal?: number; opacity?: number; emissive?: string; map?: "wood" | "weave" | "stone" | null; env?: number };

const hsl = { h: 0, s: 0, l: 0 };
/** What a colour most likely is when nobody says: wood, steel, glass, enamel or plain paint. */
function guess(color: string): Look {
  const c = color.toLowerCase();
  if (c === C.steel || c === "#b9bec4" || c === "#9da3aa" || c === C.nickel) return { metal: 0.7, rough: 0.3, env: 1 };
  if (["#8fd3f0", "#cfe6ee", "#8fb8c9"].includes(c)) return { metal: 0.5, rough: 0.05, env: 1.2 };
  if (c === "#4a4844" || c === "#e8e4dc" || c === C.stone) return { map: "stone", rough: 0.35, env: 0.35 };
  if (c === "#6d6a63") return { metal: 0.7, rough: 0.35, env: 1 };
  if (["#232426", "#1b1a17", "#151618"].includes(c)) return { rough: 0.35, env: 0.4 };
  if (c === C.white || c === "#f4efe6" || c === "#ffffff") return { rough: 0.35, env: 0.35 };
  if (["#6f7486", "#7d8296", "#5a4a40", "#6b594d", "#e9e3d6", "#c9b38c"].includes(c)) return { map: "weave", rough: 0.95 };
  new THREE.Color(c).getHSL(hsl);
  if (hsl.h > 0.04 && hsl.h < 0.13 && hsl.s > 0.2 && hsl.l > 0.15 && hsl.l < 0.62) return { map: "wood", rough: 0.6 };
  return {};
}

/** Shared materials, so a plan with a hundred cabinets makes a handful of materials. */
export class Materials {
  private cache = new Map<string, THREE.MeshStandardMaterial>();
  constructor(public tint: string | null = null) {}
  get(color: string, o: Look = {}) {
    const c = this.tint && !o.emissive && o.opacity == null ? this.tint : color;
    // a status colour shows plain; otherwise each thing gets its grain, weave or shine
    const plain = c !== color;
    const map = plain ? null : o.map ?? null, env = plain ? 0 : o.env ?? 0;
    const key = `${c}|${o.rough ?? 0.75}|${o.metal ?? 0}|${o.opacity ?? 1}|${o.emissive ?? ""}|${map}|${env}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0 });
      if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
      if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = 0.8; }
      if (map) m.map = map === "wood" ? woodGrain() : map === "weave" ? weave() : stone();
      if (env) { m.envMap = skyEnv(); m.envMapIntensity = env; }
      m.userData.shared = true; // freed with its Materials, not with the mesh
      this.cache.set(key, m);
    }
    return m;
  }
  /** a colour with the look it most likely has (wood grain on brown, shine on steel ...) */
  auto(color: string, o: Look = {}) { return this.get(color, { ...guess(color), ...o }); }
  dispose() { this.cache.forEach((m) => m.dispose()); this.cache.clear(); }
}

const geoBox = new THREE.BoxGeometry(1, 1, 1);
const geoCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
const geoSphere = new THREE.IcosahedronGeometry(0.5, 2);
/** Geometries every model shares; never disposed with a scene. */
export const SHARED_GEOMETRY = new Set<THREE.BufferGeometry>([geoBox, geoCyl, geoSphere]);

// rounded boxes, one per size (to the mm), so edges catch the light like real furniture
const rounded = new Map<string, THREE.BufferGeometry>();
function roundedBox(w: number, h: number, d: number, r: number) {
  const key = `${Math.round(w * 1000)}|${Math.round(h * 1000)}|${Math.round(d * 1000)}|${Math.round(r * 1000)}`;
  let g = rounded.get(key);
  if (!g) {
    if (rounded.size > 3000) return null;
    g = new RoundedBoxGeometry(w, h, d, 1, r);
    SHARED_GEOMETRY.add(g);
    rounded.set(key, g);
  }
  return g;
}
const frusta = new Map<string, THREE.BufferGeometry>();
/** a tapered round (or n-sided) shape, 1 high, radii as given, standing on y = 0 */
function frustumGeo(top: number, bottom: number, sides: number) {
  const key = `${top.toFixed(3)}|${bottom.toFixed(3)}|${sides}`;
  let g = frusta.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(top, bottom, 1, sides);
    if (sides === 4) g.rotateY(Math.PI / 4);
    g.translate(0, 0.5, 0);
    SHARED_GEOMETRY.add(g);
    frusta.set(key, g);
  }
  return g;
}

export type M = THREE.Material;
/** A box w x h x d standing on y with its middle at x, z; rounded at the edges by `round` (m, 0 for sharp). */
export function box(g: THREE.Group, m: M, w: number, h: number, d: number, x = 0, y = 0, z = 0, round = -1) {
  w = Math.max(w, 0.001); h = Math.max(h, 0.001); d = Math.max(d, 0.001);
  const r = round >= 0 ? Math.min(round, Math.min(w, h, d) * 0.49) : Math.min(0.008, Math.min(w, h, d) * 0.2);
  const geo = r >= 0.0015 ? roundedBox(w, h, d, r) : null;
  const mesh = new THREE.Mesh(geo ?? geoBox, m);
  if (!geo) mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
export function cyl(g: THREE.Group, m: M, r: number, h: number, x = 0, y = 0, z = 0, rx = 0) {
  const mesh = new THREE.Mesh(geoCyl, m);
  mesh.scale.set(r * 2, h, r * 2);
  mesh.position.set(x, y + (rx ? 0 : h / 2), z);
  mesh.rotation.x = rx;
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
/** a taper from radius rb at y to rt at y + h (a lamp shade, a tub's foot, a hood's canopy with 4 sides) */
export function taper(g: THREE.Group, m: M, rt: number, rb: number, h: number, x = 0, y = 0, z = 0, sides = 28) {
  const s = Math.max(rt, rb);
  const mesh = new THREE.Mesh(frustumGeo(+(rt / s).toFixed(3), +(rb / s).toFixed(3), sides), m);
  mesh.scale.set(s, h, s);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
/** a horizontal rod centred on x, y, z, running along x (or z) */
export function rod(g: THREE.Group, m: M, r: number, len: number, x: number, y: number, z: number, along: "x" | "z" = "x") {
  const mesh = cyl(g, m, r, len, x, 0, z);
  mesh.position.y = y;
  if (along === "x") mesh.rotation.set(0, 0, Math.PI / 2); else mesh.rotation.set(Math.PI / 2, 0, 0);
  return mesh;
}
export function ball(g: THREE.Group, m: M, r: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geoSphere, m);
  mesh.scale.setScalar(r * 2);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

/** The lit glass of a screen, facing the front. */
export function screen(g: THREE.Group, mt: Materials, w: number, h: number, x: number, y: number, z: number) {
  return box(g, mt.get("#24384f", { emissive: "#1d3550", rough: 0.08, env: 0.6 }), w, h, 0.003, x, y, z, 0);
}

const FRONTS = new Set(["#efe8da", "#b48a5e"]);
/** Something built from simple shapes (mm): the catalogue's looks, the assistant's builds and the
 *  cabinets. Door and drawer fronts get a shaker frame, steel shines, wood shows its grain. */
export function fromParts(g: THREE.Group, mt: Materials, parts: Part[]) {
  const S = 0.001;
  for (const q of parts.slice(0, 80)) {
    const col = /^#[0-9a-f]{6}$/i.test(q.color ?? "") ? q.color!.toLowerCase() : C.stone;
    const m = mt.auto(col);
    const w = Math.max(q.w, 1) * S, h = Math.max(q.h, 1) * S, d = Math.max(q.d, 1) * S;
    if (q.shape === "cylinder") {
      const c = cyl(g, m, 0.5, 1, q.x * S, 0, q.z * S);
      c.position.y = q.y * S + h / 2;
      // a thin disc standing up is a wheel (across x) or a face (a clock, a dial, a speaker cone)
      if (w < 0.45 * Math.min(d, h)) { c.scale.set(h, w, d); c.rotation.z = Math.PI / 2; }
      else if (d < 0.45 * Math.min(w, h)) { c.scale.set(w, d, h); c.rotation.x = Math.PI / 2; }
      // a long thin one lying down is a rail or a rod
      else if (w > 2.5 * Math.max(d, h)) { c.scale.set(h, w, d); c.rotation.z = Math.PI / 2; }
      else if (d > 2.5 * Math.max(w, h)) { c.scale.set(w, d, h); c.rotation.x = Math.PI / 2; }
      else c.scale.set(w, h, d);
      continue;
    }
    if (q.shape === "sphere") { ball(g, m, 0.5, q.x * S, q.y * S + h / 2, q.z * S).scale.set(w, h, d); continue; }
    // a cabinet door or drawer front, 19 thick: a shaker frame round a flat panel
    if (FRONTS.has(col) && q.d >= 15 && q.d <= 25 && q.w >= 120 && q.h >= 120) {
      shaker(g, m, w, h, d, q.x * S, q.y * S, q.z * S);
      continue;
    }
    box(g, m, w, h, d, q.x * S, q.y * S, q.z * S);
  }
}

/** A shaker front: a flat panel with a frame of stiles and rails standing proud of it, a small gap all round. */
export function shaker(g: THREE.Group, m: M, w: number, h: number, d: number, x: number, y: number, z: number) {
  const gap = 0.0025, W = w - 2 * gap, H = h - 2 * gap;
  const f = Math.min(0.07, W * 0.18, H * 0.25);
  box(g, m, W, H, d * 0.6, x, y + gap, z - d * 0.2, 0.002);
  if (H < 0.16) { box(g, m, W, H, d, x, y + gap, z, 0.003); return; }
  const zf = z + d * 0.1;
  box(g, m, f, H, d * 0.8, x - W / 2 + f / 2, y + gap, zf, 0.003);
  box(g, m, f, H, d * 0.8, x + W / 2 - f / 2, y + gap, zf, 0.003);
  box(g, m, W - 2 * f + 0.002, f, d * 0.8, x, y + gap, zf, 0.003);
  box(g, m, W - 2 * f + 0.002, f, d * 0.8, x, y + gap + H - f, zf, 0.003);
}

/** Door and drawer fronts on a cabinet, front face at z = d/2: shaker doors, slab drawer fronts, pulls. */
export function front(g: THREE.Group, mt: Materials, kind: string | null | undefined, w: number, y0: number, y1: number, d: number, color = C.door) {
  if (kind === "open" || kind === "panel" || kind === "appliance") return;
  const m = mt.auto(color);
  const z = d / 2 + 0.0095, t = 0.019, h = y1 - y0;
  const pull = mt.get(C.nickel, { metal: 0.85, rough: 0.28, env: 1 });
  const bar = (x: number, y: number, len: number, vertical: boolean) => {
    const L = vertical ? len : len;
    if (vertical) { box(g, pull, 0.012, L, 0.012, x, y, z + 0.03, 0.005); for (const e of [0.015, L - 0.025]) box(g, pull, 0.01, 0.01, 0.03, x, y + e, z + 0.015, 0.004); }
    else { box(g, pull, L, 0.012, 0.012, x, y, z + 0.03, 0.005); for (const e of [-L / 2 + 0.015, L / 2 - 0.015]) box(g, pull, 0.01, 0.01, 0.03, x + e, y, z + 0.015, 0.004); }
  };
  const doors = (yb: number, yt: number, count: number) => {
    const dw = w / count;
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + dw * (i + 0.5);
      shaker(g, m, dw, yt - yb, t, x, yb, z - t / 2);
      const hx = count === 1 ? (w > 0.45 ? -dw / 2 + 0.05 : dw / 2 - 0.05) : i === 0 ? dw / 2 - 0.05 : -dw / 2 + 0.05;
      bar(x + hx, yt - 0.06 - 0.14 > yb ? yt - 0.2 : yb + 0.02, 0.14, true);
    }
  };
  const drawer = (yb: number, yt: number) => { shaker(g, m, w, yt - yb, t, 0, yb, z - t / 2); bar(0, yb + (yt - yb) / 2 - 0.006, Math.min(0.2, w * 0.4), false); };
  if (kind === "drawers") { const n = h > 0.6 ? 4 : 3; for (let i = 0; i < n; i++) drawer(y0 + (h * i) / n, y0 + (h * (i + 1)) / n); }
  else if (kind === "door_drawer" || kind === "sink") {
    if (kind === "sink") shaker(g, m, w, 0.16, t, 0, y1 - 0.16, z - t / 2); else drawer(y1 - 0.16, y1);
    doors(y0, y1 - 0.16, w > 0.55 ? 2 : 1);
  } else doors(y0, y1, w > 0.55 || kind === "doors" ? 2 : 1);
}

/** A gooseneck faucet on its deck at y, the spout reaching forward over the bowl. */
export function faucet(g: THREE.Group, mt: Materials, x: number, y: number, z: number, tall: number) {
  const fm = mt.get(C.steel, { metal: 0.9, rough: 0.15, env: 1.3 });
  cyl(g, fm, 0.025, 0.02, x, y, z);
  cyl(g, fm, 0.013, tall, x, y + 0.02, z);
  const reach = tall * 0.6;
  cyl(g, fm, 0.012, reach, x, y + tall + 0.01, z + reach / 2, Math.PI / 2);
  cyl(g, fm, 0.013, 0.07, x, y + tall - 0.06, z + reach);
  box(g, fm, 0.012, 0.012, 0.07, x + 0.035, y + tall * 0.55, z + 0.025, 0.004);
}

