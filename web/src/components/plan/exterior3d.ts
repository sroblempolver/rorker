// The outside of the building in 3D, built to the house rules: pitched roofs with eaves, fascia,
// soffits, gutters and downspouts; porches on a platform with steps, balconies with railings, canopies
// on posts; window and door trim; a foundation; and the lot around it with a lawn, drive and walk.
// Layout comes from lib/plan/exterior.ts; this file only turns it into meshes.
import * as THREE from "three";
import { pointInPoly } from "@/lib/plan/geometry";
import { outward, type Exterior, type RoofPart, type Side, type Zone } from "@/lib/plan/exterior";
import { FINISH, RULES } from "@/lib/plan/rules";
import type { BBox, Floor, Opening, Pt } from "@/lib/plan/types";

const S = 0.001;

/** Something the cutaway fades as you zoom in: roofs lift off, walls facing you fall away. */
export type Fade = { mats: THREE.Material[]; centre: THREE.Vector3; floorIndex: number; role: "wall" | "roof" | "slab" | "thing" };

// --------------------------------------------------------------------------- surfaces

const canvases = new Map<string, HTMLCanvasElement>();
/** A small tileable picture drawn once (siding laps, shingles, grass), as a texture in metres. */
function texture(name: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, mw: number, mh: number) {
  let c = canvases.get(name);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d")!, w, h);
    canvases.set(name, c);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / mw, 1 / mh);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// lap siding: a board every 180 mm with a soft shadow line under each lap
const sidingTex = () => texture("siding", 64, 64, (g, W, H) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#d9d9d9"); grd.addColorStop(0.12, "#f6f6f6"); grd.addColorStop(1, "#ffffff");
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = "#b9b9b9"; g.fillRect(0, 0, W, 3);
}, 1, 0.18);
// architectural shingles: courses of 140 mm, tabs staggered, a little tone variation
const shingleTex = () => texture("shingles", 256, 144, (g, W, H) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  const rows = 4, rh = H / rows;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 0.5;
    for (let k = -1; k < 4; k++) {
      const x = (k + off) * (W / 3);
      const v = 200 + Math.round(rnd() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 1, r * rh + 1, W / 3 - 2, rh - 2);
    }
    g.fillStyle = "#8a8a8a"; g.fillRect(0, r * rh + rh - 3, W, 3);
  }
}, 1, 0.56);
const grassTex = () => texture("grass", 128, 128, (g, W, H) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 900; i++) { const v = 205 + Math.round(rnd() * 50); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
}, 2, 2);
// concrete paving with a saw cut every 3 m
const pavingTex = () => texture("paving", 128, 128, (g, W, H) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#c4c4c4"; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, H);
}, 3, 3);
// a sectional garage door: a groove every 530 mm
const garageTex = () => texture("garage", 64, 64, (g, W, H) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#bdbdbd"; g.fillRect(0, H - 4, W, 4);
  g.fillStyle = "#e4e4e4"; g.fillRect(0, H - 7, W, 3);
}, 1, 0.53);

/** Panel grooves for a garage door leaf (its UVs are in metres up the door). */
export const garagePanels = () => garageTex();

const std = (color: string, o: { map?: THREE.Texture; rough?: number; metal?: number; opacity?: number; side?: THREE.Side } = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, map: o.map ?? null, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, transparent: true, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
  if (o.opacity != null && o.opacity < 1) m.depthWrite = false;
  return m;
};

/** Outside walls: lap siding lined up with the floor, so headers and walls carry the same laps. */
export function sidingMaterial(color: string = FINISH.siding, from = 0) {
  const m = std(color, { map: sidingTex(), rough: 0.9 });
  m.map!.offset.y = -((from * S) / 0.18);
  return m;
}
export const trimMaterial = () => std(FINISH.trim, { rough: 0.6 });

// --------------------------------------------------------------------------- small builders

/** A box between two points, `w` across and `h` up (an upright board along a slope stays upright). */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, m: THREE.Material) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const x = dir.normalize();
  let up = new THREE.Vector3(0, 1, 0).sub(x.clone().multiplyScalar(x.y));
  if (up.lengthSq() < 1e-6) up = new THREE.Vector3(1, 0, 0);
  up.normalize();
  const z = new THREE.Vector3().crossVectors(x, up);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), m);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  return mesh;
}

/** A box from plan mm: [x0, y0, x1, y1] between heights z0 and z1. */
function block(r: BBox, z0: number, z1: number, m: THREE.Material | THREE.Material[]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry((r[2] - r[0]) * S, Math.max(1, z1 - z0) * S, (r[3] - r[1]) * S), m);
  mesh.position.set(((r[0] + r[2]) / 2) * S, ((z0 + z1) / 2) * S, ((r[1] + r[3]) / 2) * S);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Flat faces (each a convex polygon, eave edge first) as one mesh, shingles running along the eaves. */
function faces(polys: THREE.Vector3[][], m: THREE.Material) {
  const pos: number[] = [], uv: number[] = [];
  for (const f of polys) {
    const e = f[1].clone().sub(f[0]).normalize();
    const n = new THREE.Vector3().crossVectors(f[1].clone().sub(f[0]), f[2].clone().sub(f[0])).normalize();
    let up = new THREE.Vector3().crossVectors(n, e).normalize();
    if (up.y < 0) up = up.negate();
    for (let i = 1; i < f.length - 1; i++) for (const p of [f[0], f[i], f[i + 1]]) {
      pos.push(p.x, p.y, p.z);
      const d = p.clone().sub(f[0]);
      uv.push(d.dot(e), d.dot(up));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S);

// --------------------------------------------------------------------------- roofs

interface RoofOut { group: THREE.Group; mats: THREE.Material[]; main: THREE.Object3D | null }

/** One roof: the shingled planes plus fascia, soffit, gutters, downspouts and siding in the gable ends. */
function roofPart(r: RoofPart, ex: Exterior, below: Pt[][]): RoofOut {
  const g = new THREE.Group();
  const roofM = std(FINISH.roof, { map: shingleTex(), rough: 0.95, side: THREE.DoubleSide });
  const trimM = std(FINISH.fascia, { rough: 0.6 });
  const soffitM = std(FINISH.soffit, { rough: 0.9, side: THREE.DoubleSide });
  const gutterM = std(FINISH.gutter, { rough: 0.5, metal: 0.1 });
  const sideM = sidingMaterial(FINISH.siding, r.eaveY - ex.base(r.floorIndex));
  const mats = [roofM, trimM, soffitM, gutterM, sideM];
  const [x0, y0, x1, y1] = r.rect;
  const grade = -ex.rules.plinth;

  if (r.kind === "flat") {
    const o = RULES.flatOverhang;
    const slab = block([x0 - o, y0 - o, x1 + o, y1 + o], r.eaveY, r.eaveY + 250, [trimM, trimM, roofM, soffitM, trimM, trimM]);
    g.add(slab);
    return { group: g, mats, main: slab };
  }

  const t = Math.tan((r.pitch * Math.PI) / 180);
  const o = ex.rules.eave;
  // overhang on every side but the one a lean-to rises against
  const ov = (s: Side) => (r.kind === "shed" && r.high === s ? 0 : o);
  const X0 = x0 - ov("x0"), Y0 = y0 - ov("y0"), X1 = x1 + ov("x1"), Y1 = y1 + ov("y1");
  const e = r.eaveY - o * t; // the eave edge, below the wall top so the plane passes over the wall
  const polys: THREE.Vector3[][] = [];
  const eaves: [THREE.Vector3, THREE.Vector3][] = [];
  const rakes: [THREE.Vector3, THREE.Vector3][] = [];
  const along = x1 - x0 >= y1 - y0;

  if (r.kind === "shed") {
    const hs = r.high!;
    // the plane falls from the high wall to the opposite eave
    const run = hs === "x0" || hs === "x1" ? x1 - x0 : y1 - y0;
    const top = r.eaveY + run * t;
    const hY = (x: number, y: number) => top - (hs === "x0" ? x - x0 : hs === "x1" ? x1 - x : hs === "y0" ? y - y0 : y1 - y) * t;
    const c = [V(X0, hY(X0, Y1), Y1), V(X1, hY(X1, Y1), Y1), V(X1, hY(X1, Y0), Y0), V(X0, hY(X0, Y0), Y0)];
    // eave edge first: the low side
    const order = hs === "y0" ? [0, 1, 2, 3] : hs === "y1" ? [2, 3, 0, 1] : hs === "x0" ? [1, 2, 3, 0] : [3, 0, 1, 2];
    const q = order.map((i) => c[i]);
    polys.push(q);
    eaves.push([q[0], q[1]]);
    rakes.push([q[1], q[2]], [q[3], q[0]]);
    // siding in the triangles under the slope at both ends
    const ends: THREE.Vector3[][] = hs === "y0" || hs === "y1"
      ? [[V(x0, r.eaveY, hs === "y0" ? y1 : y0), V(x0, r.eaveY, hs === "y0" ? y0 : y1), V(x0, hY(x0, hs === "y0" ? y0 : y1), hs === "y0" ? y0 : y1)],
         [V(x1, r.eaveY, hs === "y0" ? y0 : y1), V(x1, r.eaveY, hs === "y0" ? y1 : y0), V(x1, hY(x1, hs === "y0" ? y0 : y1), hs === "y0" ? y0 : y1)]]
      : [[V(hs === "x0" ? x1 : x0, r.eaveY, y0), V(hs === "x0" ? x0 : x1, r.eaveY, y0), V(hs === "x0" ? x0 : x1, hY(hs === "x0" ? x0 : x1, y0), y0)],
         [V(hs === "x0" ? x0 : x1, r.eaveY, y1), V(hs === "x0" ? x1 : x0, r.eaveY, y1), V(hs === "x0" ? x0 : x1, hY(hs === "x0" ? x0 : x1, y1), y1)]];
    for (const tri of ends) g.add(faces([tri], sideM));
  } else {
    // hip or gable along the long side; u runs along the ridge, v across it
    const P = (u: number, v: number, h: number) => (along ? V(u, h, v) : V(v, h, u));
    const U0 = along ? X0 : Y0, U1 = along ? X1 : Y1, W0 = along ? Y0 : X0, W1 = along ? Y1 : X1;
    const span = W1 - W0, mid = (W0 + W1) / 2;
    const ridge = e + (span / 2) * t;
    const inset = r.kind === "hip" ? Math.min(span / 2, (U1 - U0) / 2) : 0;
    const R0 = P(U0 + inset, mid, ridge), R1 = P(U1 - inset, mid, ridge);
    const a = P(U0, W0, e), b = P(U1, W0, e), c = P(U1, W1, e), d = P(U0, W1, e);
    polys.push([c, d, R0, R1], [a, b, R1, R0]);
    eaves.push([c, d], [a, b]);
    if (r.kind === "hip") {
      polys.push([d, a, R0], [b, c, R1]);
      eaves.push([d, a], [b, c]);
    } else {
      rakes.push([a, R0], [R0, d], [b, R1], [R1, c]);
      // gable ends: siding up to the roof, at the wall line
      const wu0 = along ? x0 : y0, wu1 = along ? x1 : y1, ww0 = along ? y0 : x0, ww1 = along ? y1 : x1;
      const peak = r.eaveY + ((ww1 - ww0) / 2) * t;
      for (const u of [wu0, wu1]) g.add(faces([[P(u, ww0, r.eaveY), P(u, ww1, r.eaveY), P(u, (ww0 + ww1) / 2, peak)]], sideM));
    }
  }
  const roof = faces(polys, roofM);
  g.add(roof);

  // fascia on every edge, gutters along the eaves
  const F = RULES.fascia * S;
  for (const [p, q] of [...eaves, ...rakes]) {
    const fb = beam(p, q, 0.03, F, trimM);
    fb.position.y -= F / 2 - 0.02;
    g.add(fb);
  }
  for (const [p, q] of eaves) {
    const out = new THREE.Vector3().crossVectors(q.clone().sub(p), new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(-0.07);
    const gt = beam(p.clone().add(out), q.clone().add(out), 0.12, 0.11, gutterM);
    gt.position.y -= 0.08;
    g.add(gt);
  }
  // soffits: flat under the overhang, from the wall out to the eave
  const soffit = (r0: BBox) => { const m = block(r0, e - 6, e - 5, soffitM); m.castShadow = false; g.add(m); };
  if (ov("y0")) soffit([X0, Y0, X1, y0]);
  if (ov("y1")) soffit([X0, y1, X1, Y1]);
  if (ov("x0")) soffit([X0, y0, x0, y1]);
  if (ov("x1")) soffit([x1, y0, X1, y1]);

  // downspouts at the outside corners of the walls under each eave, down to the grade
  const corners: Pt[] = [];
  for (const [p, q] of eaves) for (const v of [p, q]) {
    const cx = Math.abs(v.x / S - X0) < 1 ? x0 : Math.abs(v.x / S - X1) < 1 ? x1 : null;
    const cy = Math.abs(v.z / S - Y0) < 1 ? y0 : Math.abs(v.z / S - Y1) < 1 ? y1 : null;
    if (cx == null || cy == null) continue;
    if (corners.some((k) => k[0] === cx && k[1] === cy)) continue;
    const sx = cx === x0 ? -1 : 1, sy = cy === y0 ? -1 : 1;
    // skip a corner whose spout would come down through a lower roof or into the house
    const probe: Pt = [cx + sx * 300, cy + sy * 300];
    if (below.some((ring) => pointInPoly(probe, ring))) continue;
    corners.push([cx, cy]);
    const px = cx + sx * 60, py = cy + sy * 60;
    const top = e - 90;
    const spout = new THREE.Mesh(new THREE.BoxGeometry(0.07, (top - grade) * S, 0.07), gutterM);
    spout.position.set(px * S, ((top + grade) / 2) * S, py * S);
    spout.castShadow = true;
    g.add(spout);
    // an elbow from the top of the spout up into the gutter at the eave corner
    const ex0 = cx === x0 ? X0 : X1, ey0 = cy === y0 ? Y0 : Y1;
    g.add(beam(V(px, top, py), V(ex0 - sx * 70, e - 60, ey0 - sy * 70), 0.07, 0.07, gutterM));
  }
  return { group: g, mats, main: roof };
}

/** All the roofs, each fading on its own as the cutaway opens the house. */
export function buildRoofs(ex: Exterior, add: (o: THREE.Object3D, mats: THREE.Material[], centre: THREE.Vector3, floorIndex: number, main: THREE.Object3D | null) => void) {
  for (const r of ex.roofs) {
    const below = ex.rings.slice(0, r.floorIndex + 1).flat();
    const out = roofPart(r, ex, below);
    const c = new THREE.Vector3(((r.rect[0] + r.rect[2]) / 2) * S, r.eaveY * S, ((r.rect[1] + r.rect[3]) / 2) * S);
    add(out.group, out.mats, c, r.floorIndex + 1, r.main ? out.main : null);
  }
}

// --------------------------------------------------------------------------- porches and balconies

/** The porch platform with its steps, a balcony's slab and railing, a canopy on the posts. */
export function buildZone(z: Zone, ex: Exterior, dressed: boolean, add: (o: THREE.Object3D, mats: THREE.Material[], role: Fade["role"]) => void) {
  const H = ex.height(z.floorIndex);
  const r = z.rect;
  const trimM = trimMaterial();
  const deckM = std(FINISH.deck, { rough: 0.8 });
  const fdM = std(FINISH.foundation, { rough: 0.95 });
  // the side away from the house, where the steps or the open railing are
  const opp: Record<Side, Side> = { x0: "x1", x1: "x0", y0: "y1", y1: "y0" };
  const open = (["x0", "y0", "x1", "y1"] as Side[]).filter((s) => s !== z.house);
  if (z.kind === "porch") {
    const plinth = ex.rules.plinth;
    const g = new THREE.Group();
    g.add(block(r, -plinth, -20, fdM), block(r, -20, 0, deckM));
    // steps down the front, the width of the gap between the posts
    const front = z.house ? opp[z.house] : "y1";
    const n = Math.max(1, Math.round(plinth / RULES.step));
    const rise = plinth / n;
    const wide = front === "y0" || front === "y1" ? r[2] - r[0] : r[3] - r[1];
    const sw = Math.min(wide - 600, Math.max(1500, wide * 0.6));
    const c = front === "y0" || front === "y1" ? (r[0] + r[2]) / 2 : (r[1] + r[3]) / 2;
    for (let k = 1; k < n; k++) {
      const d = (n - k) * RULES.tread;
      const z1 = -plinth + k * rise;
      const st: BBox = front === "y1" ? [c - sw / 2, r[3], c + sw / 2, r[3] + d] : front === "y0" ? [c - sw / 2, r[1] - d, c + sw / 2, r[1]]
        : front === "x1" ? [r[2], c - sw / 2, r[2] + d, c + sw / 2] : [r[0] - d, c - sw / 2, r[0], c + sw / 2];
      g.add(block(st, -plinth, z1, k === n - 1 ? deckM : fdM));
    }
    add(g, [], "thing");
  } else if (dressed) {
    const g = new THREE.Group();
    g.add(block(r, -250, -20, trimM), block(r, -20, 0, deckM));
    // a glass railing with a top rail on the open sides
    const glassM = std(FINISH.glass, { opacity: 0.28, rough: 0.1, metal: 0.2 });
    const railM = std(FINISH.rail, { rough: 0.5, metal: 0.3 });
    const R = RULES.railing;
    const edge = (s: Side): [THREE.Vector3, THREE.Vector3] => {
      const i = 40;
      if (s === "y0") return [V(r[0] + i, 0, r[1] + i), V(r[2] - i, 0, r[1] + i)];
      if (s === "y1") return [V(r[0] + i, 0, r[3] - i), V(r[2] - i, 0, r[3] - i)];
      if (s === "x0") return [V(r[0] + i, 0, r[1] + i), V(r[0] + i, 0, r[3] - i)];
      return [V(r[2] - i, 0, r[1] + i), V(r[2] - i, 0, r[3] - i)];
    };
    for (const s of open) {
      const [a, b] = edge(s);
      const panel = beam(a.clone().setY(R * S * 0.5), b.clone().setY(R * S * 0.5), 0.012, (R - 80) * S, glassM);
      panel.castShadow = false;
      g.add(panel, beam(a.clone().setY(R * S), b.clone().setY(R * S), 0.06, 0.05, railM));
      for (const p of [a, b]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, R * S, 0.06), railM); post.position.set(p.x, (R * S) / 2, p.z); g.add(post); }
    }
    add(g, [trimM, deckM, glassM, railM], "wall");
  }
  if (z.cover === "canopy" && dressed) {
    const o = 150;
    const cr: BBox = [r[0] - (z.house === "x0" ? 0 : o), r[1] - (z.house === "y0" ? 0 : o), r[2] + (z.house === "x1" ? 0 : o), r[3] + (z.house === "y1" ? 0 : o)];
    const roofM = std(FINISH.roof, { rough: 0.9 });
    const fM = std(FINISH.fascia, { rough: 0.6 });
    const sM = std(FINISH.soffit, { rough: 0.9 });
    add(block(cr, H - 250, H, [fM, fM, roofM, sM, fM, fM]), [roofM, fM, sM], "roof");
  }
}

// --------------------------------------------------------------------------- doors and windows

/** Trim, sills, frames and mullions on an outside door or window, on the outside face. */
export function openingTrim(o: Opening, f: Floor, span: [number, number], wallH: number, front: boolean, trimM: THREE.Material, frameM: THREE.Material): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const n = outward(f, o);
  const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) || 1;
  const u: Pt = [(o.b[0] - o.a[0]) / L, (o.b[1] - o.a[1]) / L];
  const face = o.thickness_mm / 2;
  const at = (s: number, off: number, h: number) => V(o.a[0] + u[0] * s + n[0] * off, h, o.a[1] + u[1] * s + n[1] * off);
  const [bot, top] = [span[0], Math.min(span[1], wallH)];
  const cw = 90, proud = 25;
  // casing: head and both jambs, standing proud of the siding
  out.push(beam(at(-cw, face + proud / 2, top + cw / 2), at(L + cw, face + proud / 2, top + cw / 2), proud * S, cw * S, trimM));
  for (const s of [-cw / 2, L + cw / 2]) out.push(beam(at(s, face + proud / 2, bot), at(s, face + proud / 2 + 0.01, top), proud * S, cw * S, trimM));
  if (o.kind === "window") {
    // sill: wider than the casing and sloped out
    out.push(beam(at(-cw - 40, face + 35, bot - 25), at(L + cw + 40, face + 35, bot - 25), 80 * S, 50 * S, trimM));
    // the sash frame inside the opening and a mullion on wide ones
    const inner = face - 40, fw = 55;
    out.push(beam(at(0, inner, top - fw / 2), at(L, inner, top - fw / 2), 50 * S, fw * S, frameM));
    out.push(beam(at(0, inner, bot + fw / 2), at(L, inner, bot + fw / 2), 50 * S, fw * S, frameM));
    for (const s of [fw / 2, L - fw / 2, ...(L > 1300 ? [L / 2] : [])]) out.push(beam(at(s, inner, bot), at(s, inner + 0.01, top), 50 * S, fw * S, frameM));
    if (top - bot > 1300) out.push(beam(at(0, inner, bot + (top - bot) * 0.62), at(L, inner, bot + (top - bot) * 0.62), 45 * S, 40 * S, frameM));
  } else if (o.kind === "sliding_door" || (o.kind === "double_door" && !front)) {
    out.push(beam(at(L / 2, face - 40, 0), at(L / 2, face - 40 + 0.01, top), 50 * S, 55 * S, frameM));
  }
  return out;
}

// --------------------------------------------------------------------------- the lot

/** Lawn, street, drive and walk around the building, at the grade. */
export function buildSite(ex: Exterior, ground: Floor | undefined): THREE.Group {
  const g = new THREE.Group();
  const s = ex.site;
  const grade = -ex.rules.plinth;
  const flatPoly = (pts: Pt[], y: number, m: THREE.Material) => {
    const shape = new THREE.Shape(pts.map(([x, py]) => new THREE.Vector2(x * S, -py * S)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y * S, 0);
    const mesh = new THREE.Mesh(geo, m);
    mesh.receiveShadow = true;
    return mesh;
  };
  const rect = (b: BBox): Pt[] => [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
  g.add(flatPoly(rect(s.lot), grade, std(FINISH.lawn, { map: grassTex(), rough: 1 })));
  g.add(flatPoly(rect(s.street), grade - 5, std("#2a2b2d", { rough: 1 })));
  // a kerb line along the lot
  const kerbY = s.front === "bottom" ? s.street[1] : s.street[3];
  g.add(block([s.lot[0] - 40000, kerbY - 75, s.lot[2] + 40000, kerbY + 75], grade - 5, grade + 100, std("#9a968d", { rough: 0.9 })));
  const pave = std(FINISH.paving, { map: pavingTex(), rough: 0.95 });
  // the drive rises from the street to the garage floor
  if (s.drive) {
    const d = s.drive;
    const door = ground?.openings.find((o) => o.exterior && o.kind === "garage_door");
    const geo = new THREE.BufferGeometry();
    // the first two corners are at the garage door
    const pts = d.map((p, i) => [p[0] * S, (i < 2 && door ? -10 : grade + 4) * S, p[1] * S]);
    // two triangles, facing up whichever way the drive runs
    const tri = [0, 1, 2, 0, 2, 3];
    const pos = tri.flatMap((i) => pts[i]);
    const uv = tri.flatMap((i) => [pts[i][0], pts[i][2]]);
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, pave);
    (mesh.material as THREE.Material).side = THREE.DoubleSide;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  if (s.path) g.add(flatPoly(s.path, grade + 6, pave));
  // a stoop with steps outside the other doors
  const fdM = std(FINISH.foundation, { rough: 0.95 });
  for (const st of ex.stoops) {
    const o = st.door;
    const m: Pt = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
    const face = o.thickness_mm / 2;
    const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) || 1;
    const u: Pt = [(o.b[0] - o.a[0]) / L, (o.b[1] - o.a[1]) / L];
    const n = st.out;
    const steps = Math.max(1, Math.round(ex.rules.plinth / RULES.step));
    for (let k = 0; k < steps; k++) {
      // the top step is a landing outside the door; each one below reaches a tread further out
      const d1 = face + 900 + (steps - 1 - k) * RULES.tread;
      const c0: Pt = [m[0] + n[0] * face, m[1] + n[1] * face], c1: Pt = [m[0] + n[0] * d1, m[1] + n[1] * d1];
      const hw = st.width / 2;
      const xs = [c0[0] - u[0] * hw, c0[0] + u[0] * hw, c1[0] - u[0] * hw, c1[0] + u[0] * hw];
      const ys = [c0[1] - u[1] * hw, c0[1] + u[1] * hw, c1[1] - u[1] * hw, c1[1] + u[1] * hw];
      g.add(block([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], grade, grade + ((k + 1) * ex.rules.plinth) / steps, fdM));
    }
  }
  return g;
}
