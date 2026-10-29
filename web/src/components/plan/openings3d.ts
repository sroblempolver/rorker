// Doors and windows as they're really built, for the finished house: a window's frame, two sashes with
// glass and grilles, the jamb liners and the stool inside; a door's jamb, threshold, panelled leaf and
// its lockset; sidelights beside a wide front door, French doors, a patio slider with its track, and a
// sectional garage door. Outside, the casing, head cap, sloped sill and apron. Every opening is a few
// meshes (its parts merged by material), so a house with thirty openings stays light on a phone.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { outward } from "@/lib/plan/exterior";
import { FINISH } from "@/lib/plan/rules";
import type { Floor, Opening, Pt } from "@/lib/plan/types";
import { skyEnv, woodGrain } from "./looks3d";

const S = 0.001;

/** Parts of one opening in its own frame, in mm: `s` along it from `a`, `o` out from the middle of the
 *  wall (outside is +), `h` up from the floor. Merged into one mesh per material at the end. */
class Kit {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(private sign: number) {}
  private add(m: THREE.Material, g: THREE.BufferGeometry) {
    const l = this.parts.get(m);
    if (l) l.push(g); else this.parts.set(m, [g]);
  }
  box(m: THREE.Material, s0: number, s1: number, o0: number, o1: number, h0: number, h1: number) {
    if (s1 - s0 < 0.5 || o1 - o0 < 0.5 || h1 - h0 < 0.5) return;
    const g = new THREE.BoxGeometry((s1 - s0) * S, (h1 - h0) * S, (o1 - o0) * S);
    g.translate(((s0 + s1) / 2) * S, ((h0 + h1) / 2) * S, (this.sign * (o0 + o1)) / 2 * S);
    this.add(m, g);
  }
  /** a round thing standing out of the face (a knob's rose, a deadbolt) at `o`, sticking out by `d` */
  disc(m: THREE.Material, s: number, o: number, h: number, r: number, d: number) {
    const g = new THREE.CylinderGeometry(r * S, r * S, Math.abs(d) * S, 16);
    g.rotateX(Math.PI / 2);
    g.translate(s * S, h * S, this.sign * (o + d / 2) * S);
    this.add(m, g);
  }
  ball(m: THREE.Material, s: number, o: number, h: number, r: number) {
    const g = new THREE.SphereGeometry(r * S, 14, 10);
    g.translate(s * S, h * S, this.sign * o * S);
    this.add(m, g);
  }
  /** a sloped board (a sill shedding water): its outer edge `drop` lower than its inner one */
  slope(m: THREE.Material, s0: number, s1: number, o0: number, o1: number, h0: number, h1: number, drop: number) {
    const g = new THREE.BoxGeometry((s1 - s0) * S, (h1 - h0) * S, (o1 - o0) * S);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0 && p.getY(i) > 0) p.setY(i, p.getY(i) - drop * S);
    g.computeVertexNormals();
    if (this.sign < 0) { g.scale(1, 1, -1); flip(g); }
    g.translate(((s0 + s1) / 2) * S, ((h0 + h1) / 2) * S, (this.sign * (o0 + o1)) / 2 * S);
    this.add(m, g);
  }
  build(o: Opening): { obj: THREE.Group; mats: THREE.Material[] } {
    const g = new THREE.Group();
    const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) || 1;
    const u = new THREE.Vector3((o.b[0] - o.a[0]) / L, 0, (o.b[1] - o.a[1]) / L);
    const up = new THREE.Vector3(0, 1, 0);
    const z = new THREE.Vector3().crossVectors(u, up);
    g.matrix.makeBasis(u, up, z).setPosition(o.a[0] * S, 0, o.a[1] * S);
    g.matrixAutoUpdate = false;
    for (const [m, list] of this.parts) {
      const geo = list.length === 1 ? list[0] : mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)));
      if (list.length > 1) list.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = !(m as THREE.MeshStandardMaterial).transparent;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return { obj: g, mats: [...this.parts.keys()] };
  }
}
/** mirrored geometry turns inside out: put the triangles back the right way round */
function flip(g: THREE.BufferGeometry) {
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
}

const std = (color: string, rough = 0.6, metal = 0, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: map ?? null, transparent: true });
const shiny = (color: string, rough: number, metal: number) => { const m = std(color, rough, metal); m.envMap = skyEnv(); m.envMapIntensity = 1; return m; };
/** Window glass: dark, a little see-through, reflecting the sky. */
export function glassMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#26343c", roughness: 0.03, metalness: 0.65, transparent: true, opacity: 0.8, depthWrite: false, envMap: skyEnv(), envMapIntensity: 1.8 });
  return m;
}

export interface OpeningLook {
  /** the main way in (sidelights, a craftsman door and a brass handleset) */
  front: boolean;
  /** the casing, head cap, sill and apron on the outside face */
  trim: boolean;
  /** draw the door leaf (inside a floor, doors between rooms stay open) */
  leaf: boolean;
}

/** A finished door or window, filling the opening: everything but the wall above and below it. */
export function openingFill(o: Opening, f: Floor, span: [number, number], wallH: number, look: OpeningLook) {
  const n = outward(f, o);
  const L = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) || 1;
  const u: Pt = [(o.b[0] - o.a[0]) / L, (o.b[1] - o.a[1]) / L];
  // +o is outside: which way that is in the opening's own (right-handed) frame
  const sign = n[0] * -u[1] + n[1] * u[0] >= 0 ? 1 : -1;
  const k = new Kit(sign);
  const T = Math.max(90, o.thickness_mm), F = T / 2;
  const bot = Math.max(0, span[0]), top = Math.min(span[1], wallH);
  const trim = std(FINISH.trim, 0.55), frame = std(FINISH.frame, 0.45), glass = glassMaterial();
  const door = o.kind === "door" || o.kind === "double_door";

  if (o.kind === "window") window_(k, L, F, bot, top, trim, frame, glass);
  else if (door) {
    const leafM = std(o.exterior && look.front ? FINISH.frontDoor : FINISH.door, 0.45, 0, woodGrain());
    leafM.envMap = skyEnv(); leafM.envMapIntensity = 0.35;
    const brass = shiny(look.front ? "#b8955a" : "#9a9a96", 0.3, 0.9);
    // jamb lining the opening, a threshold on the floor
    k.box(trim, 0, 40, -F, F, 0, top);
    k.box(trim, L - 40, L, -F, F, 0, top);
    k.box(trim, 0, L, -F, F, top - 40, top);
    if (o.exterior) k.box(shiny("#b9b5ab", 0.35, 0.8), 0, L, -F + 20, F + 25, 0, 22);
    const hingeAtB = o.leaves[0] ? Math.hypot(o.leaves[0].hinge[0] - o.b[0], o.leaves[0].hinge[1] - o.b[1]) < Math.hypot(o.leaves[0].hinge[0] - o.a[0], o.leaves[0].hinge[1] - o.a[1]) : false;
    const lf = o.exterior ? F - 50 : 22; // the leaf's outer face
    if (look.leaf) {
      if (o.kind === "double_door") {
        const mid = L / 2;
        const style = look.front ? "panel" : o.exterior ? "french" : "shaker";
        leaf(k, 40, mid - 2, lf, 22, top - 40, style, leafM, glass, frame, false, brass, look.front);
        leaf(k, mid + 2, L - 40, lf, 22, top - 40, style, leafM, glass, frame, true, brass, look.front);
        k.box(leafM, mid - 12, mid + 12, lf, lf + 12, 22, top - 40); // astragal
      } else if (look.front && L > 1250) {
        // a front door with a sidelight each side
        const dw = Math.min(965, L - 80 - 600), sl = (L - 80 - dw) / 2;
        const d0 = 40 + sl, d1 = d0 + dw;
        k.box(trim, d0 - 40, d0, -F, F, 0, top); k.box(trim, d1, d1 + 40, -F, F, 0, top);
        for (const [a, b] of [[40, d0 - 40], [d1 + 40, L - 40]]) sidelight(k, a, b, lf, 22, top - 40, leafM, glass, frame);
        leaf(k, d0, d1, lf, 22, top - 40, "craftsman", leafM, glass, frame, hingeAtB, brass, true);
      } else {
        const style = !o.exterior ? "shaker" : look.front ? "craftsman" : "halflite";
        leaf(k, 40, L - 40, lf, 22, top - 40, style, leafM, glass, frame, hingeAtB, brass, look.front);
      }
    }
  } else if (o.kind === "sliding_door") slider(k, L, F, top, trim, shiny("#3a3936", 0.4, 0.5), glass);
  else if (o.kind === "garage_door") garage(k, L, F, top, look.trim, std(o.exterior ? FINISH.garageDoor : "#c9c2b4", 0.55), glass, trim);

  if (look.trim && o.exterior) outsideTrim(k, L, F, bot, top, o.kind === "window", o.kind === "garage_door", trim);
  return k.build(o);
}

// --------------------------------------------------------------------------- windows

function window_(k: Kit, L: number, F: number, bot: number, top: number, trim: THREE.Material, frame: THREE.Material, glass: THREE.Material) {
  const fw = 45, f0 = F - 115, f1 = F - 22;
  // the frame all round, set a little back from the outside face
  k.box(frame, 0, fw, f0, f1, bot, top);
  k.box(frame, L - fw, L, f0, f1, bot, top);
  k.box(frame, 0, L, f0, f1, top - fw, top);
  k.box(frame, 0, L, f0, f1, bot, bot + fw);
  // jamb liners from the frame back to the room, and the stool and apron under it inside
  k.box(trim, 0, 18, -F, f0, bot, top); k.box(trim, L - 18, L, -F, f0, bot, top); k.box(trim, 0, L, -F, f0, top - 18, top);
  k.box(trim, -50, L + 50, -F - 30, f0, bot - 22, bot);
  k.box(trim, -30, L + 30, -F - 15, -F, bot - 22 - 75, bot - 22);
  // wide windows are two or three units side by side, with a mullion between
  const units = L > 2600 ? 3 : L > 1500 ? 2 : 1, mw = 70;
  const uw = (L - 2 * fw - (units - 1) * mw) / units;
  const H = top - bot - 2 * fw;
  for (let i = 0; i < units; i++) {
    const s0 = fw + i * (uw + mw), s1 = s0 + uw;
    if (i > 0) k.box(frame, s0 - mw, s0, f0, f1, bot, top);
    if (H < 650) { sash(k, s0, s1, f0 + 35, f1 - 25, bot + fw, top - fw, 50, 50, frame, glass, 0, 0); continue; }
    // double hung: the top sash outside, the bottom sash inside, meeting in the middle
    const mid = bot + fw + H / 2;
    const cols = Math.max(1, Math.min(4, Math.round(uw / 320)));
    sash(k, s0, s1, f1 - 52, f1 - 14, mid - 18, top - fw, 50, 36, frame, glass, cols, 0);
    sash(k, s0, s1, f0 + 14, f0 + 52, bot + fw, mid + 18, 70, 36, frame, glass, 0, 0);
  }
}

/** A sash: stiles, rails and the glass in them, with `cols` grille bars standing up the glass. */
function sash(k: Kit, s0: number, s1: number, o0: number, o1: number, h0: number, h1: number, bottom: number, topRail: number, frame: THREE.Material, glass: THREE.Material, cols: number, rows: number) {
  const st = 48;
  k.box(frame, s0, s0 + st, o0, o1, h0, h1);
  k.box(frame, s1 - st, s1, o0, o1, h0, h1);
  k.box(frame, s0, s1, o0, o1, h0, h0 + bottom);
  k.box(frame, s0, s1, o0, o1, h1 - topRail, h1);
  const om = (o0 + o1) / 2;
  k.box(glass, s0 + st, s1 - st, om - 3, om + 3, h0 + bottom, h1 - topRail);
  const gw = s1 - s0 - 2 * st, gh = h1 - h0 - bottom - topRail;
  for (let c = 1; c < cols; c++) {
    const x = s0 + st + (gw * c) / cols;
    k.box(frame, x - 9, x + 9, om, o1 - 4, h0 + bottom, h1 - topRail);
  }
  for (let r = 1; r < rows; r++) { const y = h0 + bottom + (gh * r) / rows; k.box(frame, s0 + st, s1 - st, om, o1 - 4, y - 9, y + 9); }
}

// --------------------------------------------------------------------------- doors

type LeafStyle = "craftsman" | "halflite" | "panel" | "french" | "shaker";

/** A door leaf between s0 and s1, its outer face at `face`, 45 thick, panels and glass on both faces. */
function leaf(k: Kit, s0: number, s1: number, face: number, h0: number, h1: number, style: LeafStyle, m: THREE.MeshStandardMaterial, glass: THREE.Material, frame: THREE.Material, handleAtStart: boolean, metal: THREE.Material, front: boolean) {
  const t = 45, back = face - t;
  k.box(m, s0, s1, back, face, h0, h1);
  const W = s1 - s0, H = h1 - h0, st = Math.min(120, W * 0.14);
  // a raised panel: a frame of mouldings round a field standing proud of the leaf (both faces)
  const mould = moulding(m);
  const panel = (a: number, b: number, c: number, d: number) => {
    for (const [fo, dir] of [[face, 1], [back, -1]] as const) {
      const p = (x: number) => fo + dir * x;
      const lo = Math.min(p(0), p(6)), hi = Math.max(p(0), p(6));
      k.box(mould, a, b, lo, hi, c, c + 18); k.box(mould, a, b, lo, hi, d - 18, d);
      k.box(mould, a, a + 18, lo, hi, c, d); k.box(mould, b - 18, b, lo, hi, c, d);
      const l2 = Math.min(p(0), p(9)), h2 = Math.max(p(0), p(9));
      k.box(m, a + 55, b - 55, l2, h2, c + 55, d - 55);
    }
  };
  const lite = (a: number, b: number, c: number, d: number, cols: number, rows: number) => {
    k.box(glass, a, b, back - 1, face + 1, c, d);
    for (const [fo, dir] of [[face, 1], [back, -1]] as const) {
      const lo = Math.min(fo, fo + dir * 10), hi = Math.max(fo, fo + dir * 10);
      k.box(frame, a - 12, b + 12, lo, hi, c - 12, c); k.box(frame, a - 12, b + 12, lo, hi, d, d + 12);
      k.box(frame, a - 12, a, lo, hi, c, d); k.box(frame, b, b + 12, lo, hi, c, d);
      for (let i = 1; i < cols; i++) { const x = a + ((b - a) * i) / cols; k.box(frame, x - 8, x + 8, lo, hi, c, d); }
      for (let i = 1; i < rows; i++) { const y = c + ((d - c) * i) / rows; k.box(frame, a, b, lo, hi, y - 8, y + 8); }
    }
  };
  const x0 = s0 + st, x1 = s1 - st, cx = (s0 + s1) / 2, gap = 60;
  if (style === "craftsman") {
    // three lites over a shelf, two tall panels under it
    const g1 = h1 - st, g0 = h0 + H * 0.7;
    const lw = (x1 - x0 - 2 * 40) / 3;
    for (let i = 0; i < 3; i++) lite(x0 + i * (lw + 40), x0 + i * (lw + 40) + lw, g0, g1, 1, 1);
    for (const [fo, dir] of [[face, 1], [back, -1]] as const) { const lo = Math.min(fo, fo + dir * 28), hi = Math.max(fo, fo + dir * 28); k.box(m, s0 + 25, s1 - 25, lo, hi, g0 - 70, g0 - 40); }
    panel(x0, cx - gap / 2, h0 + 160, g0 - 150);
    panel(cx + gap / 2, x1, h0 + 160, g0 - 150);
  } else if (style === "halflite") {
    lite(x0, x1, h0 + H * 0.5, h1 - st, 3, 3);
    panel(x0, cx - gap / 2, h0 + 160, h0 + H * 0.5 - 140);
    panel(cx + gap / 2, x1, h0 + 160, h0 + H * 0.5 - 140);
  } else if (style === "french") {
    lite(x0 - 20, x1 + 20, h0 + 230, h1 - st + 20, 2, 5);
  } else if (style === "panel") {
    // six panels: short ones at the top, tall ones under the lock rail
    const r1 = h1 - st, r2 = h1 - H * 0.26, r3 = h0 + H * 0.45;
    for (const [a, b] of [[x0, cx - gap / 2], [cx + gap / 2, x1]]) { panel(a, b, r2 + 50, r1); panel(a, b, r3 + 100, r2 - 50); panel(a, b, h0 + 160, r3 - 60); }
  } else {
    // shaker: two flat panels, a wide rail between
    const r = h0 + H * 0.42;
    panel(x0, x1, r + 90, h1 - st);
    panel(x0, x1, h0 + 170, r - 90);
  }
  // the lockset: a handleset on the front door, a knob and a deadbolt on the others (both sides)
  const hs = handleAtStart ? s0 + 70 : s1 - 70;
  for (const [fo, dir] of [[face, 1], [back, -1]] as const) {
    const out = (x: number) => (dir > 0 ? fo + x : fo - x);
    if (front && dir > 0) {
      k.box(metal, hs - 28, hs + 28, Math.min(fo, out(10)), Math.max(fo, out(10)), 820, 1120);
      k.box(metal, hs - 9, hs + 9, Math.min(out(10), out(55)), Math.max(out(10), out(55)), 880, 1060);
      k.disc(metal, hs, fo, 1180, 30, dir * 14);
    } else {
      k.disc(metal, hs, fo, 915, 32, dir * 10);
      k.ball(metal, hs, out(62), 915, 30);
      k.box(metal, hs - 7, hs + 7, Math.min(out(8), out(40)), Math.max(out(8), out(40)), 908, 922);
      k.disc(metal, hs, fo, 1065, 28, dir * 12);
    }
  }
}

/** the same paint or stain a shade darker, for the mouldings that frame each panel */
const mouldings = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();
function moulding(m: THREE.MeshStandardMaterial) {
  let d = mouldings.get(m);
  if (!d) { d = m.clone(); d.color.multiplyScalar(0.72); mouldings.set(m, d); }
  return d;
}

function sidelight(k: Kit, s0: number, s1: number, face: number, h0: number, h1: number, m: THREE.Material, glass: THREE.Material, frame: THREE.Material) {
  k.box(m, s0, s1, face - 45, face, h0, h1);
  const H = h1 - h0;
  k.box(glass, s0 + 70, s1 - 70, face - 46, face + 1, h0 + H * 0.3, h1 - 90);
  for (const y of [1, 2, 3].map((i) => h0 + H * 0.3 + ((H * 0.7 - 90) * i) / 4)) k.box(frame, s0 + 70, s1 - 70, face, face + 8, y - 8, y + 8);
  k.box(m, s0 + 40, s1 - 40, face, face + 6, h0 + 140, h0 + H * 0.3 - 70);
}

/** A patio slider: the fixed panel outside, the sliding one inside, overlapping in the middle. */
function slider(k: Kit, L: number, F: number, top: number, trim: THREE.Material, frame: THREE.Material, glass: THREE.Material) {
  const fw = 50;
  k.box(trim, 0, 18, -F, F - 80, 0, top); k.box(trim, L - 18, L, -F, F - 80, 0, top); k.box(trim, 0, L, -F, F - 80, top - 18, top);
  k.box(frame, 0, fw, F - 130, F - 20, 0, top); k.box(frame, L - fw, L, F - 130, F - 20, 0, top);
  k.box(frame, 0, L, F - 130, F - 20, top - fw, top); k.box(frame, 0, L, F - 130, F + 20, 0, 30);
  const pw = (L - 2 * fw) / 2 + 30;
  const pane = (s0: number, o0: number, handle: boolean) => {
    const s1 = s0 + pw, o1 = o0 + 40, h0 = 30, h1 = top - fw;
    k.box(frame, s0, s0 + 70, o0, o1, h0, h1); k.box(frame, s1 - 70, s1, o0, o1, h0, h1);
    k.box(frame, s0, s1, o0, o1, h0, h0 + 100); k.box(frame, s0, s1, o0, o1, h1 - 70, h1);
    k.box(glass, s0 + 70, s1 - 70, o0 + 17, o1 - 17, h0 + 100, h1 - 70);
    if (handle) for (const o of [o0 - 25, o1]) k.box(frame, s0 + 25, s0 + 45, o, o + 25, 850, 1150);
  };
  pane(fw, F - 75, false);
  pane(L - fw - pw, F - 125, true);
}

/** A sectional garage door: four sections of raised panels, windows across the top one. */
function garage(k: Kit, L: number, F: number, top: number, trimmed: boolean, m: THREE.MeshStandardMaterial, glass: THREE.Material, trim: THREE.Material) {
  const face = F - 40;
  k.box(trim, 0, 30, -F, F, 0, top); k.box(trim, L - 30, L, -F, F, 0, top); k.box(trim, 0, L, -F, F, top - 30, top);
  k.box(m, 30, L - 30, face - 40, face, 0, top - 30);
  const joint = std("#77736b", 0.8), mould = moulding(m);
  const rows = 4, rh = (top - 30) / rows, cols = Math.max(2, Math.round((L - 60) / 560));
  const cw = (L - 60) / cols;
  for (let r = 0; r < rows; r++) {
    const y0 = r * rh;
    // the joint between sections
    if (r > 0) k.box(joint, 30, L - 30, face - 2, face + 3, y0 - 5, y0 + 5);
    for (let c = 0; c < cols; c++) {
      const a = 30 + c * cw + 70, b = 30 + (c + 1) * cw - 70, lo = y0 + 90, hi = y0 + rh - 90;
      if (r === rows - 1 && trimmed) { k.box(glass, a, b, face - 1, face + 3, lo, hi); continue; }
      k.box(mould, a, b, face, face + 8, lo, hi);
      k.box(m, a + 30, b - 30, face + 8, face + 16, lo + 30, hi - 30);
    }
  }
  k.box(std("#3b3a38", 0.4, 0.6), L / 2 - 90, L / 2 + 90, face, face + 25, rh * 0.5 - 15, rh * 0.5 + 15);
}

// --------------------------------------------------------------------------- outside trim

function outsideTrim(k: Kit, L: number, F: number, bot: number, top: number, window: boolean, garage: boolean, m: THREE.Material) {
  const cw = garage ? 120 : 95, p = 22;
  // jamb casings, a head casing with a cap over it
  k.box(m, -cw, 0, F, F + p, window ? bot : 0, top);
  k.box(m, L, L + cw, F, F + p, window ? bot : 0, top);
  k.box(m, -cw - 12, L + cw + 12, F, F + p + 8, top, top + cw + 10);
  k.box(m, -cw - 28, L + cw + 28, F, F + p + 30, top + cw + 10, top + cw + 32);
  if (window) {
    // the sill sloping out past the casing, an apron under it
    k.slope(m, -cw - 32, L + cw + 32, F - 25, F + 60, bot - 38, bot, 12);
    k.box(m, -cw + 15, L + cw - 15, F, F + 18, bot - 38 - 95, bot - 38);
  }
}
