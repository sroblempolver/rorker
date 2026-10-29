import type * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PinAnchor } from "@/lib/data/types";

/** Where a new pin goes: a floor point and/or element, or a spot in an upright view (anchor). */
export interface PinTarget {
  floorId: string | null;
  x: number | null;
  y: number | null;
  elementId: string | null;
  anchor: PinAnchor | null;
}

/** Screen point of the click, so the quick-note card can open right there. */
export type ScreenPoint = { x: number; y: number };

/** The 3D view's camera and model, for code that drives the camera itself (the rorker.com explainer). */
export interface Rig {
  camera: THREE.PerspectiveCamera; orbit: OrbitControls; canvas: HTMLCanvasElement;
  /** each floor's slab and ceiling height, metres */
  floors: { id: string; y0: number; y1: number }[];
  centre: THREE.Vector3; radius: number;
}

export type Controls = (api: { zoomBy: (f: number) => void; home: () => void; rig?: () => Rig | null }) => void;
