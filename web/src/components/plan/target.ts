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

export type Controls = (api: { zoomBy: (f: number) => void; home: () => void }) => void;
