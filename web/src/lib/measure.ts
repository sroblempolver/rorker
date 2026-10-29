// How the app shows sizes: feet and inches everywhere (plans are still stored in millimetres).
// The drawing tool's own fmtLen/fmtArea/parseLength live in plan/units; these are the app-wide short forms.
import { fmtArea, fmtLen, parseLength } from "@/lib/plan/units";

export const IN = 25.4;
export const FT = 304.8;

/** 13' 9½" */
export const len = (mm: number) => fmtLen(mm, "ft");
/** 120 ft² */
export const area = (m2: number) => fmtArea(m2, "ft");
/** Square feet from square millimetres, e.g. a wall face. */
export const areaMm2 = (mm2: number) => area(mm2 / 1e6);
/** Short things in inches, to the nearest ½: 16", 4½". From 5 ft up, feet and inches. */
export function inches(mm: number): string {
  if (mm >= 60 * IN) return len(mm);
  const halves = Math.round((mm / IN) * 2), i = Math.floor(halves / 2);
  return `${halves % 2 ? `${i || ""}½` : i}"`;
}
/** A typed size in mm: a bare number is inches (16 → 16"), or any form parseLength reads (5' 6", 66 in, 1.2 m). */
export function parseInches(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t) * IN;
  return parseLength(t, "ft");
}
