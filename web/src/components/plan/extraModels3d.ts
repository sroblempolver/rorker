// The rest of the catalogue drawn by hand in detail: kitchen and bath extras, living and dining pieces,
// utility and garage things, fitness, outdoor and hobbies. Each model is built at the size it's given
// (metres, width along x, front toward +z, standing on y = 0), so it stretches with the plan like the others.
// Kinds without a model here keep the simple look in lib/plan/catalog-extra.ts.
import * as THREE from "three";
import { ball, box, C, cyl, faucet, front, Materials, rod, screen, SHARED_GEOMETRY, taper, type M } from "./shapes3d";

type V = [number, number, number];
const up = new THREE.Vector3(0, 1, 0);
/** a round bar from a to b (a bike's frame, a lounger's arm) */
function strut(g: THREE.Group, m: M, r: number, a: V, b: V) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const mesh = cyl(g, m, r, A.distanceTo(B));
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(up, B.sub(A).normalize());
  return mesh;
}
const tori = new Map<string, THREE.TorusGeometry>();
/** a ring standing up, facing along x (a wheel's tyre) or lying flat (a tub's rim) */
function ring(g: THREE.Group, m: M, r: number, tube: number, x: number, y: number, z: number, facing: "x" | "z" | "y" = "x") {
  const k = `${(tube / r).toFixed(3)}`;
  let geo = tori.get(k);
  if (!geo) { geo = new THREE.TorusGeometry(1, tube / r, 10, 32); tori.set(k, geo); SHARED_GEOMETRY.add(geo); }
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.setScalar(r);
  mesh.position.set(x, y, z);
  if (facing === "x") mesh.rotation.y = Math.PI / 2; else if (facing === "y") mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
/** a spoked wheel, its axle across x */
function wheel(g: THREE.Group, mt: Materials, r: number, x: number, y: number, z: number, tyre = 0.02, spokes = 8) {
  ring(g, mt.get("#1c1c1c", { rough: 0.85 }), r - tyre, tyre, x, y, z);
  const rim = mt.get(C.steel, { metal: 0.9, rough: 0.25, env: 1 });
  ring(g, rim, r - tyre * 2.2, tyre * 0.35, x, y, z);
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * Math.PI; strut(g, rim, 0.002, [x, y + Math.sin(a) * (r - tyre * 2), z + Math.cos(a) * (r - tyre * 2)], [x, y - Math.sin(a) * (r - tyre * 2), z - Math.cos(a) * (r - tyre * 2)]); }
  cyl(g, rim, 0.02, 0.06, x, y, z).rotation.z = Math.PI / 2;
  g.children[g.children.length - 1].position.y = y;
}
const legs4 = (g: THREE.Group, m: M, w: number, d: number, h: number, t: number, inset: number, tapered = true) => {
  for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    if (tapered) taper(g, m, t * 0.32, t * 0.5, h, i * (w / 2 - inset), 0, j * (d / 2 - inset), 4);
    else box(g, m, t, h, t, i * (w / 2 - inset), 0, j * (d / 2 - inset), 0.004);
  }
};
const BOTTLES = ["#3f6b3a", "#6e1f22", "#c8b27a", "#2e3b2a", "#7a3b2e"];

/** Draws `kind` into g when it has a detailed model here; false when it doesn't. */
export function extraModel(g: THREE.Group, mt: Materials, kind: string, w: number, d: number, h: number): boolean {
  const wood = mt.auto(C.timber), dark = mt.auto(C.dark), steel = mt.auto(C.steel), black = mt.get(C.black, { rough: 0.35, env: 0.3 });
  const chrome = mt.get(C.steel, { metal: 0.92, rough: 0.12, env: 1.3 }), white = mt.get(C.porcelain, { rough: 0.18, env: 0.6 });
  const enamel = mt.get(C.white, { rough: 0.3, env: 0.4 }), glass = mt.get("#bcd9e2", { opacity: 0.25, rough: 0.04, env: 1.2 });
  const fabric = mt.auto(C.fabric), cushion = mt.auto(C.cushion);
  switch (kind) {
    // ------------------------------------------------------------------ kitchen
    case "wall_oven": {
      box(g, mt.get(C.plinth), w - 0.01, 0.1, d - 0.1, 0, 0, -0.04, 0);
      box(g, mt.auto(C.carcass), w - 0.004, h - 0.1, d - 0.02, 0, 0.1, -0.01, 0.002);
      const oven = (y: number, oh: number) => {
        box(g, steel, w - 0.04, oh, 0.03, 0, y, d / 2 - 0.01, 0.006);
        box(g, mt.get("#0d0d0e", { rough: 0.05, env: 1.2, metal: 0.3 }), w * 0.66, oh * 0.5, 0.004, 0, y + oh * 0.18, d / 2 + 0.006, 0);
        box(g, black, w - 0.06, 0.05, 0.004, 0, y + oh - 0.07, d / 2 + 0.006, 0);
        rod(g, chrome, 0.011, w * 0.75, 0, y + oh - 0.12, d / 2 + 0.045);
      };
      oven(0.75, 0.6); oven(1.36, 0.6);
      front(g, mt, "door", w, 0.105, 0.74, d - 0.02);
      front(g, mt, "doors", w, 1.97, h - 0.01, d - 0.02);
      return true;
    }
    case "wine_cooler": {
      box(g, black, w, h, d - 0.04, 0, 0, -0.02, 0.008);
      box(g, mt.get(C.steel, { metal: 0.85, rough: 0.25, env: 1 }), w, h - 0.08, 0.04, 0, 0.08, d / 2 - 0.02, 0.008);
      box(g, mt.get("#1d2228", { opacity: 0.55, rough: 0.03, env: 1.4 }), w - 0.08, h - 0.2, 0.01, 0, 0.13, d / 2 + 0.002, 0);
      const rows = Math.floor((h - 0.25) / 0.11);
      for (let r = 0; r < rows; r++) {
        const y = 0.17 + r * 0.11;
        box(g, mt.auto("#c9a46a"), w - 0.08, 0.012, d * 0.7, 0, y - 0.01, 0, 0.002);
        for (let i = 0; i < Math.floor((w - 0.1) / 0.085); i++) {
          const x = -w / 2 + 0.09 + i * 0.085;
          cyl(g, mt.get(BOTTLES[(r + i) % BOTTLES.length], { rough: 0.15, env: 0.8 }), 0.036, d * 0.55, x, y + 0.04, 0, Math.PI / 2);
        }
      }
      return true;
    }
    case "chest_freezer":
      box(g, enamel, w, h - 0.05, d, 0, 0, 0, 0.02);
      box(g, enamel, w + 0.01, 0.06, d + 0.01, 0, h - 0.06, 0, 0.02);
      box(g, mt.get("#cfcac0"), w - 0.04, 0.008, 0.004, 0, h - 0.065, d / 2 + 0.006, 0);
      box(g, mt.get("#9a968e", { rough: 0.4 }), 0.3, 0.035, 0.03, 0, h - 0.1, d / 2 + 0.01, 0.01);
      box(g, mt.get("#3a3c3f"), w - 0.1, 0.06, 0.004, 0, 0.03, d / 2 + 0.002, 0);
      return true;
    case "trash_can": {
      const r = Math.min(w, d) / 2;
      taper(g, steel, r * 0.98, r * 0.86, h - 0.05, 0, 0.02, 0, 32);
      cyl(g, black, r * 0.87, 0.02, 0, 0, 0);
      ball(g, chrome, r, 0, h - 0.04, 0).scale.set(r * 2, 0.09, r * 2);
      box(g, black, 0.12, 0.02, 0.06, 0, 0.01, r * 0.95, 0.008);
      return true;
    }
    case "recycling_bin": {
      const blue = mt.get("#2f5f9a", { rough: 0.45, env: 0.3 });
      box(g, blue, w * 0.92, h - 0.04, d * 0.92, 0, 0, 0, 0.025);
      box(g, mt.get("#244c7d", { rough: 0.45 }), w, 0.045, d, 0, h - 0.045, 0, 0.02);
      box(g, mt.get(C.white, { rough: 0.6 }), w * 0.35, w * 0.35, 0.002, 0, h * 0.5, d * 0.46 + 0.002, 0);
      return true;
    }
    // ------------------------------------------------------------------ bath
    case "bidet":
      taper(g, white, w * 0.32, w * 0.24, 0.24, 0, 0, d * 0.02).scale.z = d * 0.5;
      taper(g, white, w * 0.48, w * 0.34, 0.15, 0, 0.24, d * 0.04).scale.z = d * 0.7;
      taper(g, mt.get("#dfe3e2", { rough: 0.12, env: 0.6 }), w * 0.36, w * 0.3, 0.004, 0, 0.39, d * 0.06).scale.z = d * 0.5;
      faucet(g, mt, 0, 0.39, -d / 2 + 0.07, 0.1);
      return true;
    case "urinal":
      box(g, white, w, h, d * 0.55, 0, 0, -d * 0.2, 0.06);
      box(g, white, w * 0.9, h * 0.55, d * 0.6, 0, h * 0.05, d * 0.15, 0.08);
      box(g, mt.get("#dfe3e2", { rough: 0.12, env: 0.6 }), w * 0.7, h * 0.4, 0.004, 0, h * 0.12, d * 0.46, 0.04);
      cyl(g, chrome, 0.016, 0.3, 0, h, -d * 0.25);
      box(g, chrome, 0.07, 0.08, 0.06, 0, h + 0.28, -d * 0.25, 0.01);
      return true;
    case "medicine_cabinet":
      box(g, enamel, w, h, d - 0.02, 0, 0, -0.01, 0.006);
      box(g, chrome, w, h, 0.02, 0, 0, d / 2 - 0.01, 0.004);
      box(g, mt.get("#d6e4e8", { metal: 0.95, rough: 0.02, env: 1.6 }), w - 0.03, h - 0.03, 0.004, 0, 0.015, d / 2 + 0.001, 0);
      return true;
    case "laundry_hamper": {
      const wick = mt.get("#c9b38c", { map: "weave", rough: 0.95 });
      box(g, wick, w * 0.9, h - 0.04, d * 0.9, 0, 0, 0, 0.03);
      box(g, mt.get("#b29b72", { map: "weave", rough: 0.95 }), w, 0.05, d, 0, h - 0.05, 0, 0.025);
      for (const x of [-w * 0.3, w * 0.3]) box(g, mt.auto("#8a6a48"), 0.1, 0.015, 0.03, x, h * 0.75, d * 0.46, 0.006);
      return true;
    }
    // ------------------------------------------------------------------ living and dining
    case "sectional_sofa": {
      // a long sofa along the back and a chaise on the right, coming forward
      const back = 0.22, seatD = Math.min(0.95, d * 0.55), arm = 0.2, cw = Math.min(0.95, w * 0.35);
      for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, -d / 2 + seatD - 0.06], [w / 2 - 0.06, d / 2 - 0.06], [w / 2 - cw + 0.06, d / 2 - 0.06]]) taper(g, dark, 0.016, 0.022, 0.08, x, 0, z, 10);
      box(g, fabric, w, 0.2, seatD, 0, 0.08, -d / 2 + seatD / 2, 0.03);
      box(g, fabric, cw, 0.2, d - seatD, w / 2 - cw / 2, 0.08, d / 2 - (d - seatD) / 2, 0.03);
      box(g, fabric, w, 0.62, back, 0, 0.2, -d / 2 + back / 2, 0.05);
      box(g, fabric, arm, 0.38, seatD, -w / 2 + arm / 2, 0.2, -d / 2 + seatD / 2, 0.06);
      box(g, fabric, arm, 0.38, d - back, w / 2 - arm / 2, 0.2, back / 2, 0.06);
      const seats = Math.max(2, Math.round((w - cw - arm) / 0.65)), sw = (w - cw - arm) / seats;
      for (let i = 0; i < seats; i++) {
        const x = -w / 2 + arm + sw * (i + 0.5);
        box(g, cushion, sw - 0.01, 0.16, seatD - back - 0.02, x, 0.28, -d / 2 + back + (seatD - back) / 2, 0.05);
        box(g, cushion, sw - 0.02, 0.42, 0.14, x, 0.42, -d / 2 + back + 0.06, 0.06).rotation.x = -0.12;
      }
      box(g, cushion, cw - arm - 0.01, 0.16, d - back - 0.02, w / 2 - cw / 2 - arm / 2, 0.28, back / 2, 0.05);
      box(g, cushion, cw - arm - 0.02, 0.42, 0.14, w / 2 - cw / 2 - arm / 2, 0.42, -d / 2 + back + 0.06, 0.06).rotation.x = -0.12;
      return true;
    }
    case "recliner": {
      const leather = mt.get("#5a4032", { rough: 0.45, env: 0.25 });
      box(g, leather, w, 0.42, d * 0.8, 0, 0.04, -d * 0.1, 0.06);
      box(g, leather, w * 0.95, h - 0.4, 0.26, 0, 0.36, -d / 2 + 0.14, 0.09).rotation.x = -0.1;
      for (const x of [-1, 1]) box(g, leather, 0.2, 0.26, d * 0.8, x * (w / 2 - 0.1), 0.42, -d * 0.1, 0.09);
      box(g, mt.get("#6a4c3c", { rough: 0.45, env: 0.25 }), w - 0.42, 0.14, d * 0.62, 0, 0.42, 0.0, 0.06);
      box(g, leather, w - 0.42, 0.3, 0.1, 0, 0.1, d * 0.3 + 0.05, 0.05);
      box(g, mt.get("#6a4c3c", { rough: 0.45 }), w * 0.6, 0.2, 0.2, 0, h - 0.4, -d / 2 + 0.26, 0.08).rotation.x = -0.1;
      return true;
    }
    case "ottoman": {
      legs4(g, dark, w, d, 0.08, 0.04, 0.05);
      box(g, fabric, w, h - 0.08, d, 0, 0.08, 0, 0.05);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) ball(g, mt.get("#5c6070"), 0.012, x * w * 0.22, h, z * d * 0.22);
      return true;
    }
    case "bean_bag": {
      const m = mt.get("#b0623a", { map: "weave", rough: 0.9 });
      ball(g, m, 0.5, 0, h * 0.32, 0.03).scale.set(w, h * 0.64, d * 0.95);
      ball(g, m, 0.5, 0, h * 0.62, -d * 0.22).scale.set(w * 0.82, h * 0.7, d * 0.45);
      ball(g, mt.get("#9c5532", { map: "weave", rough: 0.9 }), 0.5, 0, h * 0.5, d * 0.05).scale.set(w * 0.6, h * 0.25, d * 0.5);
      return true;
    }
    case "side_table": case "console_table": {
      const top = 0.03;
      box(g, wood, w, top, d, 0, h - top, 0, 0.006);
      box(g, wood, w - 0.08, 0.09, d - 0.08, 0, h - top - 0.09, 0, 0.004);
      if (kind === "console_table") { const g2 = new THREE.Group(); front(g2, mt, "drawers", Math.min(0.5, w * 0.4), h - top - 0.1, h - top - 0.005, d - 0.08, C.timber); g.add(g2); }
      legs4(g, wood, w, d, h - top, 0.045, 0.03);
      box(g, wood, w - 0.08, 0.02, d - 0.08, 0, 0.15, 0, 0.004);
      box(g, mt.get("#c9a46a", { rough: 0.6 }), 0.2, 0.04, 0.15, -w * 0.15, 0.17, 0, 0.004);
      return true;
    }
    case "round_dining_table": {
      const r = Math.min(w, d) / 2;
      cyl(g, wood, r, 0.035, 0, h - 0.035, 0);
      cyl(g, wood, r * 0.85, 0.06, 0, h - 0.095, 0);
      taper(g, wood, 0.06, 0.09, h - 0.1, 0, 0.06, 0, 16);
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; box(g, wood, 0.08, 0.06, r * 0.75, Math.sin(a) * r * 0.3, 0, Math.cos(a) * r * 0.3, 0.02).rotation.y = a; }
      return true;
    }
    case "china_cabinet": {
      const lower = 0.85, inner = 0.04;
      box(g, mt.get(C.plinth), w - 0.02, 0.08, d - 0.06, 0, 0, -0.02, 0);
      box(g, dark, w, lower - 0.08, d - 0.02, 0, 0.08, -0.01, 0.006);
      box(g, wood, w + 0.02, 0.03, d + 0.01, 0, lower, 0, 0.006);
      front(g, mt, "doors", w, 0.1, lower - 0.02, d - 0.02, C.dark);
      const ud = d * 0.8, uz = -d / 2 + ud / 2;
      box(g, dark, w - 0.04, h - lower - 0.08, ud - 0.02, 0, lower + 0.03, uz - 0.01, 0.006);
      box(g, wood, w + 0.04, 0.06, ud + 0.04, 0, h - 0.06, uz, 0.008);
      for (let i = 0; i < 2; i++) {
        const x = -w / 4 + (i * w) / 2, dw = w / 2 - 0.03;
        box(g, glass, dw - 0.08, h - lower - 0.22, 0.006, x, lower + 0.08, uz + ud / 2, 0);
        for (const [bw, bh, bx, by] of [[dw, 0.04, 0, lower + 0.04], [dw, 0.04, 0, h - 0.13], [0.04, h - lower - 0.17, -dw / 2 + 0.02, lower + 0.04], [0.04, h - lower - 0.17, dw / 2 - 0.02, lower + 0.04]]) box(g, dark, bw, bh, 0.02, x + bx, by, uz + ud / 2, 0.004);
      }
      for (const y of [lower + 0.4, lower + 0.75]) {
        box(g, wood, w - 0.1, 0.015, ud - inner * 2, 0, y, uz, 0.002);
        for (let i = 0; i < Math.floor((w - 0.15) / 0.2); i++) cyl(g, mt.get(C.white, { rough: 0.2, env: 0.5 }), 0.09, 0.01, -w / 2 + 0.15 + i * 0.2, y + 0.11, uz - ud * 0.25, Math.PI / 2 - 0.25);
      }
      return true;
    }
    case "aquarium": {
      const sh = h * 0.55;
      box(g, black, w, sh, d, 0, 0, 0, 0.008);
      front(g, mt, "doors", w, 0.04, sh - 0.03, d, "#232426");
      const th = h - sh - 0.05;
      box(g, mt.get("#3d8fc4", { opacity: 0.35, rough: 0.02, env: 1 }), w - 0.03, th - 0.06, d - 0.03, 0, sh + 0.02, 0, 0);
      box(g, mt.get("#cfe6ee", { opacity: 0.18, rough: 0.02, env: 1.4 }), w, th, d, 0, sh, 0, 0.004);
      box(g, mt.get("#c9b38c", { rough: 1 }), w - 0.03, 0.05, d - 0.03, 0, sh + 0.005, 0, 0.004);
      for (let i = 0; i < 6; i++) { const x = -w / 2 + 0.1 + i * (w - 0.2) / 5; box(g, mt.get(i % 2 ? C.leaf : C.green, { rough: 0.6 }), 0.025, th * (0.35 + (i % 3) * 0.15), 0.025, x, sh + 0.05, -d * 0.25 + (i % 2) * 0.08, 0.008).rotation.z = (i % 3 - 1) * 0.12; }
      box(g, mt.get("#8d8a83", { rough: 0.9 }), 0.14, 0.08, 0.1, w * 0.25, sh + 0.05, 0, 0.03);
      for (const [x, y, c] of [[-0.15, 0.55, "#ff8a3d"], [0.12, 0.4, "#ffd23f"], [0.2, 0.7, "#ff5a5a"]] as const) ball(g, mt.get(c, { rough: 0.4 }), 0.018, x * w, sh + th * y, 0.02).scale.set(0.05, 0.026, 0.016);
      box(g, black, w + 0.01, 0.05, d + 0.01, 0, h - 0.05, 0, 0.008);
      return true;
    }
    case "grandfather_clock": {
      const bh = h * 0.18, hood = h * 0.25;
      box(g, dark, w, bh, d, 0, 0, 0, 0.008);
      box(g, wood, w * 0.82, h - bh - hood, d * 0.85, 0, bh, 0, 0.006);
      box(g, glass, w * 0.5, (h - bh - hood) * 0.8, 0.006, 0, bh + (h - bh - hood) * 0.1, d * 0.425 + 0.003, 0);
      const brass = mt.get("#b8955a", { metal: 0.9, rough: 0.25, env: 1.2 });
      rod(g, brass, 0.004, (h - bh - hood) * 0.6, 0, bh + (h - bh - hood) * 0.55, d * 0.3, "x").rotation.set(0, 0, 0);
      cyl(g, brass, 0.06, 0.012, 0, bh + (h - bh - hood) * 0.25, d * 0.3, Math.PI / 2);
      box(g, dark, w, hood, d, 0, h - hood, 0, 0.008);
      box(g, wood, w + 0.04, 0.05, d + 0.03, 0, h - 0.05, 0, 0.01);
      cyl(g, brass, w * 0.36, 0.01, 0, h - hood / 2, d / 2 + 0.003, Math.PI / 2);
      cyl(g, mt.get("#f2ead8", { rough: 0.6 }), w * 0.32, 0.012, 0, h - hood / 2, d / 2 + 0.006, Math.PI / 2);
      box(g, black, 0.006, w * 0.22, 0.004, 0, h - hood / 2, d / 2 + 0.014, 0).rotation.z = 0.5;
      box(g, black, 0.006, w * 0.16, 0.004, 0, h - hood / 2, d / 2 + 0.014, 0).rotation.z = -1.9;
      return true;
    }
    case "floor_speaker": {
      box(g, mt.get("#1a1a1b", { rough: 0.25, env: 0.4 }), w, h, d, 0, 0, 0, 0.012);
      const cone = mt.get("#2b2c2e", { rough: 0.7 });
      for (const [y, r] of [[h * 0.86, 0.035], [h * 0.65, w * 0.36], [h * 0.4, w * 0.36]]) { cyl(g, chrome, r + 0.008, 0.008, 0, y, d / 2 + 0.002, Math.PI / 2); cyl(g, cone, r, 0.01, 0, y, d / 2 + 0.004, Math.PI / 2); ball(g, black, r * 0.25, 0, y, d / 2 + 0.008).scale.z *= 0.4; }
      return true;
    }
    case "bar_cart": {
      const brass = mt.get("#c9a46a", { metal: 0.85, rough: 0.25, env: 1.2 });
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, brass, 0.01, h - 0.06, i * (w / 2 - 0.02), 0.06, j * (d / 2 - 0.02));
      for (const y of [0.25, h - 0.03]) { box(g, mt.get("#bcd9e2", { opacity: 0.35, rough: 0.03, env: 1.2 }), w - 0.03, 0.008, d - 0.03, 0, y, 0, 0); rod(g, brass, 0.008, w, 0, y + 0.004, d / 2 - 0.02); rod(g, brass, 0.008, w, 0, y + 0.004, -d / 2 + 0.02); }
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ring(g, black, 0.03, 0.012, i * (w / 2 - 0.02), 0.042, j * (d / 2 - 0.02));
      rod(g, brass, 0.01, d, w / 2 + 0.03, h - 0.12, 0, "z");
      BOTTLES.forEach((c, i) => { cyl(g, mt.get(c, { rough: 0.12, env: 0.9 }), 0.035, 0.22, -w * 0.3 + i * 0.09, h, -0.05); cyl(g, mt.get(c, { rough: 0.12 }), 0.012, 0.08, -w * 0.3 + i * 0.09, h + 0.22, -0.05); });
      for (let i = 0; i < 3; i++) taper(g, glass, 0.035, 0.03, 0.1, w * 0.15 + i * 0.08, h, 0.08);
      return true;
    }
    case "standing_desk": {
      box(g, wood, w, 0.03, d, 0, h - 0.03, 0, 0.008);
      const frame = mt.get("#55585c", { metal: 0.5, rough: 0.4, env: 0.4 });
      for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
        box(g, frame, 0.07, h * 0.5, 0.05, x, 0.03, 0, 0.006);
        box(g, frame, 0.06, h * 0.5, 0.04, x, h * 0.48, 0, 0.006);
        box(g, frame, 0.07, 0.035, d - 0.08, x, 0, 0, 0.01);
      }
      box(g, frame, w - 0.3, 0.05, 0.05, 0, h - 0.08, -d * 0.2, 0.006);
      box(g, mt.get(C.black), 0.08, 0.02, 0.05, w / 2 - 0.2, h - 0.05, d / 2 - 0.02, 0.006);
      return true;
    }
    case "safe": {
      const body = mt.get("#3a3c3f", { metal: 0.6, rough: 0.35, env: 0.6 });
      box(g, body, w, h, d, 0, 0, 0, 0.02);
      box(g, mt.get("#46494d", { metal: 0.6, rough: 0.35, env: 0.6 }), w - 0.06, h - 0.06, 0.02, 0, 0.03, d / 2, 0.01);
      cyl(g, chrome, 0.05, 0.02, w * 0.12, h * 0.6, d / 2 + 0.01, Math.PI / 2);
      for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; strut(g, chrome, 0.008, [w * 0.12, h * 0.4, d / 2 + 0.03], [w * 0.12 + Math.sin(a) * 0.08, h * 0.4 + Math.cos(a) * 0.08, d / 2 + 0.03]); }
      for (const y of [0.15, h - 0.15]) cyl(g, chrome, 0.015, 0.08, -w / 2 + 0.04, y - 0.04, d / 2 + 0.01);
      return true;
    }
    // ------------------------------------------------------------------ laundry, utility, services
    case "utility_sink": {
      const tub = mt.get("#efece5", { rough: 0.3, env: 0.4 });
      box(g, tub, w, 0.32, d, 0, h - 0.32, 0, 0.03);
      box(g, mt.get("#dad6cd", { rough: 0.3 }), w - 0.07, 0.003, d - 0.07, 0, h - 0.001, 0, 0.03);
      legs4(g, mt.get(C.steel, { metal: 0.6, rough: 0.4 }), w, d, h - 0.32, 0.035, 0.04, false);
      faucet(g, mt, 0, h, -d / 2 + 0.04, 0.3);
      return true;
    }
    case "furnace": {
      const panel = mt.get("#8e9298", { metal: 0.35, rough: 0.45, env: 0.4 });
      box(g, panel, w, h, d, 0, 0, 0, 0.006);
      for (const [y0, y1] of [[0.05, h * 0.45], [h * 0.48, h - 0.05]]) {
        box(g, mt.get("#979ba1", { metal: 0.35, rough: 0.45, env: 0.4 }), w - 0.04, y1 - y0, 0.01, 0, y0, d / 2, 0.004);
        for (let i = 0; i < 6; i++) box(g, mt.get("#5d6066"), w * 0.5, 0.008, 0.006, 0, y0 + 0.05 + i * 0.025, d / 2 + 0.007, 0);
      }
      box(g, mt.auto(C.steel), w * 0.85, 0.25, d * 0.8, 0, h, 0, 0.004);
      cyl(g, mt.get(C.steel, { metal: 0.7, rough: 0.35 }), 0.06, 0.4, w * 0.25, h, d * 0.3);
      return true;
    }
    case "ac_condenser": {
      const case_ = mt.get("#d9d5cc", { rough: 0.45, env: 0.3 });
      box(g, case_, w, h, d, 0, 0, 0, 0.01);
      const r = Math.min(h, w) * 0.38;
      cyl(g, mt.get("#2b2c2e", { rough: 0.8 }), r, 0.01, -w * 0.15, h * 0.5, d / 2 + 0.002, Math.PI / 2);
      for (let i = 0; i < 4; i++) ring(g, mt.get("#3a3c3f", { metal: 0.6, rough: 0.4 }), r * (0.3 + i * 0.22), 0.003, -w * 0.15, h * 0.5, d / 2 + 0.008, "z");
      for (let i = 0; i < 3; i++) box(g, mt.get("#55585c"), r * 0.9, 0.04, 0.004, -w * 0.15, h * 0.5 - 0.02, d / 2 + 0.006, 0).rotation.z = (i * Math.PI) / 3;
      for (let i = 0; i < 8; i++) box(g, mt.get("#b5b1a8"), w * 0.22, 0.012, 0.004, w * 0.32, h * 0.2 + i * h * 0.08, d / 2 + 0.002, 0);
      return true;
    }
    case "radiator": {
      const n = Math.max(3, Math.round(w / 0.1)), cw = w / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + cw * (i + 0.5);
        box(g, enamel, cw * 0.7, h - 0.06, d * 0.8, x, 0.03, 0, cw * 0.3);
      }
      rod(g, enamel, 0.025, w, 0, h - 0.05, 0); rod(g, enamel, 0.025, w, 0, 0.05, 0);
      cyl(g, chrome, 0.02, 0.06, -w / 2 - 0.03, 0.06, 0);
      return true;
    }
    case "water_softener": {
      box(g, mt.get("#e6e1d6", { rough: 0.4 }), w, h * 0.7, d * 0.55, 0, 0, d * 0.22, 0.02);
      cyl(g, mt.get("#2f5f9a", { rough: 0.3, env: 0.4 }), Math.min(w, d) * 0.4, h - 0.12, 0, 0, -d * 0.24);
      ball(g, mt.get("#2f5f9a", { rough: 0.3, env: 0.4 }), Math.min(w, d) * 0.4, 0, h - 0.12, -d * 0.24).scale.y = 0.1;
      box(g, black, w * 0.6, 0.12, w * 0.6, 0, h - 0.12, -d * 0.24, 0.02);
      box(g, mt.get("#1f2a33", { emissive: "#1d3550" }), 0.06, 0.03, 0.004, 0, h - 0.07, -d * 0.24 + w * 0.3 + 0.002, 0);
      return true;
    }
    // ------------------------------------------------------------------ garage and workshop
    case "workbench": {
      const bh = Math.min(0.9, h);
      box(g, mt.auto("#b48a5e"), w, 0.05, d, 0, bh - 0.05, 0, 0.006);
      legs4(g, dark, w, d, bh - 0.05, 0.08, 0.06, false);
      box(g, wood, w - 0.1, 0.025, d - 0.1, 0, 0.2, 0, 0.004);
      const peg = mt.get("#c9a46a", { rough: 0.9 });
      box(g, peg, w, 0.8, 0.015, 0, bh + 0.05, -d / 2 + 0.01, 0);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) box(g, mt.get("#8a7450"), 0.006, 0.006, 0.002, -w / 2 + 0.1 + i * (w - 0.2) / 9, bh + 0.15 + j * 0.18, -d / 2 + 0.018, 0);
      const tool = mt.get("#b8473a", { rough: 0.5 });
      box(g, tool, 0.03, 0.22, 0.02, -w * 0.3, bh + 0.4, -d / 2 + 0.03, 0.008); box(g, steel, 0.1, 0.04, 0.02, -w * 0.3, bh + 0.6, -d / 2 + 0.03, 0.006);
      box(g, mt.get("#ffd23f"), 0.03, 0.18, 0.02, -w * 0.15, bh + 0.45, -d / 2 + 0.03, 0.008); box(g, steel, 0.008, 0.12, 0.008, -w * 0.15, bh + 0.63, -d / 2 + 0.03, 0.003);
      ring(g, mt.get("#3a6ea5"), 0.08, 0.012, w * 0.1, bh + 0.5, -d / 2 + 0.03, "z");
      box(g, mt.get("#3a6ea5", { rough: 0.4 }), 0.35, 0.15, 0.2, w * 0.3, bh, 0, 0.02);
      return true;
    }
    case "tool_chest": {
      const red = mt.get("#b8352b", { rough: 0.25, env: 0.6 });
      box(g, red, w, h - 0.08, d, 0, 0.08, 0, 0.01);
      const n = 7, dh = (h - 0.12) / n;
      for (let i = 0; i < n; i++) {
        const y = 0.1 + i * dh, hh = i === 0 ? dh * 1.8 : dh;
        if (i === 1) continue;
        box(g, red, w - 0.04, hh - 0.01, 0.012, 0, y, d / 2 + 0.006, 0.004);
        rod(g, chrome, 0.007, w - 0.14, 0, y + hh - 0.035, d / 2 + 0.025);
      }
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cyl(g, black, 0.035, 0.03, i * (w / 2 - 0.06), 0.035, j * (d / 2 - 0.06)).rotation.z = Math.PI / 2; g.children[g.children.length - 1].position.y = 0.035; box(g, chrome, 0.05, 0.03, 0.05, i * (w / 2 - 0.06), 0.05, j * (d / 2 - 0.06), 0.004); }
      return true;
    }
    case "bicycle": {
      // along z: wheels front and back, the diamond frame, saddle and bars
      const r = Math.min(0.34, h * 0.33), zf = d / 2 - r - 0.02, zb = -d / 2 + r + 0.02;
      wheel(g, mt, r, 0, r, zf, 0.022, 12); wheel(g, mt, r, 0, r, zb, 0.022, 12);
      const paint = mt.get("#2f5f9a", { metal: 0.4, rough: 0.3, env: 0.8 });
      const bb: V = [0, r * 0.9, (zf + zb) / 2 - 0.05], seat: V = [0, r + 0.5, zb + 0.32], head: V = [0, r + 0.52, zf - 0.17], headLo: V = [0, r + 0.36, zf - 0.13];
      strut(g, paint, 0.018, bb, seat); strut(g, paint, 0.02, bb, headLo); strut(g, paint, 0.017, seat, head); strut(g, paint, 0.02, head, headLo);
      strut(g, paint, 0.012, bb, [0, r, zb]); strut(g, paint, 0.012, seat, [0, r, zb]);
      strut(g, chrome, 0.012, headLo, [0, r, zf]);
      strut(g, chrome, 0.012, seat, [0, seat[1] + 0.1, seat[2] - 0.03]);
      box(g, black, 0.14, 0.04, 0.26, 0, seat[1] + 0.1, seat[2] - 0.04, 0.02);
      strut(g, chrome, 0.012, head, [0, head[1] + 0.12, head[2] - 0.05]);
      rod(g, black, 0.013, Math.min(w, 0.58), 0, head[1] + 0.12, head[2] - 0.05);
      ring(g, chrome, 0.09, 0.01, 0, bb[1], bb[2]);
      return true;
    }
    case "motorcycle": {
      // along z: the wheels, the engine and tank between them, the seat, the forks and bars
      const r = Math.min(0.33, h * 0.29), zf = d / 2 - r - 0.03, zb = -d / 2 + r + 0.05;
      for (const z of [zf, zb]) { cyl(g, mt.get("#1c1c1c", { rough: 0.85 }), r, 0.13, 0, r, z).rotation.z = Math.PI / 2; g.children[g.children.length - 1].position.y = r; cyl(g, chrome, r * 0.6, 0.135, 0, r, z).rotation.z = Math.PI / 2; g.children[g.children.length - 1].position.y = r; }
      const paint = mt.get("#b8352b", { metal: 0.4, rough: 0.2, env: 1 });
      box(g, mt.get("#3a3c3f", { metal: 0.6, rough: 0.4, env: 0.6 }), 0.3, 0.32, 0.5, 0, r * 0.7, 0.02, 0.05);
      box(g, paint, 0.3, 0.22, 0.5, 0, h * 0.62, zf - 0.55, 0.08);
      box(g, black, 0.28, 0.1, 0.62, 0, h * 0.6, zb + 0.4, 0.04);
      box(g, paint, 0.22, 0.08, 0.4, 0, h * 0.58, zb + 0.05, 0.03);
      strut(g, chrome, 0.03, [0, r, zf], [0, h * 0.85, zf - 0.3]);
      rod(g, black, 0.016, Math.min(w, 0.75), 0, h * 0.9, zf - 0.32);
      ball(g, mt.get("#fff6d8", { emissive: "#fff1c4" }), 0.08, 0, h * 0.75, zf - 0.2).scale.z = 0.1;
      strut(g, chrome, 0.04, [0.12, r * 0.6, 0.1], [0.14, r * 0.8, zb]);
      strut(g, black, 0.025, [0, r, zb], [0, r * 0.8, 0]);
      return true;
    }
    case "lawn_mower": {
      const deck = mt.get("#3a7a3f", { rough: 0.35, env: 0.4 });
      const dz = d * 0.2;
      box(g, deck, w * 0.85, 0.16, d * 0.45, 0, 0.08, dz, 0.04);
      box(g, black, w * 0.4, 0.2, d * 0.22, 0, 0.24, dz, 0.03);
      cyl(g, mt.get("#d33b2c"), 0.06, 0.05, w * 0.1, 0.44, dz);
      for (const [x, z, r] of [[-1, dz + d * 0.17, 0.09], [1, dz + d * 0.17, 0.09], [-1, dz - d * 0.18, 0.11], [1, dz - d * 0.18, 0.11]] as const) { cyl(g, mt.get("#1c1c1c", { rough: 0.85 }), r, 0.05, x * w * 0.44, r, z).rotation.z = Math.PI / 2; g.children[g.children.length - 1].position.y = r; }
      for (const x of [-1, 1]) strut(g, black, 0.012, [x * w * 0.3, 0.24, dz - d * 0.18], [x * w * 0.3, h, -d / 2 + 0.05]);
      rod(g, black, 0.014, w * 0.6, 0, h, -d / 2 + 0.05);
      box(g, mt.get("#4a4a48", { map: "weave", rough: 1 }), w * 0.5, 0.3, 0.3, 0, 0.18, -d * 0.12, 0.05);
      return true;
    }
    // ------------------------------------------------------------------ fitness
    case "exercise_bike": {
      const frame = mt.get("#232426", { rough: 0.3, env: 0.5 });
      box(g, frame, 0.08, 0.05, d * 0.9, 0, 0, 0, 0.02);
      for (const z of [-d * 0.4, d * 0.4]) box(g, frame, w, 0.05, 0.08, 0, 0, z, 0.02);
      const fw: V = [0, 0.32, d * 0.25];
      cyl(g, chrome, 0.22, 0.05, fw[0], fw[1], fw[2]).rotation.z = Math.PI / 2; g.children[g.children.length - 1].position.y = fw[1];
      cyl(g, mt.get("#3a3c3f"), 0.18, 0.06, fw[0], fw[1], fw[2]).rotation.z = Math.PI / 2; g.children[g.children.length - 1].position.y = fw[1];
      strut(g, frame, 0.035, [0, 0.05, -d * 0.3], [0, 0.85, -d * 0.18]);
      strut(g, frame, 0.035, [0, 0.05, d * 0.35], [0, h - 0.15, d * 0.3]);
      strut(g, frame, 0.03, [0, 0.4, -d * 0.25], fw);
      box(g, black, 0.16, 0.06, 0.26, 0, 0.88, -d * 0.2, 0.025);
      rod(g, frame, 0.016, 0.5, 0, h - 0.12, d * 0.3);
      box(g, black, 0.2, 0.14, 0.03, 0, h - 0.06, d * 0.36, 0.01).rotation.x = -0.4;
      screen(g, mt, 0.18, 0.12, 0, h - 0.06, d * 0.375).rotation.x = -0.4;
      for (const x of [-1, 1]) box(g, frame, 0.1, 0.02, 0.04, x * 0.12, 0.3, 0.02, 0.006);
      return true;
    }
    // ------------------------------------------------------------------ outdoor
    case "patio_table": {
      const alu = mt.get("#55585c", { metal: 0.5, rough: 0.4, env: 0.4 });
      const n = Math.round(w / 0.1);
      for (let i = 0; i < n; i++) box(g, mt.auto("#a07850"), w / n - 0.012, 0.025, d - 0.04, -w / 2 + (w / n) * (i + 0.5), h - 0.025, 0, 0.004);
      box(g, alu, w, 0.06, d, 0, h - 0.085, 0, 0.006);
      legs4(g, alu, w, d, h - 0.06, 0.05, 0.06, false);
      return true;
    }
    case "patio_chair": {
      const alu = mt.get("#55585c", { metal: 0.5, rough: 0.4, env: 0.4 });
      legs4(g, alu, w, d, 0.42, 0.035, 0.03, false);
      box(g, alu, w, 0.035, d, 0, 0.4, 0, 0.008);
      box(g, mt.get("#e9e3d6", { map: "weave", rough: 0.95 }), w - 0.06, 0.07, d - 0.08, 0, 0.435, 0.02, 0.03);
      for (const x of [-1, 1]) { box(g, alu, 0.035, 0.45, 0.035, x * (w / 2 - 0.02), 0.42, -d / 2 + 0.02, 0.006); box(g, alu, 0.04, 0.03, d - 0.04, x * (w / 2 - 0.02), 0.64, 0, 0.008); box(g, alu, 0.03, 0.22, 0.03, x * (w / 2 - 0.02), 0.42, d / 2 - 0.05, 0.006); }
      for (let i = 0; i < 4; i++) box(g, alu, w - 0.06, 0.05, 0.015, 0, 0.5 + i * 0.09, -d / 2 + 0.02, 0.004);
      return true;
    }
    case "sun_lounger": {
      const alu = mt.get("#e6e1d6", { rough: 0.4, env: 0.3 });
      const bed = d * 0.68, back = d - bed - 0.05;
      legs4(g, mt.get("#55585c", { metal: 0.5, rough: 0.4 }), w, d, 0.28, 0.04, 0.06, false);
      box(g, alu, w, 0.04, bed, 0, 0.28, d / 2 - bed / 2, 0.01);
      box(g, mt.get("#3a6ea5", { map: "weave", rough: 0.95 }), w - 0.06, 0.06, bed - 0.04, 0, 0.32, d / 2 - bed / 2, 0.03);
      const bk = new THREE.Group();
      box(bk, alu, w, back, 0.04, 0, 0, 0, 0.01);
      box(bk, mt.get("#3a6ea5", { map: "weave", rough: 0.95 }), w - 0.06, back - 0.04, 0.06, 0, 0.02, 0.04, 0.03);
      bk.position.set(0, 0.3, d / 2 - bed); bk.rotation.x = -0.75;
      g.add(bk);
      return true;
    }
    case "bbq_grill": {
      const body = mt.get("#232426", { rough: 0.35, env: 0.6 });
      const cw = Math.min(w * 0.7, 0.9);
      box(g, body, cw, 0.75, d * 0.9, 0, 0.1, 0, 0.01);
      front(g, mt, "doors", cw, 0.12, 0.83, d * 0.9, "#3a3c3f");
      for (const x of [-1, 1]) { cyl(g, black, 0.06, 0.04, x * (cw / 2 - 0.06), 0.06, d * 0.4).rotation.z = Math.PI / 2; g.children[g.children.length - 1].position.y = 0.06; box(g, body, 0.05, 0.1, 0.05, x * (cw / 2 - 0.06), 0, -d * 0.4, 0.01); }
      box(g, mt.auto(C.steel), cw + 0.02, 0.08, d * 0.92, 0, 0.85, 0, 0.01);
      const lid = mt.get(C.steel, { metal: 0.85, rough: 0.25, env: 1.1 });
      taper(g, lid, 0.25, 0.5, 0.25, 0, 0.93, 0, 4).scale.set(cw * 0.707, 0.25, d * 0.85 * 0.707);
      rod(g, chrome, 0.012, cw * 0.7, 0, 1.0, d * 0.5);
      for (const x of [-1, 1]) box(g, lid, (w - cw) / 2 - 0.02, 0.03, d * 0.8, x * (cw / 2 + (w - cw) / 4), 0.88, 0, 0.006);
      for (let i = 0; i < 5; i++) cyl(g, black, 0.016, 0.02, -cw * 0.3 + i * cw * 0.15, 0.89, d * 0.46, Math.PI / 2);
      return true;
    }
    case "patio_umbrella": {
      const r = Math.min(w, d) / 2;
      cyl(g, mt.get("#3a3c3f", { metal: 0.4, rough: 0.5 }), 0.25, 0.06, 0, 0, 0);
      cyl(g, mt.get("#e6e1d6", { metal: 0.3, rough: 0.4 }), 0.02, h - 0.06, 0, 0.06, 0);
      const canvas = mt.get("#e9dcc0", { map: "weave", rough: 0.95 });
      taper(g, canvas, 0.08, r, 0.42, 0, h - 0.5, 0, 8);
      taper(g, canvas, 0.02, 0.2, 0.12, 0, h - 0.1, 0, 8);
      for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * Math.PI * 2; strut(g, mt.get("#e6e1d6"), 0.006, [0, h - 0.62, 0], [Math.sin(a) * r * 0.6, h - 0.32, Math.cos(a) * r * 0.6]); }
      return true;
    }
    case "hot_tub": {
      const ced = mt.auto("#7a5a3e");
      box(g, ced, w, h - 0.06, d, 0, 0, 0, 0.04);
      for (let i = 0; i < Math.round((w * 2 + d * 2) / 0.12); i++) {
        const t = (i * 0.12) / (w * 2 + d * 2), side = Math.floor(t * 4), u = (t * 4) % 1;
        if (side % 2) continue;
        const x = side === 0 ? -w / 2 + u * w : 0, z = side === 0 ? d / 2 + 0.002 : 0;
        if (side === 0) box(g, mt.get("#5f4530"), 0.006, h - 0.1, 0.004, x, 0.02, z, 0);
      }
      const shell = mt.get("#d9d6cf", { rough: 0.2, env: 0.5 }), e = 0.14;
      for (const [x, z, sx, sz] of [[0, d / 2 - e / 2, w, e], [0, -d / 2 + e / 2, w, e], [w / 2 - e / 2, 0, e, d], [-w / 2 + e / 2, 0, e, d]]) box(g, shell, sx, 0.06, sz, x, h - 0.06, z, 0.03);
      box(g, mt.get("#4fa3c7", { rough: 0.03, env: 1.3, metal: 0.2 }), w - 0.24, 0.01, d - 0.24, 0, h - 0.055, 0, 0);
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) cyl(g, chrome, 0.025, 0.012, x * w, h - 0.05, z * d);
      return true;
    }
    case "planter": {
      const pot = mt.get("#55585c", { rough: 0.85 });
      taper(g, pot, Math.min(w, d) * 0.5, Math.min(w, d) * 0.4, h * 0.48, 0, 0, 0, 4).scale.set(w * 0.707, h * 0.48, d * 0.707);
      const lm = mt.get(C.leaf, { rough: 0.75 }), lm2 = mt.get(C.green, { rough: 0.8 });
      for (let i = 0; i < 10; i++) { const a = i * 2.4, rr = Math.min(w, d) * (0.08 + (i % 3) * 0.08); ball(g, i % 2 ? lm : lm2, Math.min(w, d) * (0.2 + (i % 3) * 0.04), Math.sin(a) * rr, h * (0.55 + (i % 4) * 0.1), Math.cos(a) * rr); }
      for (let i = 0; i < 5; i++) { const a = i * 1.3; ball(g, mt.get(["#e85d75", "#ffd23f", "#f2efe8"][i % 3], { rough: 0.6 }), 0.03, Math.sin(a) * w * 0.3, h * 0.8 + (i % 2) * 0.08, Math.cos(a) * d * 0.3); }
      return true;
    }
    case "fire_pit": {
      const st = mt.auto(C.stone);
      const r = Math.min(w, d) / 2, n = 14;
      cyl(g, st, r * 0.92, h * 0.15, 0, 0, 0);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; for (let j = 0; j < 3; j++) box(g, mt.get(["#8d8a83", "#7f7a72", "#9a958b"][(i + j) % 3], { rough: 0.95 }), r * 0.42, h * 0.3 - 0.01, r * 0.2, Math.sin(a + j * 0.2) * r * 0.86, j * h * 0.31, Math.cos(a + j * 0.2) * r * 0.86, 0.02).rotation.y = a + j * 0.2; }
      cyl(g, mt.get("#1a1a1a", { rough: 1 }), r * 0.7, 0.02, 0, h * 0.5, 0);
      for (let i = 0; i < 4; i++) strut(g, mt.get("#5b4630"), 0.035, [Math.sin(i * 1.6) * r * 0.45, h * 0.55, Math.cos(i * 1.6) * r * 0.45], [-Math.sin(i * 1.6) * r * 0.1, h * 0.75, -Math.cos(i * 1.6) * r * 0.1]);
      taper(g, mt.get("#ff9a3d", { emissive: "#ff7a1f", opacity: 0.9 }), 0.0, r * 0.35, h * 0.9, 0, h * 0.55, 0, 7);
      taper(g, mt.get("#ffd27a", { emissive: "#ffc04d", opacity: 0.9 }), 0.0, r * 0.2, h * 0.6, 0, h * 0.58, 0, 6);
      return true;
    }
    case "garden_bench": {
      const cast = mt.get("#232426", { metal: 0.5, rough: 0.5 });
      for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) {
        box(g, cast, 0.05, 0.42, 0.05, x, 0, d / 2 - 0.06, 0.01); box(g, cast, 0.05, h, 0.05, x, 0, -d / 2 + 0.08, 0.01);
        box(g, cast, 0.05, 0.04, d - 0.1, x, 0.38, 0, 0.01); box(g, cast, 0.05, 0.04, d * 0.6, x, 0.62, d * 0.12, 0.01);
        strut(g, cast, 0.02, [x, 0.42, d / 2 - 0.06], [x, 0.62, d / 2 - 0.08]);
      }
      for (let i = 0; i < 5; i++) box(g, wood, w - 0.02, 0.03, 0.07, 0, 0.42, d / 2 - 0.06 - i * 0.085, 0.006);
      const bk = new THREE.Group();
      for (let i = 0; i < 4; i++) box(bk, wood, w - 0.1, 0.07, 0.025, 0, i * 0.09, 0, 0.006);
      bk.position.set(0, 0.5, -d / 2 + 0.08); bk.rotation.x = -0.15; g.add(bk);
      return true;
    }
    // ------------------------------------------------------------------ kids, pets, hobbies
    case "rocking_chair": {
      for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) {
        const rk = new THREE.Group();
        for (let i = 0; i < 5; i++) { const t = (i - 2) / 2; box(rk, wood, 0.035, 0.035, d / 5 + 0.01, 0, 0.03 * t * t, (t * d) / 2.5, 0.008).rotation.x = -t * 0.12; }
        rk.position.x = x; g.add(rk);
        for (const z of [-d * 0.22, d * 0.22]) box(g, wood, 0.035, 0.38, 0.035, x, 0.04, z, 0.006);
        box(g, wood, 0.035, h - 0.42, 0.035, x, 0.42, -d * 0.25, 0.006);
        box(g, wood, 0.05, 0.03, d * 0.5, x, 0.65, 0, 0.01);
      }
      box(g, wood, w - 0.04, 0.035, d * 0.5, 0, 0.42, 0, 0.008);
      box(g, mt.auto(C.cushion), w - 0.12, 0.05, d * 0.44, 0, 0.455, 0.01, 0.02);
      for (let i = 0; i < 6; i++) cyl(g, wood, 0.01, h - 0.55, -w / 2 + 0.12 + i * (w - 0.24) / 5, 0.46, -d * 0.25);
      box(g, wood, w - 0.04, 0.08, 0.03, 0, h - 0.08, -d * 0.25, 0.01);
      return true;
    }
    case "dog_bed": {
      const m = mt.get("#7a5a4a", { map: "weave", rough: 0.95 });
      box(g, m, w, 0.1, d, 0, 0, 0, 0.04);
      box(g, mt.get("#c9b38c", { map: "weave", rough: 0.95 }), w - 0.2, 0.06, d - 0.2, 0, 0.1, 0.03, 0.03);
      box(g, m, w, h - 0.08, 0.14, 0, 0.08, -d / 2 + 0.07, 0.06);
      for (const x of [-1, 1]) box(g, m, 0.14, h - 0.1, d - 0.1, x * (w / 2 - 0.07), 0.08, 0.05, 0.06);
      return true;
    }
    case "pool_table": {
      const H = Math.min(h, 0.8);
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) taper(g, dark, 0.06, 0.09, H - 0.15, i * (w / 2 - 0.15), 0, j * (d / 2 - 0.15), 8);
      box(g, dark, w, 0.15, d, 0, H - 0.17, 0, 0.02);
      box(g, mt.get("#2f6b45", { map: "weave", rough: 1 }), w - 0.2, 0.02, d - 0.2, 0, H - 0.02, 0, 0);
      for (const [x, z, sx, sz] of [[0, d / 2 - 0.05, w - 0.1, 0.1], [0, -d / 2 + 0.05, w - 0.1, 0.1], [w / 2 - 0.05, 0, 0.1, d - 0.1], [-w / 2 + 0.05, 0, 0.1, d - 0.1]]) box(g, dark, sx, 0.05, sz, x, H - 0.02, z, 0.015);
      for (const [x, z] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) cyl(g, mt.get("#111111"), 0.05, 0.005, x * (w / 2 - 0.1), H + 0.0, z * (d / 2 - 0.1));
      const cols = ["#f2efe8", "#ffd23f", "#2f5f9a", "#c0392b", "#6b3fa0", "#e67e22", "#1e8449", "#7b241c", "#111111"];
      cols.forEach((c, i) => ball(g, mt.get(c, { rough: 0.15, env: 0.6 }), 0.028, i === 0 ? -w * 0.25 : w * 0.18 + Math.floor(Math.sqrt(i * 2)) * 0.05, H + 0.028, i === 0 ? 0 : ((i % 4) - 1.5) * 0.058));
      return true;
    }
    case "ping_pong_table": {
      const top = mt.get("#2b5c8a", { rough: 0.5 });
      box(g, top, w, 0.025, d, 0, h - 0.025, 0, 0.004);
      const line = mt.get(C.white, { rough: 0.6 });
      for (const z of [-d / 2 + 0.01, d / 2 - 0.01]) box(g, line, w, 0.002, 0.02, 0, h, z, 0);
      for (const x of [-w / 2 + 0.01, w / 2 - 0.01]) box(g, line, 0.02, 0.002, d, x, h, 0, 0);
      box(g, line, w, 0.002, 0.004, 0, h, 0, 0);
      box(g, mt.get("#1c1c1c", { opacity: 0.75, rough: 0.9 }), 0.006, 0.152, d + 0.15, 0, h, 0, 0);
      box(g, line, 0.008, 0.012, d + 0.15, 0, h + 0.148, 0, 0.002);
      const frame = mt.get("#3a3c3f", { metal: 0.5, rough: 0.4 });
      for (const x of [-w * 0.32, w * 0.32]) { for (const z of [-d * 0.38, d * 0.38]) box(g, frame, 0.04, h - 0.03, 0.04, x, 0, z, 0.006); rod(g, frame, 0.015, d * 0.76, x, 0.15, 0, "z"); }
      return true;
    }
    case "guitar": {
      box(g, black, w * 0.8, 0.03, d * 0.7, 0, 0, 0, 0.01);
      strut(g, black, 0.012, [0, 0.03, -d * 0.2], [0, 0.6, -d * 0.1]);
      const gt = new THREE.Group();
      const top = mt.get("#d9a85e", { map: "wood", rough: 0.3, env: 0.4 });
      cyl(gt, top, 0.18, 0.1, 0, 0.2, 0, Math.PI / 2);
      cyl(gt, top, 0.135, 0.1, 0, 0.44, 0, Math.PI / 2);
      cyl(gt, mt.get("#1a1a1a"), 0.045, 0.102, 0, 0.42, 0, Math.PI / 2);
      box(gt, mt.get("#3d2a1d", { rough: 0.4 }), 0.05, 0.48, 0.03, 0, 0.5, 0.03, 0.006);
      box(gt, mt.get("#3d2a1d", { rough: 0.4 }), 0.08, 0.17, 0.03, 0, 0.98, 0.02, 0.01);
      box(gt, mt.get("#2b1c12"), 0.1, 0.02, 0.012, 0, 0.13, 0.053, 0.004);
      gt.position.set(0, 0.06, d * 0.15); gt.rotation.x = -0.18;
      g.add(gt);
      return true;
    }
    case "drum_kit": {
      const shell = mt.get("#b8352b", { rough: 0.15, env: 0.7 }), head = mt.get("#efe9dc", { rough: 0.7 });
      const drum = (r: number, depth: number, x: number, y: number, z: number, kick = false) => {
        if (kick) { cyl(g, shell, r, depth, x, y, z, Math.PI / 2); cyl(g, head, r * 0.98, depth + 0.004, x, y, z, Math.PI / 2); ring(g, chrome, r, 0.008, x, y, z + depth / 2, "z"); return; }
        cyl(g, shell, r, depth, x, y, z); cyl(g, head, r * 0.98, 0.004, x, y + depth, z); ring(g, chrome, r, 0.006, x, y + depth, z, "y");
      };
      drum(0.28, 0.4, 0, 0.28, d * 0.15, true);
      drum(0.18, 0.15, -w * 0.25, 0.55, d * 0.05);
      drum(0.13, 0.12, -0.12, 0.62, d * 0.2); drum(0.13, 0.12, 0.12, 0.62, d * 0.2);
      drum(0.22, 0.4, w * 0.3, 0.05, -d * 0.05);
      for (const [x, z, y, r] of [[-w * 0.4, d * 0.15, 0.9, 0.18], [-w * 0.15, d * 0.35, 1.25, 0.22], [w * 0.35, d * 0.3, 1.2, 0.25]] as const) {
        strut(g, chrome, 0.01, [x, 0, z], [x, y, z]);
        cyl(g, mt.get("#c9a14e", { metal: 0.9, rough: 0.25, env: 1.2 }), r, 0.006, x, y, z);
      }
      for (const z of [-d * 0.3]) box(g, black, 0.35, 0.08, 0.35, -w * 0.05, 0.42, z, 0.04);
      cyl(g, chrome, 0.012, 0.42, -w * 0.05, 0, -d * 0.3);
      return true;
    }
    case "floor_fan": {
      const r = Math.min(w, h * 0.4) / 2;
      cyl(g, enamel, Math.min(w, d) * 0.45, 0.04, 0, 0, 0);
      cyl(g, enamel, 0.018, h - r - 0.1, 0, 0.04, 0);
      const cy = h - r;
      box(g, enamel, 0.12, 0.12, 0.14, 0, cy - 0.06, -0.08, 0.04);
      ring(g, enamel, r, 0.005, 0, cy, 0.02, "z");
      for (let i = 1; i < 4; i++) ring(g, enamel, (r * i) / 4, 0.003, 0, cy, 0.03, "z");
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI; strut(g, enamel, 0.002, [Math.sin(a) * r, cy + Math.cos(a) * r, 0.03], [-Math.sin(a) * r, cy - Math.cos(a) * r, 0.03]); }
      for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; const bl = box(g, mt.get("#cfe6ee", { opacity: 0.7, rough: 0.2 }), r * 0.45, r * 0.75, 0.004, Math.sin(a) * r * 0.42, cy - r * 0.37 + Math.cos(a) * r * 0.42, 0.0, 0.02); bl.rotation.z = -a; }
      cyl(g, enamel, 0.05, 0.03, 0, cy, 0.03, Math.PI / 2);
      return true;
    }
    case "humidifier": {
      const r = Math.min(w, d) / 2;
      taper(g, enamel, r * 0.9, r, h * 0.85, 0, 0, 0, 32);
      ball(g, enamel, r * 0.9, 0, h * 0.85, 0).scale.y = 0.12;
      cyl(g, mt.get("#cfe6ee", { opacity: 0.5, rough: 0.05, env: 1 }), r * 0.6, h * 0.4, 0, h * 0.3, r * 0.05);
      box(g, mt.get("#55b2ff", { emissive: "#3a7bd5" }), 0.03, 0.01, 0.004, 0, h * 0.18, r + 0.002, 0);
      return true;
    }
  }
  return false;
}
