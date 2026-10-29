// 3D models of the things in a plan, built from rounded boxes, cylinders and spheres to their real sizes,
// with wood grain, upholstery weave, stone tops and metal and glass that reflect a sky (see shapes3d.ts).
// Each model is made in its own frame: width along x, depth along z with the front facing +z,
// standing on y = 0, centred on the origin. Units are metres.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { drawnAs, partsOf, wideFront } from "@/lib/plan/catalog";
import type { Fixture } from "@/lib/plan/types";
import { fixtureSize } from "@/lib/plan/edits";
import { fixtureBottom, fixtureHeight } from "./fixtures";
import { ball, box, C, cyl, faucet, front, fromParts, Materials, rod, screen, taper } from "./shapes3d";
import { extraModel } from "./extraModels3d";

export { Materials, SHARED_GEOMETRY } from "./shapes3d";

function counterUnit(g: THREE.Group, mt: Materials, f: Fixture, w: number, d: number, h: number) {
  const top = 0.032, toe = 0.1;
  box(g, mt.get(C.plinth), w - 0.01, toe, d - 0.1, 0, 0, -0.045, 0);
  const steel = mt.auto(C.steel);
  const isAppliance = f.kind === "dishwasher" || f.kind === "range" || f.kind === "oven";
  box(g, mt.auto(C.carcass), w - 0.004, h - toe - top, d - 0.04, 0, toe, -0.02, 0.002);
  const worktop = mt.auto(C.worktop);
  if (f.kind !== "filler" && f.kind !== "range") box(g, worktop, w, top, d + 0.02, 0, h - top, 0.01, 0.004);
  const fr = f.kind === "dishwasher" ? "appliance" : f.front;
  if (f.kind === "range" || f.kind === "oven") {
    // a slide-in range: the steel body, an oven door with its window, a handle bar and the knobs
    box(g, steel, w - 0.004, h - top - 0.01, d - 0.03, 0, 0, -0.015, 0.004);
    box(g, mt.get(C.black, { rough: 0.15, env: 0.6 }), w - 0.06, h * 0.5, 0.012, 0, 0.12, d / 2 - 0.01, 0.006);
    box(g, mt.get("#0d0d0e", { rough: 0.05, env: 1.2, metal: 0.3 }), w * 0.62, h * 0.26, 0.004, 0, 0.22, d / 2 - 0.002, 0);
    rod(g, steel, 0.012, w - 0.12, 0, h * 0.62 + 0.04, d / 2 + 0.035);
    box(g, mt.get(C.black, { rough: 0.25 }), w - 0.04, 0.012, 0.11, 0, 0.06, d / 2 - 0.05, 0.003);
    for (let i = 0; i < 5; i++) cyl(g, mt.get(C.black, { rough: 0.4 }), 0.018, 0.025, -w * 0.36 + i * w * 0.18, h - 0.07, d / 2 + 0.01, Math.PI / 2);
  } else if (f.kind === "dishwasher") {
    box(g, steel, w - 0.006, h - toe - top - 0.01, 0.02, 0, toe, d / 2 - 0.02, 0.004);
    box(g, mt.get(C.black, { rough: 0.3 }), w - 0.03, 0.05, 0.005, 0, h - top - 0.07, d / 2 - 0.006, 0);
    rod(g, steel, 0.011, w - 0.12, 0, h - top - 0.11, d / 2 + 0.02);
  } else if (!isAppliance) front(g, mt, fr, w, toe, h - top, d - 0.04);
  if (f.kind === "range" || f.kind === "cooktop") {
    // glass top with grates over the burners
    const gy = h - (f.kind === "range" ? 0.01 : 0);
    box(g, mt.get(C.black, { rough: 0.1, env: 0.8 }), w - 0.02, 0.012, d - 0.06, 0, gy, 0, 0.004);
    const gm = mt.get("#2b2b2c", { rough: 0.6, metal: 0.4 });
    for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) {
      const bx = (x * w) / 1.2, bz = (z * d) / 1.2;
      cyl(g, gm, Math.min(w, d) * 0.08, 0.018, bx, gy + 0.012, bz);
      box(g, gm, Math.min(w, d) * 0.3, 0.012, 0.012, bx, gy + 0.03, bz, 0);
      box(g, gm, 0.012, 0.012, Math.min(w, d) * 0.3, bx, gy + 0.03, bz, 0);
    }
    if (f.kind === "range") box(g, steel, w, 0.08, 0.04, 0, h - 0.01, -d / 2 + 0.02, 0.004);
  }
  if (f.kind === "kitchen_sink" || f.front === "sink") {
    // an undermount bowl in the stone, a gooseneck faucet behind it
    const bw = Math.min(0.76, w * 0.78), bd = d * 0.55;
    box(g, mt.get(C.steel, { metal: 0.8, rough: 0.35, env: 0.8 }), bw, 0.004, bd, 0, h - 0.001, 0.03, 0);
    box(g, mt.get("#57595c", { metal: 0.6, rough: 0.4 }), bw - 0.02, 0.003, bd - 0.02, 0, h + 0.002, 0.03, 0);
    faucet(g, mt, 0, h, -d / 2 + 0.07, 0.34);
  }
}

function model(f: Fixture, mt: Materials, w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  if (f.parts?.length) { fromParts(g, mt, f.parts); return g; }
  // catalogue things drawn by hand in detail
  if (extraModel(g, mt, f.kind, w, d, h)) return g;
  // catalogue things with a look of their own, stretched to this size, or drawn as the kind they're like
  const own = partsOf(f.kind, w * 1000, d * 1000, h * 1000);
  if (own) { fromParts(g, mt, own); return g; }
  if (drawnAs(f.kind) !== f.kind) return model({ ...f, kind: drawnAs(f.kind) }, mt, w, d, h);
  const wood = mt.auto(C.timber), darkWood = mt.auto(C.dark), white = mt.get(C.porcelain, { rough: 0.18, env: 0.6 });
  const fabric = mt.auto(C.fabric), cushion = mt.auto(C.cushion), linen = mt.auto(C.linen);
  const steel = mt.auto(C.steel), black = mt.get(C.black, { rough: 0.35, env: 0.3 });
  const tapered = (x: number, z: number, H: number, t = 0.04) => taper(g, wood, t * 0.3, t * 0.5, H, x, 0, z, 10);
  switch (f.kind) {
    case "base_cabinet": case "kitchen_sink": case "dishwasher": case "range": case "cooktop": case "oven": case "island": case "filler":
      counterUnit(g, mt, f, w, d, h); break;
    case "wall_cabinet": case "tall_cabinet":
      box(g, mt.auto(C.carcass), w - 0.004, h, d - 0.02, 0, 0, -0.01, 0.002);
      if (f.kind === "tall_cabinet") { front(g, mt, "doors", w, 0.1, h * 0.62, d - 0.02); front(g, mt, "doors", w, h * 0.62 + 0.003, h - 0.01, d - 0.02); box(g, mt.get(C.plinth), w - 0.01, 0.1, d - 0.1, 0, 0, -0.04, 0); }
      else front(g, mt, f.front ?? "door", w, 0.005, h - 0.005, d - 0.02);
      break;
    case "range_hood":
      // a chimney hood: the canopy tapering up into the flue
      taper(g, steel, 0.3, 1, 0.2, 0, 0.05, -d * 0.1, 4).scale.set(w * 0.707, 0.2, d * 0.8 * 0.707);
      box(g, steel, w, 0.05, d, 0, 0, 0, 0.004);
      box(g, mt.get("#3a3c3f", { metal: 0.6, rough: 0.5 }), w - 0.06, 0.004, d - 0.06, 0, -0.002, 0, 0);
      box(g, steel, w * 0.34, h - 0.25, d * 0.42, 0, 0.25, -d * 0.25, 0.003);
      for (const x of [-w * 0.25, w * 0.25]) cyl(g, mt.get(C.black), 0.012, 0.012, x, 0.025, d / 2 + 0.005, Math.PI / 2);
      break;
    case "fridge": {
      // french doors over a freezer drawer, long bar handles
      box(g, steel, w - 0.01, h - 0.01, d - 0.06, 0, 0, -0.03, 0.01);
      const split = h * 0.64, dz = d / 2 - 0.03;
      box(g, steel, w / 2 - 0.006, h - split - 0.012, 0.055, -w / 4, split + 0.004, dz, 0.012);
      box(g, steel, w / 2 - 0.006, h - split - 0.012, 0.055, w / 4, split + 0.004, dz, 0.012);
      box(g, steel, w - 0.01, split - 0.06, 0.055, 0, 0.05, dz, 0.012);
      box(g, mt.get(C.black), w - 0.04, 0.05, d - 0.08, 0, 0, -0.03, 0);
      const hm = mt.get(C.steel, { metal: 0.9, rough: 0.15, env: 1.3 });
      for (const x of [-0.03, 0.03]) { cyl(g, hm, 0.013, h - split - 0.25, x, split + 0.12, dz + 0.07); for (const y of [split + 0.14, h - 0.15]) box(g, hm, 0.016, 0.016, 0.05, x, y, dz + 0.045, 0.005); }
      rod(g, hm, 0.013, w * 0.6, 0, split - 0.12, dz + 0.07);
      box(g, mt.get("#1f2a33", { rough: 0.1, emissive: "#1d3550" }), 0.08, 0.12, 0.004, -w / 4 + 0.08, split + (h - split) * 0.45, dz + 0.029, 0);
      break;
    }
    case "toilet": {
      // the tank and its lid against the wall, a rounded bowl, a seat and lid, the foot
      const td = Math.min(0.2, d * 0.28);
      box(g, white, w * 0.88, 0.36, td, 0, 0.4, -d / 2 + td / 2 + 0.01, 0.02);
      box(g, white, w * 0.92, 0.035, td + 0.02, 0, 0.76, -d / 2 + td / 2 + 0.01, 0.012);
      box(g, mt.get(C.steel, { metal: 0.9, rough: 0.2, env: 1 }), 0.05, 0.015, 0.015, -w * 0.3, 0.68, -d / 2 + td + 0.015, 0.004);
      taper(g, white, w * 0.3, w * 0.2, 0.25, 0, 0, d * 0.05).scale.z = d * 0.5;
      taper(g, white, w * 0.45, w * 0.32, 0.16, 0, 0.25, d * 0.08).scale.z = d * 0.65;
      const seat = taper(g, white, w * 0.47, w * 0.47, 0.03, 0, 0.41, d * 0.08);
      seat.scale.z = d * 0.68;
      taper(g, mt.get("#d9d7d1", { rough: 0.2 }), w * 0.32, w * 0.3, 0.004, 0, 0.441, d * 0.1).scale.z = d * 0.46;
      break;
    }
    case "washbasin":
      // a pedestal sink: the column flaring to the basin, a faucet
      taper(g, white, Math.min(w, d) * 0.1, Math.min(w, d) * 0.16, 0.76, 0, 0, -d * 0.1);
      box(g, white, w, 0.14, d, 0, 0.76, 0, 0.04);
      box(g, mt.get("#dfe3e2", { rough: 0.15, env: 0.6 }), w * 0.72, 0.004, d * 0.58, 0, 0.9, 0.03, 0.03);
      faucet(g, mt, 0, 0.9, -d / 2 + 0.06, 0.16);
      break;
    case "vanity": {
      const H = Math.min(h, 0.9);
      box(g, mt.get(C.plinth), w - 0.04, 0.08, d - 0.08, 0, 0, -0.03, 0);
      box(g, wood, w - 0.01, H - 0.11, d - 0.03, 0, 0.08, -0.015, 0.003);
      front(g, mt, w > 0.9 ? "doors" : "door_drawer", w, 0.08, H - 0.03, d - 0.03, "#b48a5e");
      box(g, mt.auto("#e8e4dc"), w, 0.03, d + 0.01, 0, H - 0.03, 0.005, 0.004);
      const n = w > 1.2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : (i === 0 ? -w / 4 : w / 4);
        box(g, mt.get("#d7d2c7", { rough: 0.15, env: 0.6 }), Math.min(0.5, w * 0.4), 0.004, d * 0.55, x, H, 0.03, 0.03);
        faucet(g, mt, x, H, -d / 2 + 0.06, 0.18);
      }
      break;
    }
    case "bathtub": {
      const H = Math.min(h, 0.58);
      box(g, white, w, H, d, 0, 0, 0, 0.03);
      box(g, mt.get("#e6ecec", { rough: 0.12, env: 0.5 }), w - 0.14, 0.004, d - 0.14, 0, H - 0.001, 0, 0.06);
      box(g, mt.get("#cfdfe3", { rough: 0.1, env: 0.8 }), w - 0.2, 0.002, d - 0.2, 0, H + 0.002, 0.0, 0.08);
      const fm = mt.get(C.steel, { metal: 0.9, rough: 0.15, env: 1.3 });
      rod(g, fm, 0.018, 0.14, -w / 2 + 0.1, H + 0.04, 0);
      cyl(g, fm, 0.022, 0.03, -w / 2 + 0.06, H, -0.1); cyl(g, fm, 0.022, 0.03, -w / 2 + 0.06, H, 0.1);
      break;
    }
    case "shower": {
      // a tray, glass on its open sides in a thin frame, a rain head and a valve
      box(g, white, w, 0.06, d, 0, 0, 0, 0.01);
      box(g, mt.get("#d9dcdc", { rough: 0.3 }), w - 0.08, 0.002, d - 0.08, 0, 0.06, 0, 0);
      const glass = mt.get("#bcd9e2", { opacity: 0.22, rough: 0.05, env: 1 });
      const fr = mt.get(C.steel, { metal: 0.85, rough: 0.2, env: 1 });
      box(g, glass, w - 0.02, 1.95, 0.008, 0, 0.06, d / 2 - 0.01, 0);
      box(g, glass, 0.008, 1.95, d - 0.02, w / 2 - 0.01, 0.06, 0, 0);
      box(g, fr, w, 0.02, 0.02, 0, 2.0, d / 2 - 0.01, 0.004);
      box(g, fr, 0.02, 0.02, d, w / 2 - 0.01, 2.0, 0, 0.004);
      box(g, fr, 0.02, 1.95, 0.02, w / 2 - 0.01, 0.06, d / 2 - 0.01, 0.004);
      box(g, fr, 0.012, 1.0, 0.03, w * 0.05, 0.6, d / 2 + 0.01, 0.005);
      rod(g, fr, 0.012, 0.35, -w / 2 + 0.2, 2.02, -d / 2 + 0.18, "z");
      cyl(g, fr, 0.11, 0.012, -w / 2 + 0.2, 2.0, -d / 2 + 0.35);
      cyl(g, fr, 0.035, 0.02, -w / 2 + 0.2, 1.1, -d / 2 + 0.01, Math.PI / 2);
      break;
    }
    case "bed": {
      // a frame on legs, a mattress, a duvet folded back, pillows, an upholstered headboard
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, darkWood, 0.06, 0.12, 0.06, x * (w / 2 - 0.05), 0, z * (d / 2 - 0.05), 0.006);
      box(g, wood, w, 0.16, d, 0, 0.12, 0, 0.02);
      box(g, mt.get("#f2efe8", { map: "weave", rough: 0.95 }), w - 0.06, 0.24, d - 0.1, 0, 0.28, 0.02, 0.05);
      box(g, fabric, w - 0.02, 0.07, d * 0.62, 0, 0.47, d * 0.18, 0.035);
      box(g, linen, w - 0.03, 0.04, d * 0.14, 0, 0.5, d * 0.18 - d * 0.31 + d * 0.07, 0.02);
      const pw = w > 1.2 ? (w - 0.3) / 2 : w - 0.2;
      for (const x of w > 1.2 ? [-pw / 2 - 0.05, pw / 2 + 0.05] : [0]) {
        const pl = box(g, mt.get(C.white, { map: "weave", rough: 0.95 }), pw, 0.14, 0.36, x, 0.5, -d / 2 + 0.3, 0.06);
        pl.rotation.x = -0.25;
      }
      box(g, mt.auto("#5a4a40"), w + 0.04, 1.0, 0.1, 0, 0, -d / 2 - 0.02, 0.03);
      for (let i = 0; i < Math.max(2, Math.round(w / 0.4)); i++) {
        const n = Math.max(2, Math.round(w / 0.4)), pw2 = (w - 0.08) / n;
        box(g, mt.auto("#6b594d"), pw2 - 0.02, 0.48, 0.03, -w / 2 + 0.04 + pw2 * (i + 0.5), 0.45, -d / 2 + 0.03, 0.012);
      }
      break;
    }
    case "sofa": case "armchair": {
      // legs, a base, a seat cushion per seat, back cushions leaning back, rounded arms
      const arm = Math.min(0.2, w * 0.17), seatH = 0.44;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) taper(g, darkWood, 0.016, 0.022, 0.08, x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06), 10);
      box(g, fabric, w, 0.2, d, 0, 0.08, 0, 0.03);
      box(g, fabric, w, 0.62, Math.min(0.2, d * 0.23), 0, 0.2, -d / 2 + Math.min(0.1, d * 0.115), 0.04);
      for (const x of [-w / 2 + arm / 2, w / 2 - arm / 2]) box(g, fabric, arm, 0.38, d, x, 0.2, 0, 0.06);
      const seats = f.kind === "armchair" ? 1 : Math.max(2, Math.min(3, Math.round((w - 2 * arm) / 0.65)));
      const sw = (w - 2 * arm) / seats, sd = d - Math.min(0.2, d * 0.23) - 0.02;
      for (let i = 0; i < seats; i++) {
        const x = -w / 2 + arm + sw * (i + 0.5);
        box(g, cushion, sw - 0.01, seatH - 0.28, sd, x, 0.28, d / 2 - sd / 2, 0.05);
        const back = box(g, cushion, sw - 0.02, 0.42, 0.14, x, seatH - 0.02, -d / 2 + Math.min(0.2, d * 0.23) + 0.06, 0.06);
        back.rotation.x = -0.12;
      }
      break;
    }
    case "chair": {
      const s = Math.min(w, d);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tapered((x * s) / 2.35, (z * s) / 2.35, 0.43, 0.04);
      box(g, wood, s * 0.94, 0.035, s * 0.94, 0, 0.43, 0, 0.008);
      box(g, mt.auto(C.cushion), s * 0.8, 0.03, s * 0.78, 0, 0.465, 0.01, 0.012);
      for (const x of [-1, 1]) box(g, wood, 0.035, 0.48, 0.035, (x * s) / 2.35, 0.43, -s * 0.43, 0.006);
      box(g, wood, s * 0.88, 0.12, 0.025, 0, 0.78, -s * 0.44, 0.006);
      for (const x of [-0.18, 0, 0.18]) box(g, wood, 0.03, 0.3, 0.018, x * s, 0.47, -s * 0.44, 0.004);
      break;
    }
    case "table": case "dining_table": case "desk": {
      const H = Math.min(h, 0.76);
      box(g, wood, w, 0.035, d, 0, H - 0.035, 0, 0.008);
      box(g, wood, w - 0.14, 0.08, 0.022, 0, H - 0.115, d / 2 - 0.07, 0.004);
      box(g, wood, w - 0.14, 0.08, 0.022, 0, H - 0.115, -d / 2 + 0.07, 0.004);
      box(g, wood, 0.022, 0.08, d - 0.14, -w / 2 + 0.07, H - 0.115, 0, 0.004);
      box(g, wood, 0.022, 0.08, d - 0.14, w / 2 - 0.07, H - 0.115, 0, 0.004);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) taper(g, wood, 0.018, 0.028, H - 0.035, x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06), 4);
      if (f.kind === "desk") { box(g, wood, Math.min(0.45, w * 0.35), 0.12, d - 0.16, w / 2 - Math.min(0.45, w * 0.35) / 2 - 0.08, H - 0.155, 0); front(g, mt, "drawers", Math.min(0.42, w * 0.33), H - 0.15, H - 0.04, d - 0.16); }
      break;
    }
    case "nightstand": case "sideboard": case "wardrobe": {
      const legH = f.kind === "wardrobe" ? 0.08 : 0.12;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) taper(g, darkWood, 0.015, 0.02, legH, x * (w / 2 - 0.04), 0, z * (d / 2 - 0.04), 4);
      box(g, wood, w, h - legH, d - 0.02, 0, legH, -0.01, 0.006);
      box(g, wood, w + 0.01, 0.025, d + 0.005, 0, h - 0.025, 0, 0.006);
      const g2 = new THREE.Group();
      front(g2, mt, f.kind === "nightstand" ? "drawers" : "doors", f.kind === "sideboard" ? w / 2 : w, legH + 0.02, h - 0.04, d - 0.02, C.timber);
      g.add(g2);
      if (f.kind === "sideboard") { g2.position.x = -w / 4; const g3 = new THREE.Group(); front(g3, mt, "drawers", w / 2, legH + 0.02, h - 0.04, d - 0.02, C.timber); g3.position.x = w / 4; g.add(g3); }
      break;
    }
    case "bookshelf": {
      box(g, darkWood, w, h, 0.012, 0, 0, -d / 2 + 0.006, 0);
      box(g, wood, 0.022, h, d, -w / 2 + 0.011, 0, 0, 0.004);
      box(g, wood, 0.022, h, d, w / 2 - 0.011, 0, 0, 0.004);
      const n = Math.max(2, Math.round(h / 0.38));
      const books = ["#7d6a8a", "#5d7f9e", "#b0623a", "#c9a46a", "#3f5f4a", "#a33b33", "#e2dccf", "#2f3b52"];
      let k = 0;
      for (let i = 0; i <= n; i++) {
        const y = (i * (h - 0.022)) / n;
        box(g, wood, w - 0.044, 0.022, d - 0.02, 0, y, 0.01, 0.003);
        if (i === n) break;
        // books standing on each shelf, a gap here and there
        let x = -w / 2 + 0.03;
        const sh = (h - 0.022) / n - 0.04;
        while (x < w / 2 - 0.06) {
          const bw = 0.022 + ((k * 7) % 5) * 0.006, bh = sh * (0.68 + ((k * 3) % 4) * 0.07);
          if (k % 11 === 5) { x += 0.08; k++; continue; }
          box(g, mt.get(books[k % books.length], { rough: 0.7 }), bw, bh, d * 0.75, x + bw / 2, y + 0.022, 0.0, 0.002);
          x += bw + 0.002; k++;
        }
      }
      break;
    }
    case "washing_machine": case "dryer": {
      const enamel = mt.get(C.white, { rough: 0.25, env: 0.5 });
      box(g, enamel, w, h, d, 0, 0, 0, 0.015);
      box(g, mt.get("#d9d6cf", { rough: 0.4 }), w - 0.02, 0.12, 0.006, 0, h - 0.14, d / 2, 0.003);
      cyl(g, mt.get(C.steel, { metal: 0.8, rough: 0.25, env: 1 }), 0.03, 0.02, w * 0.3, h - 0.08, d / 2 + 0.008, Math.PI / 2);
      box(g, mt.get("#1f2a33", { emissive: "#1d3550", rough: 0.1 }), 0.12, 0.04, 0.004, -w * 0.15, h - 0.1, d / 2 + 0.004, 0);
      const r = Math.min(w, h) * 0.3, cy = h * 0.45;
      cyl(g, mt.get(C.steel, { metal: 0.85, rough: 0.2, env: 1.2 }), r + 0.03, 0.03, 0, cy, d / 2 + 0.01, Math.PI / 2);
      cyl(g, mt.get("#2b3a44", { rough: 0.04, metal: 0.5, env: 1.4, opacity: 0.85 }), r, 0.035, 0, cy, d / 2 + 0.014, Math.PI / 2);
      break;
    }
    case "water_heater": {
      const r = Math.min(w, d) / 2, enamel = mt.get(C.white, { rough: 0.3, env: 0.4 });
      cyl(g, enamel, r, h - 0.06, 0, 0.03, 0);
      ball(g, enamel, r, 0, h - 0.04, 0).scale.y = 0.12;
      cyl(g, mt.get("#3a3c3f"), r * 0.98, 0.04, 0, 0, 0);
      for (const [x, c] of [[-r * 0.4, "#b0623a"], [r * 0.4, "#5d7f9e"]] as const) cyl(g, mt.get(c, { metal: 0.6, rough: 0.35 }), 0.012, 0.3, x, h - 0.04, 0);
      box(g, mt.get("#d7d2c7"), r * 0.6, 0.18, 0.004, 0, h * 0.55, r * 0.98, 0);
      box(g, mt.get("#3a3c3f"), 0.08, 0.1, 0.04, 0, 0.3, r, 0.006);
      break;
    }
    case "lamp": {
      cyl(g, black, 0.14, 0.025, 0, 0, 0);
      cyl(g, mt.get("#b8955a", { metal: 0.85, rough: 0.3, env: 1 }), 0.01, h - 0.3, 0, 0.025, 0);
      taper(g, mt.get(C.shade, { emissive: "#ffcf73", map: "weave" }), 0.15, 0.2, 0.3, 0, h - 0.32, 0);
      break;
    }
    case "plant": {
      const r = Math.min(w, d);
      taper(g, mt.get(C.pot, { rough: 0.85 }), r * 0.27, r * 0.2, 0.34, 0, 0, 0, 20);
      cyl(g, mt.get("#3d2f24", { rough: 1 }), r * 0.25, 0.01, 0, 0.32, 0);
      const lm = mt.get(C.leaf, { rough: 0.7 }), lm2 = mt.get(C.green, { rough: 0.8 });
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, rr = r * (0.18 + (i % 3) * 0.08), y = 0.34 + (h - 0.34) * (0.35 + (i % 4) * 0.17);
        ball(g, i % 2 ? lm : lm2, r * (0.2 + (i % 3) * 0.04), Math.sin(a) * rr, y, Math.cos(a) * rr).scale.y *= 0.85;
      }
      cyl(g, mt.get("#5b4630"), 0.012, (h - 0.34) * 0.7, 0, 0.34, 0);
      break;
    }
    case "tv": case "monitor": {
      // a screen: on a foot when it stands on something, flat to the wall when it hangs
      const stand = f.kind === "monitor" || fixtureBottom(f) < 1000;
      const sh = f.kind === "tv" ? Math.min(h, w * 0.6) : h * 0.72;
      const t = Math.min(0.04, d * 0.4);
      if (stand) {
        box(g, steel, w * 0.3, 0.012, Math.min(d, 0.22), 0, 0, 0, 0.004);
        box(g, steel, 0.05, h - sh + 0.02, 0.03, 0, 0, -t, 0.006);
      }
      const z0 = stand ? 0 : -d / 2 + t / 2;
      box(g, mt.get("#141516", { rough: 0.3, env: 0.4 }), w, sh, t, 0, h - sh, z0, 0.006);
      screen(g, mt, w - 0.016, sh - 0.016, 0, h - sh + 0.008, z0 + t / 2 + 0.002);
      break;
    }
    case "computer": {
      // a monitor on its stand, a keyboard and mouse in front, the tower to the right
      const mw = Math.min(w * 0.68, 0.62), mh = Math.min(h, 0.46) * 0.75, tw = Math.min(0.2, w * 0.22);
      const mx = -w / 2 + mw / 2 + 0.02, mz = -d / 2 + 0.09;
      box(g, steel, 0.22, 0.012, 0.16, mx, 0, mz, 0.004);
      box(g, steel, 0.05, h - mh, 0.03, mx, 0, mz - 0.03, 0.006);
      box(g, mt.get("#141516", { rough: 0.3 }), mw, mh, 0.03, mx, h - mh, mz, 0.006);
      screen(g, mt, mw - 0.016, mh - 0.016, mx, h - mh + 0.008, mz + 0.017);
      box(g, mt.get("#3b3c40", { rough: 0.6 }), Math.min(0.44, mw * 0.8), 0.018, 0.14, mx, 0, d / 2 - 0.1, 0.005);
      box(g, mt.get("#3b3c40", { rough: 0.5 }), 0.06, 0.028, 0.1, mx + Math.min(0.44, mw * 0.8) / 2 + 0.08, 0, d / 2 - 0.1, 0.012);
      box(g, mt.get(C.black, { rough: 0.4 }), tw, h * 0.95, Math.min(d - 0.02, 0.42), w / 2 - tw / 2, 0, 0, 0.008);
      box(g, mt.get("#55b2ff", { emissive: "#55b2ff" }), 0.012, 0.012, 0.004, w / 2 - tw / 2, h * 0.85, Math.min(d - 0.02, 0.42) / 2 + 0.002, 0);
      break;
    }
    case "laptop": {
      const al = mt.get("#9da3aa", { metal: 0.7, rough: 0.3, env: 1 });
      box(g, al, w, 0.016, d, 0, 0, 0, 0.006);
      box(g, mt.get("#3b3c40"), w * 0.85, 0.002, d * 0.45, 0, 0.016, d * 0.02, 0);
      box(g, mt.get("#8e949b", { metal: 0.6, rough: 0.4 }), w * 0.35, 0.002, d * 0.25, 0, 0.016, d * 0.32, 0);
      const lid = new THREE.Group();
      box(lid, al, w, Math.min(h, d), 0.007, 0, 0, 0, 0.004);
      screen(lid, mt, w * 0.92, Math.min(h, d) * 0.86, 0, Math.min(h, d) * 0.06, 0.0045);
      lid.position.set(0, 0.016, -d / 2 + 0.004);
      lid.rotation.x = -0.25;
      g.add(lid);
      break;
    }
    case "printer":
      box(g, mt.get("#e6e1d6", { rough: 0.45 }), w, h, d, 0, 0, 0, 0.015);
      box(g, mt.get("#3b3c40"), w * 0.7, 0.02, 0.01, 0, h * 0.45, d / 2, 0);
      box(g, mt.get(C.white), w * 0.6, 0.004, d * 0.5, 0, h, -d * 0.1, 0);
      box(g, mt.get("#1f2a33", { emissive: "#1d3550" }), w * 0.2, 0.006, 0.05, w * 0.3, h, d * 0.35, 0);
      break;
    case "microwave":
      box(g, steel, w, h, d, 0, 0, 0, 0.008);
      box(g, mt.get("#141516", { rough: 0.05, env: 1.2, metal: 0.3 }), w * 0.68, h * 0.78, 0.005, -w * 0.12, h * 0.11, d / 2, 0);
      box(g, mt.get(C.black, { rough: 0.3 }), w * 0.2, h * 0.8, 0.005, w * 0.37, h * 0.1, d / 2, 0);
      box(g, mt.get("#55b2ff", { emissive: "#3a7bd5" }), w * 0.12, 0.02, 0.003, w * 0.37, h * 0.75, d / 2 + 0.003, 0);
      break;
    case "coffee_machine":
      box(g, black, w, h, d * 0.75, 0, 0, -d * 0.125, 0.015);
      box(g, black, w, 0.04, d, 0, 0, 0, 0.01);
      box(g, steel, w * 0.5, 0.04, d * 0.25, 0, h * 0.62, d * 0.3, 0.006);
      box(g, mt.get(C.steel, { metal: 0.9, rough: 0.2, env: 1 }), w * 0.8, 0.012, d * 0.3, 0, 0.04, d * 0.3, 0.004);
      taper(g, mt.get(C.white, { rough: 0.2 }), 0.04, 0.032, 0.08, 0, 0.052, d * 0.3);
      break;
    case "kettle":
      taper(g, steel, Math.min(w, d) * 0.34, Math.min(w, d) * 0.44, h * 0.8, 0, 0.02, 0);
      cyl(g, mt.get(C.black), Math.min(w, d) * 0.46, 0.02, 0, 0, 0);
      box(g, mt.get(C.black), 0.025, h * 0.6, 0.03, -w * 0.42, h * 0.15, 0, 0.01);
      box(g, mt.get(C.black), w * 0.25, 0.025, 0.03, -w * 0.32, h * 0.75, 0, 0.01);
      ball(g, mt.get(C.black), 0.02, 0, h * 0.82 + 0.02, 0);
      taper(g, steel, 0.012, 0.022, h * 0.3, w * 0.38, h * 0.45, 0, 12).rotation.z = -0.6;
      break;
    case "toaster":
      box(g, steel, w, h, d, 0, 0, 0, 0.03);
      for (const x of [-w * 0.18, w * 0.18]) box(g, mt.get(C.black), w * 0.26, 0.004, d * 0.25, x, h, 0, 0.002);
      box(g, mt.get(C.black), 0.02, 0.02, 0.03, w * 0.35, h * 0.6, d / 2 + 0.01, 0.006);
      break;
    case "bar_stool": {
      const r = Math.min(w, d) / 2;
      taper(g, wood, r * 0.92, r * 0.85, 0.05, 0, h - 0.05, 0);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = box(g, mt.get(C.black, { metal: 0.5, rough: 0.4 }), 0.025, h - 0.05, 0.025, x * r * 0.62, 0, z * r * 0.62, 0.006);
        leg.rotation.set(z * 0.05, 0, -x * 0.05);
      }
      cyl(g, mt.get(C.black, { metal: 0.5, rough: 0.4 }), r * 0.66, 0.015, 0, h * 0.3, 0);
      box(g, wood, r * 1.4, 0.16, 0.025, 0, h + 0.02, -r * 0.8, 0.008).rotation.x = -0.15;
      for (const x of [-1, 1]) box(g, mt.get(C.black), 0.02, 0.2, 0.02, x * r * 0.6, h - 0.02, -r * 0.75, 0.005);
      break;
    }
    case "office_chair": {
      const dk = mt.get("#2b2c30", { rough: 0.85, map: "weave" });
      const base = mt.get(C.black, { rough: 0.3, env: 0.4 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2, L = Math.min(w, d) * 0.42;
        const leg = box(g, base, 0.04, 0.03, L, Math.sin(a) * L / 2, 0.05, Math.cos(a) * L / 2, 0.01);
        leg.rotation.y = a;
        ball(g, base, 0.03, Math.sin(a) * L, 0.03, Math.cos(a) * L);
      }
      cyl(g, mt.get(C.steel, { metal: 0.9, rough: 0.2, env: 1 }), 0.025, 0.4, 0, 0.06, 0);
      box(g, dk, w * 0.8, 0.09, d * 0.75, 0, 0.44, 0.02, 0.03);
      const back = box(g, dk, w * 0.72, h - 0.58, 0.07, 0, 0.58, -d * 0.36, 0.03);
      back.rotation.x = -0.08;
      box(g, base, 0.06, 0.15, 0.04, 0, 0.47, -d * 0.36, 0.01);
      for (const x of [-1, 1]) { box(g, base, 0.03, 0.2, 0.03, x * w * 0.38, 0.52, 0, 0.008); box(g, base, 0.06, 0.03, d * 0.4, x * w * 0.38, 0.72, 0, 0.012); }
      break;
    }
    case "coffee_table":
      box(g, wood, w, 0.04, d, 0, h - 0.04, 0, 0.01);
      box(g, wood, w - 0.1, 0.02, d - 0.1, 0, 0.12, 0, 0.005);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, wood, 0.05, h - 0.04, 0.05, x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06), 0.008);
      box(g, mt.get("#c9a46a", { rough: 0.6 }), 0.22, 0.03, 0.16, w * 0.15, h, 0, 0.004);
      box(g, mt.get("#5d7f9e", { rough: 0.6 }), 0.2, 0.025, 0.14, w * 0.15, h + 0.03, 0.005, 0.004);
      break;
    case "dresser": case "filing_cabinet": {
      const metal = f.kind === "filing_cabinet";
      const body = metal ? mt.get("#7d8187", { metal: 0.4, rough: 0.45, env: 0.5 }) : wood;
      if (!metal) for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) taper(g, darkWood, 0.015, 0.02, 0.1, x * (w / 2 - 0.04), 0, z * (d / 2 - 0.04), 4);
      box(g, body, w, h - (metal ? 0 : 0.1), d - 0.02, 0, metal ? 0 : 0.1, -0.01, 0.006);
      front(g, mt, "drawers", w, (metal ? 0 : 0.1) + 0.02, h - 0.03, d - 0.02, metal ? "#8a8e94" : C.timber);
      break;
    }
    case "crib": {
      const wh = mt.get(C.white, { rough: 0.5 });
      box(g, mt.get("#f2efe8", { map: "weave", rough: 0.95 }), w - 0.06, 0.12, d - 0.06, 0, 0.3, 0, 0.03);
      for (const z of [-1, 1]) box(g, wh, w, 0.04, 0.04, 0, h - 0.04, z * (d / 2 - 0.02), 0.01);
      for (const x of [-1, 1]) box(g, wh, 0.04, 0.04, d, x * (w / 2 - 0.02), h - 0.04, 0, 0.01);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, wh, 0.05, h, 0.05, x * (w / 2 - 0.025), 0, z * (d / 2 - 0.025), 0.01);
      const n = Math.round(d / 0.09);
      for (let i = 1; i < n; i++) for (const x of [-1, 1]) cyl(g, wh, 0.01, h - 0.35, x * (w / 2 - 0.02), 0.3, -d / 2 + (d / n) * i);
      break;
    }
    case "mirror":
      box(g, mt.get("#b8955a", { metal: 0.8, rough: 0.3, env: 1 }), w, h, d * 0.6, 0, 0, -d * 0.2, 0.008);
      box(g, mt.get("#d6e4e8", { metal: 0.95, rough: 0.02, env: 1.6 }), w - 0.05, h - 0.05, 0.005, 0, 0.025, d * 0.1, 0);
      break;
    case "picture":
      box(g, mt.get("#2a2724", { rough: 0.5 }), w, h, d, 0, 0, 0, 0.004);
      box(g, mt.get(C.white, { rough: 0.9 }), w - 0.04, h - 0.04, 0.004, 0, 0.02, d / 2, 0);
      box(g, mt.get("#5d7f9e", { rough: 0.9 }), w - 0.14, (h - 0.14) * 0.55, 0.005, 0, 0.07 + (h - 0.14) * 0.45, d / 2 + 0.001, 0);
      box(g, mt.get("#6f8f5a", { rough: 0.9 }), w - 0.14, (h - 0.14) * 0.45, 0.005, 0, 0.07, d / 2 + 0.001, 0);
      ball(g, mt.get("#f3c56b", { rough: 0.9 }), Math.min(w, h) * 0.06, w * 0.2, h * 0.68, d / 2 + 0.002).scale.z = 0.05;
      break;
    case "wall_shelf": {
      box(g, wood, w, Math.max(h, 0.025), d, 0, 0, 0, 0.004);
      const cols = ["#7d6a8a", "#5d7f9e", "#b0623a", "#c9a46a", "#3f5f4a"];
      for (let i = 0; i < Math.floor(w / 0.12); i++) box(g, mt.get(cols[i % cols.length], { rough: 0.7 }), 0.03, 0.18 + (i % 3) * 0.03, d * 0.7, -w / 2 + 0.06 + i * 0.1, Math.max(h, 0.025), 0, 0.002);
      break;
    }
    case "rug":
      box(g, mt.get("#7a5a4a", { rough: 1, map: "weave" }), w, Math.max(h, 0.008), d, 0, 0, 0, 0.004);
      box(g, mt.get("#b08d6e", { rough: 1, map: "weave" }), w - 0.16, 0.002, d - 0.16, 0, Math.max(h, 0.008), 0, 0);
      box(g, mt.get("#7a5a4a", { rough: 1, map: "weave" }), w - 0.4, 0.002, d - 0.4, 0, Math.max(h, 0.008) + 0.001, 0, 0);
      break;
    case "table_lamp":
      taper(g, mt.get("#c9c2b4", { rough: 0.25, env: 0.5 }), Math.min(w, d) * 0.12, Math.min(w, d) * 0.28, h * 0.5, 0, 0, 0);
      cyl(g, mt.get("#b8955a", { metal: 0.85, rough: 0.3 }), 0.008, h * 0.1, 0, h * 0.5, 0);
      taper(g, mt.get(C.shade, { emissive: "#ffcf73", map: "weave" }), Math.min(w, d) * 0.36, Math.min(w, d) * 0.5, h * 0.42, 0, h * 0.58, 0);
      break;
    case "piano": {
      const bk = mt.get("#0e0e0f", { rough: 0.08, env: 0.9 });
      box(g, bk, w, h, d * 0.55, 0, 0, -d * 0.22, 0.01);
      box(g, bk, w, 0.06, d, 0, h * 0.56, 0, 0.008);
      box(g, mt.get(C.white, { rough: 0.3 }), w - 0.12, 0.02, d * 0.3, 0, h * 0.56 + 0.06, d * 0.3, 0.002);
      const keys = Math.floor((w - 0.12) / 0.027);
      for (let i = 0; i < keys; i++) if ([1, 3, 6, 8, 10].includes(i % 12)) box(g, bk, 0.012, 0.012, d * 0.18, -w / 2 + 0.06 + i * 0.027 * (12 / 7) * 0.58, h * 0.56 + 0.08, d * 0.25, 0.002);
      for (const x of [-1, 1]) box(g, bk, 0.06, h * 0.56, 0.08, x * (w / 2 - 0.05), 0, d / 2 - 0.08, 0.008);
      box(g, mt.get("#b8955a", { metal: 0.85, rough: 0.3 }), 0.08, 0.04, 0.01, 0, 0.25, d * 0.06, 0.003);
      break;
    }
    case "treadmill": {
      const dk = mt.get("#2b2c30", { rough: 0.5 });
      box(g, dk, w * 0.9, 0.15, d, 0, 0, 0, 0.03);
      box(g, mt.get(C.black, { rough: 0.95 }), w * 0.6, 0.005, d * 0.85, 0, 0.15, d * 0.05, 0);
      for (const x of [-1, 1]) box(g, dk, 0.05, h - 0.15, 0.05, x * w * 0.42, 0.15, -d / 2 + 0.15, 0.015);
      box(g, dk, w * 0.9, 0.2, 0.15, 0, h - 0.2, -d / 2 + 0.15, 0.03);
      screen(g, mt, w * 0.3, 0.1, 0, h - 0.15, -d / 2 + 0.23);
      break;
    }
    case "ceiling_fan": {
      cyl(g, steel, 0.015, h * 0.6, 0, h * 0.4, 0);
      taper(g, mt.get(C.white, { rough: 0.3, env: 0.4 }), 0.06, 0.1, 0.12, 0, h * 0.3, 0);
      ball(g, mt.get(C.lamp, { emissive: "#ffcf73" }), 0.08, 0, h * 0.28, 0).scale.y = 0.5;
      for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; box(g, wood, 0.13, 0.008, w / 2 - 0.1, Math.sin(a) * w * 0.27, h * 0.37, Math.cos(a) * w * 0.27, 0.003).rotation.y = a; }
      break;
    }
    case "pendant_light":
      cyl(g, mt.get(C.black), 0.004, h * 0.5, 0, h * 0.5, 0);
      taper(g, mt.get("#2b2c30", { metal: 0.6, rough: 0.35, env: 0.6 }), Math.min(w, d) * 0.08, Math.min(w, d) * 0.48, h * 0.45, 0, 0.04, 0);
      ball(g, mt.get(C.lamp, { emissive: "#ffcf73" }), Math.min(w, d) * 0.12, 0, 0.06, 0);
      break;
    case "car": {
      const along = w >= d ? "x" : "z";
      const L = Math.max(w, d), Wd = Math.min(w, d);
      const sub = new THREE.Group();
      const paint = mt.get(C.car, { metal: 0.6, rough: 0.25, env: 1 });
      box(sub, paint, L, 0.55, Wd, 0, 0.22, 0, 0.12);
      box(sub, paint, L * 0.5, 0.48, Wd * 0.88, -L * 0.05, 0.72, 0, 0.12);
      const gl = mt.get("#1d252c", { rough: 0.03, metal: 0.6, env: 1.5 });
      box(sub, gl, L * 0.46, 0.38, Wd * 0.9, -L * 0.05, 0.76, 0, 0.1);
      const tire = mt.get("#1a1a1a", { rough: 0.9 }), rim = mt.get(C.steel, { metal: 0.9, rough: 0.25, env: 1 });
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        cyl(sub, tire, 0.33, 0.22, x * L * 0.32, 0.33, (z * Wd) / 2.15, Math.PI / 2);
        cyl(sub, rim, 0.2, 0.23, x * L * 0.32, 0.33, (z * Wd) / 2.15, Math.PI / 2);
      }
      for (const z of [-1, 1]) {
        box(sub, mt.get("#fff6d8", { emissive: "#fff1c4" }), 0.03, 0.08, 0.22, L / 2 - 0.01, 0.55, z * Wd * 0.33, 0.01);
        box(sub, mt.get("#c0392b", { emissive: "#7a1d14" }), 0.03, 0.08, 0.22, -L / 2 + 0.01, 0.58, z * Wd * 0.33, 0.01);
      }
      if (along === "z") sub.rotation.y = Math.PI / 2;
      g.add(sub);
      break;
    }
    case "fireplace": {
      const st = mt.auto(C.stone);
      box(g, st, w, h, d, 0, 0, 0, 0.01);
      box(g, wood, w + 0.1, 0.07, d + 0.08, 0, h - 0.07, 0.03, 0.01);
      box(g, mt.get("#141414", { rough: 0.9 }), w * 0.55, h * 0.48, 0.02, 0, 0.12, d / 2 - 0.005, 0.004);
      box(g, st, w + 0.06, 0.06, d + 0.25, 0, 0, 0.12, 0.01);
      for (const y of [0.15, 0.2]) rod(g, mt.get("#5b4630"), 0.03, w * 0.35, 0, y, d / 2 - 0.06 - (y - 0.15) * 0.6);
      ball(g, mt.get("#ff7d3b", { emissive: "#ff6a1f" }), w * 0.08, 0, 0.26, d / 2 - 0.06).scale.set(w * 0.4, 0.12, 0.06);
      break;
    }
    case "towel_radiator":
      for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) cyl(g, white, 0.016, h, x, 0, 0);
      for (let i = 0; i < Math.floor(h / 0.12); i++) rod(g, white, 0.011, w - 0.04, 0, 0.08 + i * 0.12, 0);
      break;
    default:
      box(g, mt.auto(C.stone), w, h, d, 0, 0, 0);
  }
  return g;
}

/** The fixture as a 3D object placed in the plan frame (x = plan x, z = plan y, y up), floor at `base` m. */
export function fixtureObject(f: Fixture, mt: Materials, base: number): THREE.Object3D {
  const S = 0.001;
  const bottom = fixtureBottom(f);
  let h = (f.height_mm ?? fixtureHeight(f.kind)) * S;
  if (f.kind === "other" && !f.parts?.length) {
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
    if ((wideFront(f.kind) || ["bed", "bathtub"].includes(f.kind)) && d > w * 1.15) { [w, d] = [d, w]; rot = Math.PI / 2; }
  }
  if (h <= 0) h = 0.85;
  const g = merged(model(f, mt, Math.max(w, 0.05), Math.max(d, 0.05), h));
  if (f.facing != null) g.add(frontArrow(Math.max(w, 0.05), Math.max(d, 0.05)));
  const holder = new THREE.Group();
  holder.add(g);
  g.rotation.y = rot;
  holder.position.set(f.center[0] * S, base + bottom * S, f.center[1] * S);
  return holder;
}

/** The model's parts as one mesh per material: a kitchen of thirty cabinets draws in a few dozen calls. */
function merged(g: THREE.Group): THREE.Group {
  g.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
    const mat = mesh.material as THREE.Material;
    const l = byMat.get(mat);
    if (l) l.push(geo); else byMat.set(mat, [geo]);
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const geo = list.length === 1 ? list[0] : mergeGeometries(list);
    if (!geo) continue;
    if (list.length > 1) list.forEach((x) => x.dispose());
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !(mat as THREE.MeshStandardMaterial).transparent;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

/** A yellow arrow on the floor out from its front (the side with the doors or opening), shown while selected. */
function frontArrow(w: number, d: number): THREE.Object3D {
  const k = Math.min(0.35, Math.max(0.18, w * 0.4));
  const shape = new THREE.Shape([new THREE.Vector2(-k * 0.5, 0), new THREE.Vector2(k * 0.5, 0), new THREE.Vector2(0, k * 0.8)]);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: "#ffd23f", transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }));
  mesh.rotation.x = Math.PI / 2; // lie flat, pointing out of the front (+z)
  mesh.position.set(0, 0.02, d / 2 + 0.06);
  mesh.renderOrder = 25;
  mesh.name = "front";
  mesh.visible = false;
  mesh.raycast = () => {};
  return mesh;
}

function hullRing(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
