// Small things on a wall (outlets, switches, lights ...): what they look like in the wall view and
// in 3D, their real sizes and the heights they usually go at.
import type { ItemKind } from "@/lib/data/types";

export const ITEM_KINDS: ItemKind[] = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];

export const ITEM_LABEL: Record<ItemKind, string> = {
  outlet: "Outlet", switch: "Switch", light: "Wall light", data: "Data / TV", plumbing: "Plumbing point",
  vent: "Vent", thermostat: "Thermostat", mount: "Mount / shelf", other: "Other",
};

export const ITEM_ICON: Record<ItemKind, string> = {
  outlet: "⏻", switch: "⎍", light: "✶", data: "⌁", plumbing: "⌇", vent: "≡", thermostat: "◔", mount: "▭", other: "•",
};

/** Usual centre height above the floor, mm, at US heights in whole inches: outlets 16", switches 48",
 *  wall lights 66", sink supply 22", high vents 84", thermostats 60". */
const inch = (n: number) => n * 25.4;
export const ITEM_HEIGHT: Record<ItemKind, number> = {
  outlet: inch(16), switch: inch(48), light: inch(66), data: inch(16), plumbing: inch(22), vent: inch(84), thermostat: inch(60), mount: inch(60), other: inch(48),
};

/** Real face size, mm: width x height. */
export const ITEM_SIZE: Record<ItemKind, [number, number]> = {
  outlet: [70, 115], switch: [70, 115], light: [160, 220], data: [70, 115], plumbing: [260, 90],
  vent: [250, 150], thermostat: [90, 90], mount: [400, 400], other: [120, 120],
};

const INK = "#1b1a17";
const PLATE = "#fbf8f1";

/** The item drawn face-on in the wall view, centred on 0,0 (y down). `min` is the smallest size on
 *  screen in world units, so a 2¾" faceplate stays visible on a 16' wall. */
export function ItemGlyph({ kind, min, selected, hot }: { kind: ItemKind; min: number; selected?: boolean; hot?: boolean }) {
  const [rw, rh] = ITEM_SIZE[kind];
  const k = Math.max(1, min / rh);
  const w = rw * k, h = rh * k;
  const s = Math.max(2, h * 0.04);
  const ring = selected ? "#55b2ff" : hot ? "#ffffff" : null;
  let face: React.ReactNode;
  switch (kind) {
    case "outlet":
      face = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.12} fill={PLATE} stroke={INK} strokeWidth={s} />
          {[-0.22, 0.22].map((oy) => (
            <g key={oy}>
              <rect x={-w * 0.28} y={h * oy - h * 0.13} width={w * 0.56} height={h * 0.26} rx={w * 0.1} fill="#eee6d6" stroke={INK} strokeWidth={s * 0.7} />
              <path d={`M${-w * 0.1} ${h * oy - h * 0.05}v${h * 0.07}M${w * 0.1} ${h * oy - h * 0.05}v${h * 0.07}`} stroke={INK} strokeWidth={s} />
            </g>
          ))}
        </>
      );
      break;
    case "switch":
      face = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.12} fill={PLATE} stroke={INK} strokeWidth={s} />
          <rect x={-w * 0.13} y={-h * 0.2} width={w * 0.26} height={h * 0.4} rx={w * 0.05} fill="#e8dfcd" stroke={INK} strokeWidth={s * 0.8} />
        </>
      );
      break;
    case "data":
      face = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.12} fill={PLATE} stroke={INK} strokeWidth={s} />
          <rect x={-w * 0.22} y={-h * 0.3} width={w * 0.44} height={h * 0.22} fill={INK} />
          <circle cx={0} cy={h * 0.2} r={w * 0.17} fill="#c7bfae" stroke={INK} strokeWidth={s * 0.7} />
        </>
      );
      break;
    case "light":
      face = (
        <>
          <rect x={-w * 0.2} y={-h * 0.1} width={w * 0.4} height={h * 0.2} fill="#9c978d" stroke={INK} strokeWidth={s} />
          <path d={`M${-w / 2} ${-h * 0.05}L${-w * 0.3} ${-h / 2}H${w * 0.3}L${w / 2} ${-h * 0.05}Z`} fill="#ffd27a" stroke={INK} strokeWidth={s} />
          <ellipse cx={0} cy={-h * 0.6} rx={w * 0.7} ry={h * 0.25} fill="#ffd27a" opacity={0.18} />
        </>
      );
      break;
    case "plumbing":
      face = (
        <>
          <rect x={-w / 2} y={-h * 0.1} width={w} height={h * 0.2} rx={h * 0.1} fill="#b9bec4" stroke={INK} strokeWidth={s} />
          <circle cx={-w * 0.3} cy={0} r={h * 0.45} fill="#e8432e" stroke={INK} strokeWidth={s} />
          <circle cx={w * 0.3} cy={0} r={h * 0.45} fill="#55b2ff" stroke={INK} strokeWidth={s} />
        </>
      );
      break;
    case "vent":
      face = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#e6e1d6" stroke={INK} strokeWidth={s} />
          {[-0.25, 0, 0.25].map((oy) => <path key={oy} d={`M${-w * 0.4} ${h * oy}H${w * 0.4}`} stroke={INK} strokeWidth={s} />)}
        </>
      );
      break;
    case "thermostat":
      face = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.2} fill={PLATE} stroke={INK} strokeWidth={s} />
          <circle cx={0} cy={0} r={w * 0.3} fill="#2a2b2e" />
          <text y={w * 0.09} textAnchor="middle" fontSize={w * 0.26} fill="#7ee0a0" fontFamily="var(--font-mono)">21</text>
        </>
      );
      break;
    case "mount":
      face = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke={INK} strokeWidth={s * 1.4} strokeDasharray={`${s * 4} ${s * 3}`} />
          <path d={`M${-w * 0.35} ${-h * 0.35}V${h * 0.35}M${w * 0.35} ${-h * 0.35}V${h * 0.35}M${-w * 0.35} 0H${w * 0.35}`} stroke="#5d5a53" strokeWidth={s * 2.5} />
        </>
      );
      break;
    default:
      face = <circle r={h / 2} fill={PLATE} stroke={INK} strokeWidth={s} />;
  }
  return (
    <g>
      {ring && <rect x={-w / 2 - s * 4} y={-h / 2 - s * 4} width={w + s * 8} height={h + s * 8} rx={s * 3} fill={ring} fillOpacity={0.18} stroke={ring} strokeWidth={s * 1.4} />}
      {face}
      {/* a generous invisible grab area */}
      <rect x={-Math.max(w, min) / 2 - s * 6} y={-Math.max(h, min) / 2 - s * 6} width={Math.max(w, min) + s * 12} height={Math.max(h, min) + s * 12} fill="transparent" />
    </g>
  );
}

