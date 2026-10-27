// A spot the assistant points at on the plan (no React here: the assistant's own code uses it too).
export interface Mark {
  floor_id: string; x: number; y: number; /** mm above the floor */ z: number;
  label: string; color: string; /** the room, object, door... it points at */ id: string | null;
  /** on the outside of the building (the roof, a porch): shown on the outside view, not inside a floor */
  outside?: boolean;
}

/** Colours with names the assistant can say out loud: "the blue dot". */
export const MARK_COLORS: [string, string][] = [["blue", "#3b9bff"], ["green", "#34d07a"], ["pink", "#ff4fa3"], ["yellow", "#ffd23f"], ["purple", "#a77bff"], ["orange", "#ff8a3d"]];

