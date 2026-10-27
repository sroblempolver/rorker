// Front elevations of the things that stand against a wall: what you would see facing that wall.
// Shapes are generic per kind and drawn to the fixture's real width; heights are typical values.
import { bottomOf, CATALOG, drawnAs, partsOf, topOf, typicalHeight, type Part } from "@/lib/plan/catalog";
import type { Fixture } from "@/lib/plan/types";

const INK = "#1b1a17";
const BODY = "#f4efe6";   // sanitary white / painted carcass
const TIMBER = "#a07850";
const STEEL = "#b9bec4";
const FABRIC = "#6f7486";

/** Typical height in mm, from the catalogue of real objects. */
export const fixtureHeight = typicalHeight;

/** Top-view fill per kind: the object's real colour, so the plan reads like a model from above. */
export const TOP_FILL: Record<string, string> = { filler: "#5b5750", ...Object.fromEntries(Object.entries(CATALOG).map(([k, s]) => [k, s.fill])) };

export const HIDDEN_KINDS = new Set(["door_leaf", "part"]);

export const fixtureBottom = (f: Fixture) => bottomOf(f);
export const fixtureTop = (f: Fixture) => topOf(f);
/** Mounted up on the wall (wall cabinets, hoods): dashed in the top view, under-counter clear. */
export const isWallMounted = (f: Fixture) => fixtureBottom(f) >= 1000;

const CARCASS = "#e4dccb";
const WORKTOP = "#4a4844";

/** A kitchen cabinet or appliance from the front, from its real height, mount height and front. */
function Cabinet({ f, x0, x1, lw, tint }: { f: Fixture; x0: number; x1: number; lw: number; tint?: string | null }) {
  const w = x1 - x0, cx = x0 + w / 2;
  const b = -fixtureBottom(f), t = -fixtureTop(f);
  const s = 1.2 * lw;
  const line = { stroke: INK, strokeWidth: s, strokeLinejoin: "round" as const };
  const floor = b === 0;
  const kick = floor && f.kind !== "fridge" ? 100 : 0;
  const top = floor && ["base_cabinet", "kitchen_sink", "dishwasher", "filler"].includes(f.kind) ? 38 : 0;
  const body = tint ?? (["dishwasher", "range", "fridge", "range_hood"].includes(f.kind) ? STEEL : CARCASS);
  const fy0 = t + top, fy1 = b - kick; // the front face
  const handle = (x: number, y0: number, y1: number) => <path d={`M${x} ${y0}V${y1}`} stroke="#6d6a63" strokeWidth={Math.max(18, 2 * lw)} strokeLinecap="round" />;
  const hbar = (y: number, xa: number, xb: number) => <path d={`M${xa} ${y}H${xb}`} stroke="#6d6a63" strokeWidth={Math.max(18, 2 * lw)} strokeLinecap="round" />;
  let front: React.ReactNode = null;
  switch (f.kind === "base_cabinet" || f.kind === "wall_cabinet" || f.kind === "kitchen_sink" ? f.front ?? "doors" : f.kind) {
    case "doors": case "sink": {
      const n = w > 460 ? 2 : 1;
      front = (
        <>
          {f.front === "sink" && <rect x={x0 + 20} y={fy0 + 20} width={w - 40} height={120} fill="none" {...line} strokeOpacity={0.6} />}
          {Array.from({ length: n }, (_, i) => {
            const dx0 = x0 + (w / n) * i + 12, dw = w / n - 24, dy0 = fy0 + (f.front === "sink" ? 160 : 14), dh = fy1 - dy0 - 14;
            const hx = n === 2 ? (i === 0 ? dx0 + dw - 50 : dx0 + 50) : dx0 + dw - 50;
            return <g key={i}><rect x={dx0} y={dy0} width={dw} height={dh} fill="none" {...line} strokeOpacity={0.7} />{handle(hx, floor ? dy0 + 60 : dy0 + dh - 200, floor ? dy0 + 200 : dy0 + dh - 60)}</g>;
          })}
        </>
      );
      break;
    }
    case "door": {
      const dx0 = x0 + 12, dw = w - 24, dy0 = fy0 + 14, dh = fy1 - dy0 - 14;
      front = <><rect x={dx0} y={dy0} width={dw} height={dh} fill="none" {...line} strokeOpacity={0.7} />{handle(dx0 + dw - 45, floor ? dy0 + 60 : dy0 + dh - 200, floor ? dy0 + 200 : dy0 + dh - 60)}</>;
      break;
    }
    case "drawers": {
      const hs = [0.22, 0.36, 0.42];
      let y = fy0 + 10;
      front = hs.map((k, i) => {
        const h = (fy1 - fy0 - 20) * k;
        const el = <g key={i}><rect x={x0 + 12} y={y} width={w - 24} height={h - 10} fill="none" {...line} strokeOpacity={0.7} />{hbar(y + Math.min(80, h / 3), cx - Math.min(150, w * 0.25), cx + Math.min(150, w * 0.25))}</g>;
        y += h;
        return el;
      });
      break;
    }
    case "blind_corner": case "lazy_susan":
      front = <><rect x={x0 + 12} y={fy0 + 14} width={w * 0.45} height={fy1 - fy0 - 28} fill="#d3cab8" {...line} strokeOpacity={0.5} /><rect x={x0 + w * 0.48} y={fy0 + 14} width={w * 0.5} height={fy1 - fy0 - 28} fill="none" {...line} strokeOpacity={0.7} /></>;
      break;
    case "panel": case "filler":
      front = null;
      break;
    case "dishwasher":
      front = <><rect x={x0 + 12} y={fy0 + 10} width={w - 24} height={110} fill="#2a2b2e" />{hbar(fy0 + 170, x0 + 80, x1 - 80)}</>;
      break;
    case "range":
      front = (
        <>
          <rect x={x0 - 10} y={t - 20} width={w + 20} height={60} fill="#1f2022" />
          {Array.from({ length: 4 }, (_, i) => <circle key={i} cx={x0 + (w / 5) * (i + 1)} cy={t + 90} r={22} fill={INK} />)}
          <rect x={x0 + 50} y={t + 180} width={w - 100} height={(fy1 - t) * 0.62} rx={20} fill="#2a2a2c" />
          {hbar(t + 150, x0 + 70, x1 - 70)}
        </>
      );
      break;
    case "fridge":
      front = <><path d={`M${x0} ${t + (b - t) * 0.36}H${x1}`} {...line} />{handle(x1 - 70, t + 120, t + (b - t) * 0.3)}{handle(x1 - 70, t + (b - t) * 0.42, t + (b - t) * 0.7)}</>;
      break;
    case "range_hood":
      return (
        <g {...line}>
          <rect x={cx - w * 0.14} y={t} width={w * 0.28} height={(b - t) * 0.6} fill={body} />
          <path d={`M${x0} ${b}H${x1}L${x1 - w * 0.12} ${t + (b - t) * 0.55}H${x0 + w * 0.12}Z`} fill={body} />
        </g>
      );
  }
  return (
    <g {...line}>
      <rect x={x0} y={t + top} width={w} height={b - t - top - kick} fill={body} />
      {kick > 0 && <rect x={x0 + 50} y={b - kick} width={w - 100} height={kick} fill="#3b3a37" />}
      {top > 0 && <rect x={x0 - 15} y={t} width={w + 30} height={top} fill={WORKTOP} />}
      {front}
    </g>
  );
}

const CABINET_KINDS = new Set(["base_cabinet", "wall_cabinet", "kitchen_sink", "dishwasher", "range", "fridge", "range_hood", "filler"]);

/** Drawn at their own fixed height on the wall, not lifted. */
const ABSOLUTE = new Set(["wall_cabinet", "range_hood"]);

type ElevProps = { f: Fixture; x0: number; x1: number; lw: number; tint?: string | null };

export function FixtureElevation(p: ElevProps) {
  const { f } = p;
  if (HIDDEN_KINDS.has(f.kind)) return null;
  if (CABINET_KINDS.has(f.kind) && (f.height_mm || f.front)) return <Cabinet {...p} />;
  // things on a desk or a wall are drawn from their own bottom, then lifted to where they are
  const lift = ABSOLUTE.has(f.kind) ? 0 : fixtureBottom(f);
  const h = f.height_mm ?? fixtureHeight(f.kind);
  const own = f.parts?.length ? f.parts : partsOf(f.kind, Math.max(p.x1 - p.x0, 50), CATALOG[f.kind]?.d ?? 500, h);
  const shape = own ? <Parts {...p} parts={own} /> : <Shape {...p} f={drawnAs(f.kind) === f.kind ? f : { ...f, kind: drawnAs(f.kind) }} />;
  return lift ? <g transform={`translate(0 ${-lift})`}>{shape}</g> : shape;
}

/** Something built from parts, seen from the front: each part's front face. */
function Parts({ x0, x1, lw, tint, parts: all }: ElevProps & { parts: Part[] }) {
  const cx = (x0 + x1) / 2;
  const parts = [...all].sort((a, b) => a.z - a.d / 2 - (b.z - b.d / 2)); // back first
  return (
    <g stroke={INK} strokeWidth={1.2 * lw} strokeLinejoin="round">
      {parts.map((q, i) => q.shape === "box"
        ? <rect key={i} x={cx + q.x - q.w / 2} y={-q.y - q.h} width={q.w} height={q.h} fill={tint ?? q.color ?? BODY} />
        : <ellipse key={i} cx={cx + q.x} cy={-q.y - q.h / 2} rx={q.w / 2} ry={q.h / 2} fill={tint ?? q.color ?? BODY} />)}
    </g>
  );
}

function Shape({ f, x0, x1, lw, tint }: ElevProps) {
  const w = Math.max(x1 - x0, 200);
  const cx = x0 + w / 2;
  const s = 1.2 * lw;
  const body = tint ?? BODY;
  const line = { stroke: INK, strokeWidth: s, strokeLinejoin: "round" as const };
  const h = f.height_mm ?? fixtureHeight(f.kind);
  const dark = tint ?? "#232426";
  switch (f.kind) {
    case "computer": {
      const mw = Math.min(w * 0.7, 620), mh = Math.min(h, 460) * 0.78;
      return (
        <g {...line}>
          <rect x={cx - 25 - mw * 0.1} y={-mh * 0.32} width={50} height={mh * 0.32} fill={STEEL} />
          <rect x={cx - mw / 2 - mw * 0.1} y={-h} width={mw} height={mh * 0.75} rx={12} fill={dark} />
          <rect x={cx - mw / 2 - mw * 0.1 + 18} y={-h + 18} width={mw - 36} height={mh * 0.75 - 36} fill="#3a6ea5" fillOpacity={0.55} />
          <rect x={cx - mw * 0.45} y={-22} width={mw * 0.7} height={22} rx={6} fill="#3b3c40" />
          <rect x={x1 - Math.min(200, w * 0.22)} y={-h * 0.95} width={Math.min(190, w * 0.2)} height={h * 0.95} rx={8} fill={dark} />
          <circle cx={x1 - Math.min(200, w * 0.22) + Math.min(95, w * 0.1)} cy={-h * 0.85} r={10} fill="#55b2ff" />
        </g>
      );
    }
    case "monitor": case "tv": {
      const screenH = f.kind === "tv" ? Math.min(h, w * 0.58) : h * 0.72;
      const stand = f.kind === "monitor" || fixtureBottom(f) < 1000;
      return (
        <g {...line}>
          {stand && <><rect x={cx - 25} y={-(h - screenH)} width={50} height={h - screenH} fill={STEEL} /><rect x={cx - w * 0.18} y={-14} width={w * 0.36} height={14} rx={6} fill={STEEL} /></>}
          <rect x={x0} y={-h} width={w} height={screenH} rx={10} fill={dark} />
          <rect x={x0 + 14} y={-h + 14} width={w - 28} height={screenH - 40} fill="#3a6ea5" fillOpacity={0.4} />
        </g>
      );
    }
    case "laptop":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h - 20} rx={8} fill="#9da3aa" /><rect x={x0 + 14} y={-h + 14} width={w - 28} height={h - 54} fill="#3a6ea5" fillOpacity={0.5} /><rect x={x0 - 20} y={-20} width={w + 40} height={20} rx={6} fill="#9da3aa" /></g>;
    case "printer":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} rx={14} fill={tint ?? "#e6e1d6"} /><rect x={x0 + w * 0.15} y={-h * 0.55} width={w * 0.7} height={h * 0.12} fill="#3b3c40" /><rect x={x0 + w * 0.2} y={-h - 60} width={w * 0.6} height={60} fill="#fff" /></g>;
    case "microwave":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} rx={12} fill={tint ?? STEEL} /><rect x={x0 + 20} y={-h + 25} width={w * 0.68} height={h - 50} rx={8} fill="#1d1e21" /><rect x={x1 - w * 0.22} y={-h + 30} width={w * 0.16} height={h * 0.3} fill="#2a2b2e" /></g>;
    case "coffee_machine":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} rx={14} fill={dark} /><rect x={x0 + w * 0.2} y={-h * 0.62} width={w * 0.6} height={h * 0.38} fill="#111" /><rect x={cx - 40} y={-h * 0.3} width={80} height={h * 0.25} rx={10} fill="#f4efe6" /></g>;
    case "kettle":
      return <g {...line}><path d={`M${x0 + w * 0.1} 0H${x1 - w * 0.2}L${x1 - w * 0.3} ${-h}H${x0 + w * 0.2}Z`} fill={tint ?? STEEL} /><path d={`M${x1 - w * 0.25} ${-h * 0.85}Q${x1} ${-h * 0.6} ${x1 - w * 0.2} ${-h * 0.2}`} fill="none" strokeWidth={4 * s} /></g>;
    case "toaster":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} rx={40} fill={tint ?? STEEL} /><path d={`M${x0 + w * 0.3} ${-h}V${-h + 12}M${x1 - w * 0.3} ${-h}V${-h + 12}`} strokeWidth={4 * s} /></g>;
    case "bar_stool":
      return <g {...line}><ellipse cx={cx} cy={-h + 30} rx={w * 0.45} ry={30} fill={tint ?? TIMBER} /><path d={`M${cx - w * 0.3} 0L${cx - w * 0.2} ${-h + 40}M${cx + w * 0.3} 0L${cx + w * 0.2} ${-h + 40}M${cx - w * 0.27} ${-h * 0.35}H${cx + w * 0.27}`} stroke={INK} strokeWidth={30} /></g>;
    case "office_chair":
      return (
        <g {...line}>
          <rect x={cx - w * 0.32} y={-h} width={w * 0.64} height={h * 0.45} rx={60} fill={dark} />
          <rect x={cx - w * 0.4} y={-h * 0.5} width={w * 0.8} height={90} rx={40} fill={dark} />
          <path d={`M${cx} ${-h * 0.42}V-80M${x0 + 40} -40L${cx} -80L${x1 - 40} -40`} stroke={INK} strokeWidth={30} fill="none" />
          <circle cx={x0 + 40} cy={-25} r={25} fill={INK} /><circle cx={x1 - 40} cy={-25} r={25} fill={INK} />
        </g>
      );
    case "mirror":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} rx={20} fill="#8fd3f0" fillOpacity={0.45} /><path d={`M${x0 + w * 0.2} ${-h * 0.2}L${x0 + w * 0.5} ${-h * 0.8}`} stroke="#fff" strokeOpacity={0.6} /></g>;
    case "picture":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} fill={tint ?? "#c9a46a"} /><rect x={x0 + 40} y={-h + 40} width={w - 80} height={h - 80} fill="#5d7f9e" /><path d={`M${x0 + 40} -40L${cx} ${-h * 0.6}L${x1 - 40} -40Z`} fill="#3f7a4a" /></g>;
    case "wall_shelf":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} fill={tint ?? TIMBER} /><rect x={x0 + w * 0.1} y={-h - 220} width={w * 0.25} height={220} fill="#7d6a8a" /><rect x={x0 + w * 0.6} y={-h - 160} width={w * 0.12} height={160} fill="#3f7a4a" /></g>;
    case "dresser": case "filing_cabinet": {
      const n = f.kind === "dresser" ? 3 : Math.max(2, Math.round(h / 300));
      return (
        <g {...line}>
          <rect x={x0} y={-h} width={w} height={h} fill={tint ?? (f.kind === "dresser" ? TIMBER : "#7d8187")} />
          {Array.from({ length: n }, (_, i) => { const y = -h + 30 + ((h - 60) / n) * i; return <g key={i}><rect x={x0 + 25} y={y} width={w - 50} height={(h - 60) / n - 20} fill="none" strokeOpacity={0.7} /><path d={`M${cx - 70} ${y + 50}H${cx + 70}`} stroke="#6d6a63" strokeWidth={20} strokeLinecap="round" /></g>; })}
        </g>
      );
    }
    case "crib":
      return <g {...line} fill="none"><rect x={x0} y={-h} width={w} height={h - 150} stroke={tint ?? "#d9d2c4"} strokeWidth={30} />{Array.from({ length: Math.max(3, Math.round(w / 90)) }, (_, i) => <path key={i} d={`M${x0 + (w / Math.max(3, Math.round(w / 90))) * i} ${-h}V-150`} stroke={tint ?? "#d9d2c4"} strokeWidth={16} />)}<path d={`M${x0} 0V-150M${x1} 0V-150`} stroke={INK} strokeWidth={30} /></g>;
    case "coffee_table":
      return <g {...line}><rect x={x0} y={-h} width={w} height={45} fill={tint ?? TIMBER} /><path d={`M${x0 + 50} ${-h + 45}V0M${x1 - 50} ${-h + 45}V0`} stroke={INK} strokeWidth={40} /></g>;
    case "table_lamp":
      return <g {...line}><path d={`M${cx - w * 0.3} 0H${cx + w * 0.3}M${cx} 0V${-h * 0.55}`} stroke={INK} strokeWidth={24} /><path d={`M${cx - w * 0.5} ${-h * 0.55}H${cx + w * 0.5}L${cx + w * 0.32} ${-h}H${cx - w * 0.32}Z`} fill="#f3c56b" /></g>;
    case "piano":
      return <g {...line}><rect x={x0} y={-h} width={w} height={h} fill={tint ?? "#151618"} /><rect x={x0 + 60} y={-h * 0.58} width={w - 120} height={70} fill="#fff" />{Array.from({ length: Math.round((w - 120) / 60) }, (_, i) => <path key={i} d={`M${x0 + 60 + i * 60} ${-h * 0.58}V${-h * 0.58 + 70}`} strokeWidth={lw} />)}</g>;
    case "rug":
      return <rect x={x0} y={-Math.max(h, 10)} width={w} height={Math.max(h, 10)} fill={tint ?? "#7a5a4a"} {...line} />;
    case "treadmill":
      return <g {...line}><rect x={x0} y={-180} width={w} height={180} rx={20} fill={dark} /><path d={`M${x0 + 60} -180V${-h}M${x1 - 60} -180V${-h}`} stroke={INK} strokeWidth={40} /><rect x={x0 + 20} y={-h - 40} width={w - 40} height={160} rx={20} fill={dark} /></g>;
    case "ceiling_fan": case "pendant_light":
      return f.kind === "ceiling_fan"
        ? <g {...line}><path d={`M${cx} ${-h}V${-h * 0.4}`} stroke={INK} strokeWidth={30} /><rect x={x0} y={-h * 0.4} width={w} height={40} rx={20} fill={tint ?? "#d9d2c4"} /><ellipse cx={cx} cy={-h * 0.25} rx={120} ry={80} fill="#f3c56b" /></g>
        : <g {...line}><path d={`M${cx} ${-h}V${-h * 0.5}`} stroke={INK} strokeWidth={14} /><path d={`M${cx - w / 2} 0Q${cx} ${-h * 0.75} ${cx + w / 2} 0Z`} fill="#f3c56b" /></g>;
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
