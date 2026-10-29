// An item's number (lib/plan/numbers.ts) in a small round tag on the plan. A wall cabinet's tag sits
// toward the wall and the base cabinet's under it toward the room, so the two don't cover each other.
import type { Pt } from "@/lib/plan/types";

export function ItemBadge({ n, at, r, hung }: { n: number; at: Pt; r: number; hung?: boolean }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`} pointerEvents="none">
      <circle r={r} fill={hung ? "#2a2723" : "#ff6a1f"} stroke="#fff" strokeWidth={r * 0.14} />
      <text y={r * 0.36} textAnchor="middle" fontSize={r * (n > 9 ? 0.95 : 1.1)} fontWeight={700} fill="#fff" fontFamily="var(--font-mono)">{n}</text>
    </g>
  );
}

/** Where an item's tag goes: its centre, moved toward its back when it hangs and toward its front when it stands under one. */
export function badgeSpot(center: Pt, half: Pt, facing: number | null | undefined, hung: boolean): Pt {
  if (facing == null) return center;
  const a = (facing * Math.PI) / 180, k = hung ? -0.45 : 0.4;
  return [center[0] + Math.round(Math.cos(a)) * half[0] * k, center[1] + Math.round(Math.sin(a)) * half[1] * k];
}
