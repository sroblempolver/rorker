"use client";
// "What's this job?" at the top of the drawing tool's side panel, and what that trade gets there: a short
// list for a kitchen or bath, wall and ceiling areas, trim and gallons for a painter, floor areas,
// doorways and baseboard for a flooring crew, each home counted for a property manager. Amounts only,
// never prices. The numbers come from lib/plan/quantities.ts; the trade's rules from lib/plan/trades.ts.
import type { Sketch } from "@/lib/plan/sketch";
import type { Nudge } from "@/lib/plan/checks";
import { TRADES, checklist, tick, tradeOf, type Trade } from "@/lib/plan/trades";
import { allSurfaces, doorways, fmtBaths, fmtGal, freeWalls, ft2, homeTotals, paintSum, withWaste, type RoomSurfaces } from "@/lib/plan/quantities";
import { std, useStandards } from "@/lib/plan/standards";
import { fmtLen, type Units } from "@/lib/plan/units";

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");
const area = (mm2: number, u: Units) => (u === "m" ? `${(mm2 / 1e6).toFixed(1)} m²` : `${n0(ft2(mm2))} ft²`);
const areaFt = (a: number, u: Units) => area(a * 92903.04, u);

export function TradePanel({ sk, fi, units, open, compact, onChange, onRoom, onStd }: {
  sk: Sketch; fi: number; units: Units;
  /** only the pick (something on the plan is picked, and its panel comes next) */
  compact?: boolean;
  /** the checks still to look at (for the kitchen and bath lists) */
  open: Nudge[];
  onChange: (s: Sketch) => void;
  /** pick a room on the plan */
  onRoom: (fi: number, i: number) => void;
  /** open a standard in Standards */
  onStd: (key: string) => void;
}) {
  useStandards();
  const trade = tradeOf(sk);
  const hint = TRADES.find((t) => t.id === trade)?.hint;
  return (
    <div className="space-y-2" aria-label="What's this job?">
      <div className="flex items-center gap-2">
        <label className="text-muted whitespace-nowrap" htmlFor="trade">What&apos;s this job?</label>
        <select id="trade" className="input !h-8 flex-1 min-w-0" value={trade} title={hint}
          onChange={(e) => onChange({ ...sk, trade: e.target.value === "house" ? undefined : e.target.value })}>
          {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      {compact ? null : <>
      {(trade === "kitchen" || trade === "bath") && <Checklist sk={sk} trade={trade} open={open} onChange={onChange} />}
      {trade === "paint" && <Surfaces sk={sk} fi={fi} units={units} onRoom={onRoom} onStd={onStd} />}
      {trade === "floor" && <Flooring sk={sk} fi={fi} units={units} onRoom={onRoom} onStd={onStd} />}
      {trade === "property" && <HomeTotals sk={sk} units={units} />}
      </>}
    </div>
  );
}

function Checklist({ sk, trade, open, onChange }: { sk: Sketch; trade: Trade; open: Nudge[]; onChange: (s: Sketch) => void }) {
  const steps = checklist(sk, trade, open) ?? [];
  const done = steps.filter((s) => s.done).length;
  return (
    <div className="rounded-[4px] border border-line p-2 space-y-1">
      <p className="eyebrow">{trade === "kitchen" ? "Kitchen" : "Bathroom"} · {done} of {steps.length}</p>
      <ul className="space-y-1">
        {steps.map((s) => {
          const ticked = (sk.trade_done ?? []).includes(s.id);
          // found on the drawing: ticks itself. Otherwise you tick it (or untick what you ticked).
          const can = !(s.done && s.auto && !ticked);
          return (
            <li key={s.id}>
              <button className="flex items-start gap-2 text-left w-full disabled:cursor-default" disabled={!can} onClick={() => onChange(tick(sk, s.id, !ticked))}
                title={s.auto ? (s.done && !ticked ? "Found on the drawing" : "Found on the drawing when it's there; click to tick it yourself") : "Tick it when it's done"}>
                <span aria-hidden className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${s.done ? "bg-accent border-accent text-ink" : "border-line"}`}>{s.done ? "✓" : ""}</span>
                <span className="min-w-0">
                  <span className={s.done ? "text-muted" : ""}>{s.label}</span>
                  {!s.done && <span className="block text-[12px] text-muted leading-snug">{s.hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ceil = () => std("house.ceiling");
const roomsOn = (list: RoomSurfaces[], fi: number) => list.filter((r) => r.fi === fi);

function Surfaces({ sk, fi, units, onRoom, onStd }: { sk: Sketch; fi: number; units: Units; onRoom: (fi: number, i: number) => void; onStd: (key: string) => void }) {
  const all = allSurfaces(sk, (f) => f.height_mm ?? ceil());
  const free = freeWalls(sk, (f) => f.height_mm ?? ceil());
  const here = roomsOn(all, fi), freeHere = free.filter((w) => w.fi === fi);
  const floor = paintSum(here, undefined, freeHere), job = paintSum(all, undefined, free);
  const coats = std("paint.coats"), cov = std("paint.coverage"), waste = std("paint.waste");
  const many = sk.floors.filter((f) => f.rooms.length).length > 1;
  return (
    <div className="space-y-2" aria-label="Surfaces">
      <p className="eyebrow">Surfaces · {sk.floors[fi]?.name || "This floor"}</p>
      {!here.length && !freeHere.length && <p className="text-muted">Draw a room and its walls, ceiling and trim show here.</p>}
      <ul className="space-y-1.5">
        {here.map((r) => (
          <li key={r.i}>
            <button className="text-left w-full rounded-[4px] border border-line px-2 py-1.5 hover:border-accent" onClick={() => onRoom(r.fi, r.i)} title="Pick this room on the plan">
              <span className="flex justify-between gap-2"><span className="truncate">{r.name}</span><span className="text-muted whitespace-nowrap">{fmtLen(r.height, units)} high</span></span>
              <span className="block text-[12px] text-muted font-mono">Walls {area(r.wall, units)} · Ceiling {area(r.ceiling, units)}</span>
              <span className="block text-[12px] text-muted font-mono">Base {fmtLen(r.baseboard, units)} · Casing {fmtLen(r.doorCasing + r.windowCasing, units)}</span>
            </button>
          </li>
        ))}
        {freeHere.map((w) => (
          <li key={`w${w.k}`} className="rounded-[4px] border border-line px-2 py-1.5">
            <span className="flex justify-between gap-2"><span>{w.half ? "Half wall" : "Wall on its own"}</span><span className="text-muted whitespace-nowrap">{fmtLen(w.length, units)} long</span></span>
            <span className="block text-[12px] text-muted font-mono">Both sides {area(w.area, units)} · {fmtLen(w.height, units)} high</span>
          </li>
        ))}
      </ul>
      <Totals title={many ? "This floor" : "In total"} rows={paintRows(floor, units)} />
      {many && <Totals title="The whole job" rows={paintRows(job, units)} />}
      <p className="text-[12px] text-muted leading-snug">
        Walls less doors and windows. <button className="underline" onClick={() => onStd("paint.coats")}>{coats} {coats === 1 ? "coat" : "coats"}</button> at{" "}
        <button className="underline" onClick={() => onStd("paint.coverage")}>{cov} ft² a gallon</button>, <button className="underline" onClick={() => onStd("paint.waste")}>{waste}% extra</button>.
      </p>
    </div>
  );
}
const paintRows = (p: ReturnType<typeof paintSum>, u: Units): [string, string][] => [
  ["Walls", `${areaFt(p.wall_ft2, u)} · ${fmtGal(p.wallGal)}`],
  ["Ceilings", `${areaFt(p.ceiling_ft2, u)} · ${fmtGal(p.ceilingGal)}`],
  ["Baseboard", fmtLen(p.baseboard, u)],
  ["Door and window casing", fmtLen(p.casing, u)],
];

function Totals({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-[4px] bg-panel border border-line p-2">
      <p className="eyebrow mb-1">{title}</p>
      <dl className="space-y-0.5">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="font-mono text-right">{v}</dd></div>)}</dl>
    </div>
  );
}

function Flooring({ sk, fi, units, onRoom, onStd }: { sk: Sketch; fi: number; units: Units; onRoom: (fi: number, i: number) => void; onStd: (key: string) => void }) {
  const all = allSurfaces(sk, (f) => f.height_mm ?? ceil());
  const here = roomsOn(all, fi);
  const waste = std("flooring.waste");
  const ways = doorways(sk);
  const many = sk.floors.filter((f) => f.rooms.length).length > 1;
  const sum = (rs: RoomSurfaces[], ws: typeof ways): [string, string][] => {
    const a = ft2(rs.reduce((n, r) => n + r.floor, 0));
    const widths = new Map<string, number>();
    for (const w of ws) { const k = fmtLen(w.width, units); widths.set(k, (widths.get(k) ?? 0) + 1); }
    return [
      ["Floor", areaFt(a, units)],
      [`To order (${waste}% extra)`, areaFt(withWaste(a, waste), units)],
      ["Baseboard", fmtLen(rs.reduce((n, r) => n + r.baseboard, 0), units)],
      [`Doorways · ${ws.length}`, [...widths].map(([k, c]) => `${c} × ${k}`).join(", ") || "none"],
    ];
  };
  const out = ways.filter((w) => w.fi === fi && w.outside).length;
  return (
    <div className="space-y-2" aria-label="Flooring">
      <p className="eyebrow">Flooring · {sk.floors[fi]?.name || "This floor"}</p>
      {!here.length && <p className="text-muted">Draw a room and its floor area shows here.</p>}
      <ul className="space-y-1.5">
        {here.map((r) => {
          const d = ways.filter((w) => w.fi === fi && w.rooms.some((n) => n.trim().toLowerCase() === r.name.trim().toLowerCase()));
          return (
            <li key={r.i}>
              <button className="text-left w-full rounded-[4px] border border-line px-2 py-1.5 hover:border-accent" onClick={() => onRoom(r.fi, r.i)} title="Pick this room on the plan">
                <span className="flex justify-between gap-2"><span className="truncate">{r.name}</span><span className="font-mono whitespace-nowrap">{area(r.floor, units)}</span></span>
                <span className="block text-[12px] text-muted font-mono">Order {areaFt(withWaste(ft2(r.floor), waste), units)} · Base {fmtLen(r.baseboard, units)}</span>
                {d.length > 0 && <span className="block text-[12px] text-muted">{d.length} {d.length === 1 ? "doorway" : "doorways"}: {d.map((w) => fmtLen(w.width, units)).join(", ")}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <Totals title={many ? "This floor" : "In total"} rows={sum(here, ways.filter((w) => w.fi === fi))} />
      {many && <Totals title="The whole job" rows={sum(all, ways)} />}
      <p className="text-[12px] text-muted leading-snug">
        Each doorway gets a transition strip{out ? `, ${out} of them a threshold to the outside` : ""}. Baseboard is the walls less the door widths.{" "}
        <button className="underline" onClick={() => onStd("flooring.waste")}>Change the extra</button>.
      </p>
    </div>
  );
}

function HomeTotals({ sk, units }: { sk: Sketch; units: Units }) {
  const homes = homeTotals(sk);
  if (!homes.some((h) => h.rooms)) return <p className="text-muted">Draw the rooms and each home is counted here.</p>;
  const row = (h: (typeof homes)[number]) => `${h.rooms} rooms · ${areaFt(h.area_ft2, units)} · ${h.bedrooms} bed · ${fmtBaths(h.bathrooms, h.halfBaths)}${h.floors > 1 ? ` · ${h.floors} floors` : ""}`;
  const all = homes.reduce((a, h) => ({ ...a, rooms: a.rooms + h.rooms, area_ft2: a.area_ft2 + h.area_ft2, bedrooms: a.bedrooms + h.bedrooms, bathrooms: a.bathrooms + h.bathrooms, halfBaths: a.halfBaths + h.halfBaths }), { name: "", rooms: 0, area_ft2: 0, bedrooms: 0, bathrooms: 0, halfBaths: 0, floors: 1 });
  return (
    <div className="rounded-[4px] border border-line p-2 space-y-1" aria-label="Homes counted">
      <p className="eyebrow">{homes.length > 1 ? `${homes.length} homes` : "The home"}</p>
      <ul className="space-y-1">{homes.map((h) => <li key={h.name}><span>{h.name}</span><span className="block text-[12px] text-muted">{row(h)}</span></li>)}</ul>
      {homes.length > 1 && <p className="text-[12px] pt-1 border-t border-line">Building: {row(all)}</p>}
    </div>
  );
}
