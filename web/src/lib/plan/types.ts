// Mirror of agent/rorker_agent/schema.py. Millimetres, x right, y down, one frame for all floors.
import type { Part } from "./catalog";
import type { Sketch } from "./sketch";
import type { CabSpec } from "./cabinets";
export type Pt = [number, number];
export type BBox = [number, number, number, number];

export type RoomType =
  | "kitchen" | "bathroom" | "wc" | "bedroom" | "living" | "dining" | "family" | "study" | "office"
  | "hallway" | "foyer" | "stair_hall" | "laundry" | "utility" | "closet" | "garage" | "storage"
  | "balcony" | "porch" | "terrace" | "other";

export type OpeningKind = "door" | "double_door" | "sliding_door" | "garage_door" | "window" | "opening";

export interface DoorLeaf { hinge: Pt; radius: number; start_angle: number; end_angle: number }

export interface Room {
  id: string; name: string; type: RoomType; polygon: Pt[]; area_m2: number; label_source: string;
  confidence: number; outdoor: boolean; wall_ids: string[]; opening_ids: string[];
  drawing_labels: string[]; drawing_area_m2: number | null; notes: string | null;
  /** the home it belongs to, when one drawing has several (a terrace of townhouses, a duplex) */
  unit?: string | null;
}
export interface Wall {
  id: string; polygon: Pt[]; length_mm: number; thickness_mm: number; exterior: boolean; room_ids: string[];
  /** a wall lower than the ceiling (a half wall), mm; `free` when it was drawn as a piece of its own
   *  (it stands as drawn, never read as a porch edge) */
  height_mm?: number; free?: boolean;
}
export interface Opening {
  id: string; kind: OpeningKind; name: string; a: Pt; b: Pt; width_mm: number; thickness_mm: number;
  exterior: boolean; polygon: Pt[]; room_ids: string[]; leaves: DoorLeaf[]; confidence: number;
  /** bottom above the floor and height, when the drawing or the contractor says (house rules otherwise) */
  sill_mm?: number; height_mm?: number;
}
export interface Fixture {
  id: string; kind: string; name: string; room_id: string | null; center: Pt; bbox: BBox; rotation: number;
  outline: Pt[][]; source: string; source_ref: string | null; confidence: number;
  /** Real size and placement for the wall view and 3D; typical values for the kind when missing. */
  height_mm?: number | null; elevation_mm?: number; facing?: number | null; front?: string | null; spec?: string | null;
  product_name?: string | null; product_url?: string | null; notes?: string | null;
  /** weight, kg; the catalogue's typical weight for the kind when missing */
  weight_kg?: number | null;
  /** built from simple shapes, for things that aren't in the catalogue (see lib/plan/catalog.ts) */
  parts?: Part[] | null;
  /** the object it sits on (a computer on its desk), and where that one stood when this was put on it */
  on?: string | null; on_at?: Pt | null;
  /** its number in its room (#1, #2 ...: lib/plan/numbers.ts) */
  no?: number;
  /** a kitchen or bath cabinet: how it's made, so it's rebuilt at a new size */
  cab?: CabSpec;
}
export interface Stair {
  id: string; polygon: Pt[]; room_id: string | null; outline: Pt[][];
  /** each tread and landing with the height of its top above the floor, when the stair's shape is known */
  steps?: { polygon: Pt[]; top_mm: number; /** a spiral's treads are slabs: the underside, when not on the floor */ bottom_mm?: number }[];
  /** a spiral stair's centre pole */
  pole?: { at: Pt; r: number };
}
export interface Floor {
  id: string; name: string; level: number; elevation_mm: number; height_mm: number; footprint: Pt[][];
  bounds: BBox; rooms: Room[]; walls: Wall[]; openings: Opening[]; fixtures: Fixture[]; stairs: Stair[];
  /** openings cut in this floor for stairs coming up from the floor below */
  holes?: Pt[][];
  /** Build mode: points where a straight wall was cut into pieces that move on their own */
  joints?: Pt[];
}
export interface Question {
  id: string; text: string; element_ids: string[]; options: string[]; default: string | null;
  kind: string; answer: string | null;
  /** where on the building the question is about, for the blinking dot (mm; z above that floor) */
  point?: { floor_id: string; x: number; y: number; z: number; outside: boolean } | null;
}
export interface Plan {
  schema_version: number; units: "mm";
  building: { name: string; size_mm: [number, number]; exterior: {
    estimated: boolean; storey_height_mm: number; roof: string; notes: string | null;
    /** set when the drawing or an answer says so; the house rules fill in the rest */
    roof_pitch_deg?: number | null; eave_mm?: number | null; plinth_mm?: number | null;
  } };
  floors: Floor[]; questions: Question[];
  flags: { code: string; message: string; element_ids: string[]; severity: string }[];
  source: { kind: string; filename: string; pipeline_version: string; model: string | null; ai_used: boolean };
  stats: Record<string, unknown>;
  /** the drawing this plan was built from (drawn by hand or read from a file), so the Plan page can open
   *  it again in the drawing tool and every wall, door and piece of furniture stays editable */
  sketch?: Sketch;
}

export type ElementKind = "room" | "wall" | "opening" | "fixture" | "stair";
export type Element =
  | { kind: "room"; floor: Floor; el: Room }
  | { kind: "wall"; floor: Floor; el: Wall }
  | { kind: "opening"; floor: Floor; el: Opening }
  | { kind: "fixture"; floor: Floor; el: Fixture }
  | { kind: "stair"; floor: Floor; el: Stair };

export type ElementStatus = "existing" | "not_built" | "in_progress" | "done" | "demolish";
