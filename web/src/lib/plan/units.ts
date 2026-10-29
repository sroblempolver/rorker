// Lengths for people: metres or feet and inches, both ways. Plans are stored in millimetres; this is
// only how a length is shown and typed.
export type Units = "m" | "ft";

/** "4.20 m", or 13' 9½" to the nearest half inch. `bare` leaves off the "m" for labels on the plan. */
export function fmtLen(mm: number, u: Units, bare = false): string {
  if (u === "m") return `${(mm / 1000).toFixed(2)}${bare ? "" : " m"}`;
  const halves = Math.round((mm / 25.4) * 2), ft = Math.floor(halves / 24), inch = (halves % 24) / 2;
  const i = Number.isInteger(inch) ? `${inch}` : `${Math.floor(inch)}½`;
  return `${ft}' ${i}"`;
}
/** A length rounded to what can be typed: the nearest ½ inch, or the nearest cm in metres. */
export const roundLen = (mm: number, u: Units = "ft") => (u === "ft" ? Math.round(mm / 12.7) * 12.7 : Math.round(mm / 10) * 10);
export const INCH = 25.4;
export const fmtArea = (m2: number, u: Units) => (u === "m" ? `${m2.toFixed(1)} m²` : `${Math.round(m2 * 10.7639)} ft²`);

/**
 * A typed length in mm: "3.6 m", "3600", "360 cm", "12 ft", "12' 6"", "12'6", "12 ft 6 in", "150 in".
 * A bare number is in the units in use: metres (or mm when it's 100 or more), or feet.
 */
export function parseLength(s: string, u: Units = "m"): number | null {
  const t = s.trim().toLowerCase().replace(/,/g, ".").replace(/[’′]/g, "'").replace(/[”″]/g, '"').replace(/\s*½/g, ".5");
  const feetInches = /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/.exec(t);
  if (feetInches) return (parseFloat(feetInches[1]) * 12 + (feetInches[2] ? parseFloat(feetInches[2]) : 0)) * 25.4;
  const m = /^(\d+(?:\.\d+)?)\s*(mm|cm|m|"|in|inch|inches)?$/.exec(t);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!(v >= 0)) return null;
  switch (m[2]) {
    case "mm": return v;
    case "cm": return v * 10;
    case "m": return v * 1000;
    case '"': case "in": case "inch": case "inches": return v * 25.4;
  }
  if (u === "ft") return v * 304.8;
  return v < 100 ? v * 1000 : v;
}
