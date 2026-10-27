// Mirror of agent/rorker_agent/schema.py. Millimetres, x right, y down, one frame for all floors.
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
}
export interface Wall {
  id: string; polygon: Pt[]; length_mm: number; thickness_mm: number; exterior: boolean; room_ids: string[];
}
export interface Opening {
  id: string; kind: OpeningKind; name: string; a: Pt; b: Pt; width_mm: number; thickness_mm: number;
  exterior: boolean; polygon: Pt[]; room_ids: string[]; leaves: DoorLeaf[]; confidence: number;
}
export interface Fixture {
  id: string; kind: string; name: string; room_id: string | null; center: Pt; bbox: BBox; rotation: number;
  outline: Pt[][]; source: string; source_ref: string | null; confidence: number;
  /** Real size and placement for the wall view and 3D; typical values for the kind when missing. */
  height_mm?: number | null; elevation_mm?: number; facing?: number | null; front?: string | null; spec?: string | null;
  product_name?: string | null; product_url?: string | null; notes?: string | null;
}
export interface Stair { id: string; polygon: Pt[]; room_id: string | null; outline: Pt[][] }
export interface Floor {
  id: string; name: string; level: number; elevation_mm: number; height_mm: number; footprint: Pt[][];
  bounds: BBox; rooms: Room[]; walls: Wall[]; openings: Opening[]; fixtures: Fixture[]; stairs: Stair[];
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
}

export type ElementKind = "room" | "wall" | "opening" | "fixture" | "stair";
export type Element =
  | { kind: "room"; floor: Floor; el: Room }
  | { kind: "wall"; floor: Floor; el: Wall }
  | { kind: "opening"; floor: Floor; el: Opening }
  | { kind: "fixture"; floor: Floor; el: Fixture }
  | { kind: "stair"; floor: Floor; el: Stair };

export type ElementStatus = "existing" | "not_built" | "in_progress" | "done" | "demolish";
