// The house behind rorker.com: the app's own 3D view (Plan3D) on the sample house, with a director that
// flies the camera to a pose, keeps the house off to one side of the page, and tells the overlays where
// a spot in the house lands on screen. The explainer and every section of the page only set a Scene
// (what the house shows) and a Pose (where the camera is); the director eases between them.
import { useCallback, useMemo } from "react";
import * as THREE from "three";
import housePlan from "@/demo/house-plan.json";
import { Plan3D, type WallMode } from "@/components/plan/Plan3D";
import type { Controls, PinTarget, Rig, ScreenPoint } from "@/components/plan/target";
import type { JobItem, Pin, PinKind } from "@/lib/data/types";
import type { ElementStatus, Floor, Plan, Pt, Room } from "@/lib/plan/types";
import { stagedPlan, type BuildLook } from "@/lib/plan/build";
import { frontView, labelPoint, pointInPoly } from "@/lib/plan/geometry";

export const plan = housePlan as unknown as Plan;
const S = 0.001;
const fv = frontView(plan);
/** the camera angle that looks straight at the front door */
const FRONT = fv.side === "top" ? Math.PI : 0;

export interface Scene {
  mode: "building" | "floor";
  floorId: string | null;
  look: BuildLook;
  colorMode: "type" | "progress";
  pins: Pin[];
  selected: string | null;
  selectedPin: string | null;
  states: Record<string, ElementStatus>;
  wallMode: WallMode;
  pinMode: boolean;
}

export const BASE_SCENE: Scene = {
  mode: "building", floorId: null, look: "finished", colorMode: "type", pins: [], selected: null, selectedPin: null, states: {}, wallMode: "full", pinMode: false,
};

/** Where the camera sits: around the model (az from the front door, pol from straight down), `dist` in
 *  model radii, looking at `at` (world metres) or the model's middle. `spin` turns it slowly, rad/s. */
export interface Pose { az: number; pol: number; dist: number; at?: [number, number, number] | null; spin?: number }

// ------------------------------------------------------------------------------------------ the plan

export const GROUND = [...plan.floors].sort((a, b) => a.level - b.level)[0];
export const UPPER = [...plan.floors].sort((a, b) => a.level - b.level)[1] ?? GROUND;

export function roomById(id: string): { floor: Floor; room: Room } | null {
  for (const floor of plan.floors) { const room = floor.rooms.find((r) => r.id === id); if (room) return { floor, room }; }
  return null;
}
export const roomByType = (f: Floor, type: string) => f.rooms.find((r) => r.type === type) ?? f.rooms[0];

/** A floor's slab height in metres, from the live model when it's built. */
export function floorY(floorId: string): number {
  const live = director.rig()?.floors.find((f) => f.id === floorId);
  if (live) return live.y0;
  const sorted = [...plan.floors].sort((a, b) => a.level - b.level);
  const i = sorted.findIndex((f) => f.id === floorId);
  const f = sorted[i];
  return ((f?.elevation_mm || i * (plan.building.exterior.storey_height_mm || 3000)) * S);
}

/** The middle of a room, `up` metres above its floor. */
export function roomPoint(id: string, up = 1.1): THREE.Vector3 {
  const hit = roomById(id);
  if (!hit) return new THREE.Vector3();
  const [x, y] = labelPoint(hit.room.polygon);
  return new THREE.Vector3(x * S, floorY(hit.floor.id) + up, y * S);
}
export const roomPlanPoint = (id: string): Pt => { const hit = roomById(id); return hit ? labelPoint(hit.room.polygon) : [0, 0]; };

let pinSeq = 0;
export const resetPins = () => { pinSeq = 0; };
export function makePin(p: Partial<Pin> & { title: string; kind: PinKind }): Pin {
  pinSeq += 1;
  return {
    id: `pin-${pinSeq}`, job_id: "hadley", number: pinSeq, element_id: null, floor_id: null, x: null, y: null, anchor: null, body: null,
    status: "open", priority: 1, due_date: null, tagged: [], close_requirement: "confirm", stage_id: null, links: [], created_by: null,
    created_at: new Date().toISOString(), closed_at: null, comment_count: 0, ...p,
  };
}

// ------------------------------------------------------------------------------------------ feet and inches

export function feetInches(mm: number): string {
  const inches = Math.round(Math.abs(mm) / 25.4);
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}
export const squareFeet = (m2: number) => `${Math.round(m2 * 10.7639)} ft²`;

// ------------------------------------------------------------------------------------------ the director

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;

class Director {
  getRig: (() => Rig | null) | null = null;
  goal: Pose = { az: 0.6, pol: 0.95, dist: 3.4, spin: 0.04 };
  /** fly the camera (true), or leave it to the visitor's mouse (false) */
  driving = true;
  /** how far right the house sits, as a share of the screen width */
  shift = 0;
  /** where the visitor's mouse is, -1..1, so the house leans toward it a little */
  lean = { x: 0, y: 0 };
  private cur: { t: THREE.Vector3; az: number; pol: number; d: number } | null = null;
  private shown = 0;
  private last = 0;
  private fns = new Set<(r: Rig) => void>();
  private view = "";

  constructor() { if (typeof window !== "undefined") requestAnimationFrame(this.tick); }
  rig() { return this.getRig?.() ?? null; }
  each(f: (r: Rig) => void) { this.fns.add(f); return () => { this.fns.delete(f); }; }

  pose(p: Pose) { this.goal = { ...p }; }
  /** jump straight to the goal, no glide (first frame, or when the visitor hands the camera back) */
  snap() { this.cur = null; }

  release() {
    this.driving = false;
    const r = this.rig();
    if (r) { r.orbit.enabled = true; r.orbit.enableZoom = false; }
  }
  take() {
    const r = this.rig();
    this.driving = true;
    if (!r) return;
    r.orbit.enabled = false;
    // carry on from wherever the visitor left the camera
    const off = r.camera.position.clone().sub(r.orbit.target);
    const d = off.length();
    this.cur = { t: r.orbit.target.clone(), d, pol: Math.acos(clamp(off.y / d, -1, 1)), az: Math.atan2(off.x, off.z) };
  }

  /** Screen position (CSS px, viewport) of a point in the house. */
  toScreen(v: THREE.Vector3): { x: number; y: number; on: boolean } {
    const r = this.rig();
    if (!r) return { x: -999, y: -999, on: false };
    const rect = r.canvas.getBoundingClientRect();
    const p = v.clone().project(r.camera);
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height, on: p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
  }

  /** What's under a screen point: the room on the highest floor shown there, with the spot in plan mm. */
  pick(clientX: number, clientY: number, floorIds: string[]): { floor: Floor; room: Room | null; at: Pt } | null {
    const r = this.rig();
    if (!r) return null;
    const rect = r.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, r.camera);
    const floors = plan.floors.filter((f) => floorIds.includes(f.id)).sort((a, b) => b.level - a.level);
    for (const f of floors) {
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY(f.id)), new THREE.Vector3());
      if (!hit) continue;
      const at: Pt = [hit.x / S, hit.z / S];
      const room = f.rooms.find((q) => pointInPoly(at, q.polygon)) ?? null;
      if (room) return { floor: f, room, at };
    }
    return null;
  }

  private tick = (now: number) => {
    requestAnimationFrame(this.tick);
    const r = this.rig();
    if (!r) return;
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.place(r, dt);
    if (this.driving) {
      r.orbit.enabled = false;
      const g = this.goal;
      if (g.spin) g.az += g.spin * dt;
      const t = g.at ? new THREE.Vector3(...g.at) : r.centre.clone();
      // a tall, narrow screen (a phone) needs to stand further back to fit the house across
      const narrow = Math.sqrt(Math.max(1, 1.2 / r.camera.aspect));
      const d = clamp(g.dist * r.radius * narrow, r.orbit.minDistance * 1.01, r.orbit.maxDistance * 0.99);
      const az = FRONT + g.az + this.lean.x * 0.14;
      const pol = clamp(g.pol + this.lean.y * 0.05, 0.04, Math.PI / 2 - 0.06);
      if (!this.cur) this.cur = { t: t.clone(), az, pol, d };
      else {
        const k = 1 - Math.exp(-dt * 2.2);
        this.cur.t.lerp(t, k);
        this.cur.az += wrap(az - this.cur.az) * k;
        this.cur.pol += (pol - this.cur.pol) * k;
        this.cur.d += (d - this.cur.d) * k;
      }
      const c = this.cur;
      r.orbit.target.copy(c.t);
      r.camera.position.set(c.t.x + c.d * Math.sin(c.pol) * Math.sin(c.az), c.t.y + c.d * Math.cos(c.pol), c.t.z + c.d * Math.sin(c.pol) * Math.cos(c.az));
      r.camera.lookAt(c.t);
    }
    for (const f of this.fns) f(r);
  };

  /** Keep the house to the right of the text by shifting the picture, not the camera. */
  private place(r: Rig, dt: number) {
    this.shown += (this.shift - this.shown) * (1 - Math.exp(-dt * 3));
    if (Math.abs(this.shown - this.shift) < 0.0005) this.shown = this.shift;
    const w = r.canvas.clientWidth, h = r.canvas.clientHeight;
    const key = `${w}x${h}@${this.shown.toFixed(4)}`;
    if (key === this.view || !w || !h) return;
    this.view = key;
    if (Math.abs(this.shown) < 0.0005) r.camera.clearViewOffset();
    else r.camera.setViewOffset(w, h, -this.shown * w, 0, w, h);
    r.camera.aspect = w / h;
    r.camera.updateProjectionMatrix();
  }
}

export const director = new Director();

// ------------------------------------------------------------------------------------------ the view

const NO_ITEMS: JobItem[] = [];
const noop = () => {};

export function House({ scene, onOpenFloor, onPlacePin, onSelectPin, onLimitOut }: {
  scene: Scene;
  onOpenFloor?: (id: string) => void;
  onPlacePin?: (t: PinTarget, at: ScreenPoint) => void;
  onSelectPin?: (id: string) => void;
  onLimitOut?: () => void;
}) {
  // what's built at this stage: furniture only once it's finished
  const shown = useMemo(() => stagedPlan(plan, scene.look, "all"), [scene.look]);
  const floor = scene.mode === "floor" ? shown.floors.find((f) => f.id === scene.floorId) ?? shown.floors[0] : null;
  const states = useMemo(() => new Map(Object.entries(scene.states)), [scene.states]);
  const controls = useCallback<Controls>((api) => { director.getRig = api.rig ?? null; }, []);
  return (
    <Plan3D plan={shown} mode={scene.mode} floor={floor} room={null} selected={scene.selected} selectedPin={scene.selectedPin} selectedItem={null}
      states={states} colorMode={scene.colorMode} pins={scene.pins} items={NO_ITEMS} pinMode={scene.pinMode} draft={null} wallMode={scene.wallMode}
      look={scene.look} locked controls={controls} onSelect={noop} onSelectPin={onSelectPin ?? noop} onSelectItem={noop} onPlacePin={onPlacePin ?? noop}
      onMoveFixture={noop} onMoveItem={noop} onMovePin={noop} onOpenFloor={onOpenFloor ?? noop} onLimitOut={onLimitOut ?? noop} />
  );
}
