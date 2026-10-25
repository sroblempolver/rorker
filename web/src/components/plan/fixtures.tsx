// Front elevations of the things that stand against a wall: what you would see facing that wall.
// Shapes are generic per kind and drawn to the fixture's real width; heights are typical values.
import type { Fixture } from "@/lib/plan/types";

const INK = "#1b1a17";
const BODY = "#f4efe6";   // sanitary white / painted carcass
const TIMBER = "#a07850";
const STEEL = "#b9bec4";
const FABRIC = "#6f7486";

/** Typical top height in mm, used for the label and hit box. */
export function fixtureHeight(kind: string): number {
  const h: Record<string, number> = {
    toilet: 800, washbasin: 900, vanity: 900, bathtub: 580, shower: 2050, base_cabinet: 900, kitchen_sink: 900, cooktop: 900,
    range: 900, dishwasher: 900, oven: 900, island: 900, wall_cabinet: 2250, tall_cabinet: 2200, fridge: 1850, wardrobe: 2200,
    bookshelf: 2000, washing_machine: 850, dryer: 850, water_heater: 1500, bed: 1050, sofa: 850, armchair: 850, chair: 900,
    desk: 750, table: 750, dining_table: 750, nightstand: 550, lamp: 1600, plant: 1200, tv: 1700, fireplace: 1150,
    towel_radiator: 1500, other: 850,
  };
  return h[kind] ?? 850;
}

export function FixtureElevation({ f, x0, x1, lw, tint }: { f: Fixture; x0: number; x1: number; lw: number; tint?: string | null }) {
  const w = Math.max(x1 - x0, 200);
  const cx = x0 + w / 2;
  const s = 1.2 * lw;
  const body = tint ?? BODY;
  const line = { stroke: INK, strokeWidth: s, strokeLinejoin: "round" as const };
  switch (f.kind) {
    case "toilet": {
      const pw = Math.min(w, 420);
      return (
        <g {...line}>
          <rect x={cx - pw * 0.48} y={-800} width={pw * 0.96} height={420} rx={40} fill={body} />
          <path d={`M${cx - pw / 2} -400H${cx + pw / 2}L${cx + pw * 0.38} -60Q${cx} 0 ${cx - pw * 0.38} -60Z`} fill={body} />
          <rect x={cx - pw / 2 - 10} y={-430} width={pw + 20} height={40} rx={18} fill={body} />
          <rect x={cx - 50} y={-790} width={100} height={30} rx={8} fill={STEEL} />
        </g>
      );
    }
    case "washbasin":
      return (
        <g {...line}>
          <rect x={cx - 90} y={-760} width={180} height={760} fill={body} />
          <path d={`M${x0} -900H${x1}V-830Q${cx} -650 ${x0} -830Z`} fill={body} />
          <path d={`M${cx} -900V-1020H${cx + 110}`} fill="none" stroke={STEEL} strokeWidth={30} strokeLinecap="round" />
          <rect x={x0 + w * 0.1} y={-1900} width={w * 0.8} height={700} fill="#8fd3f0" fillOpacity={0.25} />
        </g>
      );
    case "vanity":
      return (
        <g {...line}>
          <rect x={x0} y={-860} width={w} height={760} fill={tint ?? TIMBER} />
          <path d={`M${cx} -860V-100`} />
          <rect x={x0 - 20} y={-900} width={w + 40} height={40} fill={body} />
          <path d={`M${cx} -900V-1020H${cx + 110}`} fill="none" stroke={STEEL} strokeWidth={30} strokeLinecap="round" />
        </g>
      );
    case "bathtub":
      return (
        <g {...line}>
          <rect x={x0} y={-580} width={w} height={580} rx={30} fill={body} />
          <path d={`M${x0} -520H${x1}`} strokeOpacity={0.5} />
          <path d={`M${x0 + 160} -580V-760H${x0 + 300}`} fill="none" stroke={STEEL} strokeWidth={30} strokeLinecap="round" />
        </g>
      );
    case "shower":
      return (
        <g {...line}>
          <rect x={x0} y={-2050} width={w} height={2050} fill="#8fd3f0" fillOpacity={0.22} />
          <path d={`M${x0} -100H${x1}`} />
          <path d={`M${cx} -2050V-1950`} stroke={STEEL} strokeWidth={30} />
          <ellipse cx={cx} cy={-1930} rx={110} ry={30} fill={STEEL} />
        </g>
      );
    case "base_cabinet": case "kitchen_sink": case "cooktop": case "range": case "dishwasher": case "oven": case "island": {
      const n = Math.max(1, Math.round(w / 600));
      return (
        <g {...line}>
          <rect x={x0} y={-860} width={w} height={760} fill={tint ?? "#d9d2c4"} />
          <rect x={x0 + 40} y={-100} width={w - 80} height={100} fill="#3b3a37" />
          {Array.from({ length: n - 1 }, (_, i) => <path key={i} d={`M${x0 + (w / n) * (i + 1)} -860V-100`} />)}
          <rect x={x0 - 20} y={-900} width={w + 40} height={40} fill="#4a4844" />
          {f.kind === "kitchen_sink" && <path d={`M${cx} -900V-1080H${cx + 160}`} fill="none" stroke={STEEL} strokeWidth={30} strokeLinecap="round" />}
          {(f.kind === "oven" || f.kind === "range") && <rect x={x0 + 60} y={-760} width={w - 120} height={480} fill="#2a2a2c" />}
          {(f.kind === "cooktop" || f.kind === "range") && Array.from({ length: 4 }, (_, i) => <circle key={i} cx={x0 + (w / 5) * (i + 1)} cy={-820} r={22} fill={INK} />)}
        </g>
      );
    }
    case "wall_cabinet":
      return <rect x={x0} y={-2250} width={w} height={700} fill={tint ?? "#d9d2c4"} {...line} />;
    case "tall_cabinet": case "wardrobe": case "bookshelf": {
      const n = Math.max(1, Math.round(w / 500));
      return (
        <g {...line}>
          <rect x={x0} y={-2200} width={w} height={2200} fill={tint ?? (f.kind === "bookshelf" ? TIMBER : "#d9d2c4")} />
          {f.kind === "bookshelf"
            ? Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${x0} ${-400 * (i + 1)}H${x1}`} />)
            : Array.from({ length: n - 1 }, (_, i) => <path key={i} d={`M${x0 + (w / n) * (i + 1)} -2200V0`} />)}
        </g>
      );
    }
    case "fridge":
      return (
        <g {...line}>
          <rect x={x0} y={-1850} width={w} height={1850} rx={30} fill={tint ?? STEEL} />
          <path d={`M${x0} -1250H${x1}M${x1 - 80} -1700V-1350M${x1 - 80} -1150V-700`} />
        </g>
      );
    case "washing_machine": case "dryer":
      return (
        <g {...line}>
          <rect x={x0} y={-850} width={w} height={850} rx={20} fill={body} />
          <circle cx={cx} cy={-430} r={Math.min(w, 600) * 0.32} fill="#3b3a37" />
          <path d={`M${x0} -720H${x1}`} />
        </g>
      );
    case "water_heater":
      return <rect x={cx - Math.min(w, 560) / 2} y={-1500} width={Math.min(w, 560)} height={1500} rx={200} fill={body} {...line} />;
    case "bed":
      return (
        <g {...line}>
          <rect x={x0} y={-1050} width={w} height={1050} rx={40} fill={tint ?? TIMBER} />
          <rect x={x0 + 40} y={-560} width={w - 80} height={300} rx={60} fill="#e9e3d6" />
          <rect x={x0 + w * 0.08} y={-700} width={w * 0.36} height={160} rx={60} fill="#fff" />
          <rect x={x1 - w * 0.44} y={-700} width={w * 0.36} height={160} rx={60} fill="#fff" />
        </g>
      );
    case "sofa": case "armchair":
      return (
        <g {...line}>
          <rect x={x0} y={-850} width={w} height={500} rx={80} fill={tint ?? FABRIC} />
          <rect x={x0} y={-450} width={w} height={300} rx={60} fill={tint ?? FABRIC} />
          <rect x={x0 - 30} y={-650} width={170} height={520} rx={60} fill={tint ?? FABRIC} />
          <rect x={x1 - 140} y={-650} width={170} height={520} rx={60} fill={tint ?? FABRIC} />
          <path d={`M${x0 + 80} -150V0M${x1 - 80} -150V0`} strokeWidth={4 * s} />
        </g>
      );
    case "chair":
      return (
        <g {...line} fill="none">
          <path d={`M${cx - 200} 0V-900H${cx + 200}V0M${cx - 200} -450H${cx + 200}`} stroke={tint ?? TIMBER} strokeWidth={50} />
        </g>
      );
    case "desk": case "table": case "dining_table":
      return (
        <g {...line}>
          <rect x={x0} y={-750} width={w} height={45} fill={tint ?? TIMBER} />
          <path d={`M${x0 + 50} -705V0M${x1 - 50} -705V0`} stroke={INK} strokeWidth={40} />
          {f.kind === "desk" && <rect x={x1 - Math.min(w * 0.4, 450)} y={-705} width={Math.min(w * 0.4, 450) - 30} height={500} fill={tint ?? TIMBER} />}
        </g>
      );
    case "nightstand":
      return (
        <g {...line}>
          <rect x={x0} y={-550} width={w} height={550} fill={tint ?? TIMBER} />
          <path d={`M${x0} -320H${x1}`} />
        </g>
      );
    case "lamp":
      return (
        <g {...line}>
          <path d={`M${cx} -1350V0M${cx - 160} 0H${cx + 160}`} stroke={INK} strokeWidth={30} />
          <path d={`M${cx - 200} -1350H${cx + 200}L${cx + 130} -1650H${cx - 130}Z`} fill="#f3c56b" />
        </g>
      );
    case "plant":
      return (
        <g {...line}>
          <path d={`M${cx - 180} -380H${cx + 180}L${cx + 130} 0H${cx - 130}Z`} fill="#8a5a3c" />
          <ellipse cx={cx} cy={-780} rx={Math.min(w, 700) / 2} ry={420} fill="#3f7a4a" />
        </g>
      );
    case "tv":
      return <rect x={x0} y={-1700} width={w} height={Math.min(w * 0.56, 800)} fill="#151618" {...line} />;
    case "fireplace":
      return (
        <g {...line}>
          <rect x={x0} y={-1150} width={w} height={1150} fill={tint ?? "#8d8a83"} />
          <path d={`M${cx - w * 0.3} 0V-650Q${cx} -820 ${cx + w * 0.3} -650V0Z`} fill="#1c1b19" />
        </g>
      );
    case "towel_radiator":
      return (
        <g {...line} fill="none">
          <path d={`M${x0 + 30} -1500V-300M${x1 - 30} -1500V-300`} strokeWidth={40} stroke={STEEL} />
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${x0 + 30} ${-400 - i * 140}H${x1 - 30}`} stroke={STEEL} strokeWidth={22} />)}
        </g>
      );
    default:
      // not identified yet: a dashed box at counter height with a question mark
      return (
        <g>
          <rect x={x0} y={-850} width={w} height={850} fill={tint ?? "#f4efe6"} fillOpacity={tint ? 0.8 : 0.12} stroke="#f4efe6" strokeOpacity={0.7} strokeWidth={s} strokeDasharray={`${6 * lw} ${4 * lw}`} />
          <text x={cx} y={-380} textAnchor="middle" fontSize={22 * lw} fontFamily="var(--font-display)" fontWeight={800} fill="#f4efe6" fillOpacity={0.7}>?</text>
        </g>
      );
  }
}
