"use client";
// The Cabinets tool's side panel (kept simple, like KCD): pick a cabinet by its code and click near a
// wall, or fill a whole wall in one click. Below it the cabinet list for the floor (codes, counts, trim
// and countertop). CabinetEdit is the panel for a picked cabinet: code, family, fronts, hinge, its exact
// width, height and depth in feet and inches, and trim. Sizes start at the company's standards.
import { useState } from "react";
import type { SketchFixture, SketchFloor } from "@/lib/plan/sketch";
import { FAMILIES, FRONTS, bottomFor, cabCode, cabinetList, defaultConfig, defaults, famOf, frontsOf, isStock, newSpec, snapWidth, type CabFamily } from "@/lib/plan/cabinets";
import { PANEL_GROUPS, plainOf, resized, type CabPick } from "@/lib/plan/cabinetLayout";
import { INCH, fmtLen, parseLength, roundLen, type Units } from "@/lib/plan/units";
import { std, useStandards } from "@/lib/plan/standards";

const two = (n: number) => `${n < 10 ? "0" : ""}${n}`.replace(".75", "¾");
const chip = (on: boolean) => `chip !h-7 ${on ? "!text-accent !border-accent" : ""}`;

export function CabinetPanel({ pick, onPick, floor, units }: { pick: CabPick; onPick: (p: CabPick) => void; floor: SketchFloor; units: Units }) {
  useStandards();
  const [group, setGroup] = useState(() => PANEL_GROUPS.find((g) => g.items.some((i) => i.id === pick.item))?.group ?? "Base");
  const g = PANEL_GROUPS.find((x) => x.group === group) ?? PANEL_GROUPS[0];
  const plain = plainOf(pick.item);
  const F = plain ? null : famOf(pick.item);
  const set = (ch: Partial<CabPick>) => onPick({ ...pick, ...ch });
  const choose = (id: string) => onPick({ ...pick, item: id, w: undefined, h: undefined, config: undefined, mode: "place" });
  const def = F ? defaults(F.id) : null;
  const w = pick.w ?? (plain ? plain.size().w : def!.w), h = pick.h ?? def?.h ?? 0;
  const spec = F ? { ...newSpec(F.id, w), config: pick.config ?? defaultConfig(F.id, w) } : null;
  const single = spec && F && frontsOf({ ...spec, hinge: "L" }, w, h).filter((x) => x.t === "door" || x.t === "glass" || x.t === "mirror" || x.t === "blind").length === 1;
  const list = cabinetList(floor.fixtures ?? []);
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button className={`btn btn-sm flex-1 ${pick.mode === "place" ? "btn-primary" : "btn-ghost"}`} onClick={() => set({ mode: "place" })}>Put one in</button>
        <button className={`btn btn-sm flex-1 ${pick.mode === "fill" ? "btn-primary" : "btn-ghost"}`} onClick={() => set({ mode: "fill" })}>Fill a wall</button>
      </div>
      {pick.mode === "fill" ? (
        <div className="space-y-2">
          <p className="leading-snug">Click near a wall of the kitchen. It fills the wall from corner to corner with stock cabinets, leaves doors, windows and appliances clear, puts a sink base under the window and fillers at the walls.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={pick.fillBase} onChange={(e) => set({ fillBase: e.target.checked })} /> Base cabinets</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={pick.fillWall} onChange={(e) => set({ fillWall: e.target.checked })} /> Wall cabinets above (none over a window or the range)</label>
          <p className="text-muted text-[12.5px] leading-snug">Put the range, dishwasher and fridge in first (Appliances), and the fill works around them. Filling again replaces that wall&apos;s base and wall cabinets.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">{PANEL_GROUPS.map((x) => <button key={x.group} className={chip(group === x.group)} onClick={() => { setGroup(x.group); choose(x.items[0].id); }}>{x.group}</button>)}</div>
          <div className="flex flex-wrap gap-1">{g.items.map((it) => <button key={it.id} className={chip(pick.item === it.id)} onClick={() => choose(it.id)}>{it.label}</button>)}</div>
          {F && F.widths.length > 1 && (
            <div>
              <p className="label !mb-1">Width</p>
              <div className="flex flex-wrap gap-1">{F.widths.map((x) => {
                const mm = x * INCH;
                return <button key={x} className={`${chip(Math.abs(mm - w) < 2)} font-mono`} onClick={() => set({ w: mm, config: undefined })}>{cabCode({ ...spec!, config: pick.config ?? defaultConfig(F.id, mm) }, mm, def!.d, h)}</button>;
              })}</div>
            </div>
          )}
          {F?.heights && F.heights.length > 1 && (
            <div>
              <p className="label !mb-1">Height</p>
              <div className="flex flex-wrap gap-1">{F.heights.map((x) => <button key={x} className={chip(Math.abs(x * INCH - h) < 2)} onClick={() => set({ h: x * INCH })}>{x}&quot;</button>)}</div>
            </div>
          )}
          {plain && plain.widths.length > 1 && (
            <div className="flex flex-wrap gap-1">{plain.widths.map((x) => <button key={x} className={chip(Math.abs(x * INCH - w) < 2)} onClick={() => set({ w: x * INCH })}>{x}&quot;</button>)}</div>
          )}
          {F && F.configs.length > 1 && (
            <select className="input !h-9" aria-label="Doors and drawers" value={spec!.config} onChange={(e) => set({ config: e.target.value })}>
              {F.configs.map((c) => <option key={c} value={c}>{FRONTS[c]}</option>)}
            </select>
          )}
          {single && (
            <div className="flex items-center gap-1.5"><span className="text-muted">{F!.id.includes("blind") ? "Blind side" : "Hinge"}</span>
              {(["L", "R"] as const).map((s) => <button key={s} className={chip((pick.hinge ?? "L") === s)} onClick={() => set({ hinge: s })}>{s === "L" ? "Left" : "Right"}</button>)}</div>
          )}
          <p className="text-muted text-[12.5px] leading-snug">
            {F ? `${fmtLen(w, units)} wide, ${fmtLen(def!.d, units)} deep, ${fmtLen(h, units)} high${F.zone === "wall" ? `, bottom ${fmtLen(bottomFor(F.id, h), units)} off the floor` : ""}. ` : `${fmtLen(w, units)} wide. `}
            Click near a wall: it backs onto the wall and lines up with the cabinets beside it. Pick it after to type an exact size.
          </p>
        </div>
      )}
      {list.items.length > 0 && (
        <div className="pt-2 border-t border-line space-y-1">
          <p className="eyebrow pt-1">Cabinet list</p>
          {list.items.map((it) => (
            <div key={it.code} className="flex items-center gap-2 text-[13px]">
              <span className="font-mono w-24">{it.code}</span><span className="text-muted flex-1 truncate">{it.label}{it.custom ? " (custom size)" : ""}</span><span>{it.count}</span>
            </div>
          ))}
          <p className="text-muted text-[12.5px] leading-snug pt-1">
            {[list.counterSqft > 0 && `Countertop ${list.counterSqft.toFixed(1)} ft²`, list.kick > 0 && `toe kick ${fmtLen(list.kick, units)}`, list.crown > 0 && `crown ${fmtLen(list.crown, units)}`, list.rail > 0 && `light rail ${fmtLen(list.rail, units)}`].filter(Boolean).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

/** The panel for a picked cabinet. `onChange` saves the change (with undo). */
export function CabinetEdit({ fx, units, onChange, onDelete }: { fx: SketchFixture; units: Units; onChange: (f: SketchFixture) => void; onDelete: () => void }) {
  useStandards();
  const c = fx.cab!, F = famOf(c.fam), def = defaults(c.fam);
  const w = fx.width_mm ?? def.w, d = fx.depth_mm ?? def.d, h = fx.height_mm ?? def.h;
  const code = cabCode(c, w, d, h), stock = isStock(c.fam, w, d, h);
  const name = (x: SketchFixture) => ({ ...x, name: `${cabCode(x.cab!, x.width_mm ?? w, x.depth_mm ?? d, x.height_mm ?? h)} ${famOf(x.cab!.fam).label.toLowerCase()}` });
  const save = (x: SketchFixture) => onChange(name(x));
  const setCab = (ch: Partial<typeof c>) => save({ ...fx, cab: { ...c, ...ch } });
  const setW = (v: number) => { const nw = F.id.startsWith("filler") ? v : snapWidth(c.fam, v); save(resized(fx, { w: nw })); };
  const setH = (v: number) => {
    // a wall cabinet that sat at its usual height keeps its top lined up
    const z = F.zone === "wall" && Math.abs((fx.elevation_mm ?? 0) - bottomFor(c.fam, h)) < 2 ? { elevation_mm: Math.round(bottomFor(c.fam, v)) } : {};
    save({ ...resized(fx, { h: v }), ...z });
  };
  const setFam = (fam: CabFamily) => {
    const G = famOf(fam), nd = defaults(fam), nw = G.widths.some((x) => Math.abs(x * INCH - w) < 2) ? w : nd.w;
    const spec = newSpec(fam, nw);
    const moved = resized(fx, { w: nw, d: nd.d, h: nd.h });
    save({ ...moved, kind: G.kind, cab: spec, elevation_mm: nd.z || undefined });
  };
  const single = frontsOf({ ...c, hinge: "L" }, w, h).filter((x) => x.t === "door" || x.t === "glass" || x.t === "mirror" || x.t === "blind").length === 1;
  const zone = F.zone;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="font-mono text-[18px] leading-none">{code}</p>
        <span className="text-muted">{F.label}</span>
        {!stock && <span className="chip !h-6 !text-amber !border-amber ml-auto" title="Not a stock size: it will be made to order or cut down">Custom size</span>}
      </div>
      <select className="input !h-9" aria-label="Kind of cabinet" value={c.fam} onChange={(e) => setFam(e.target.value as CabFamily)}>
        {FAMILIES.filter((x) => x.zone === zone || (zone !== "wall" && x.zone !== "wall")).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      {F.configs.length > 1 && (
        <select className="input !h-9" aria-label="Doors and drawers" value={c.config ?? defaultConfig(c.fam, w)} onChange={(e) => setCab({ config: e.target.value })}>
          {F.configs.map((k) => <option key={k} value={k}>{FRONTS[k]}</option>)}
        </select>
      )}
      {single && (
        <div className="flex items-center gap-1.5"><span className="text-muted">{F.id.includes("blind") ? "Blind side" : "Hinge"}</span>
          {(["L", "R"] as const).map((s) => <button key={s} className={chip((c.hinge ?? "L") === s)} onClick={() => setCab({ hinge: s })}>{s === "L" ? "Left" : "Right"}</button>)}</div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Len label="Width" mm={w} units={units} onSet={(v) => v >= 10 && setW(v)} />
        <Len label="Height" mm={h} units={units} onSet={(v) => v >= 50 && setH(v)} />
        <Len label="Depth" mm={d} units={units} onSet={(v) => v >= 10 && save(resized(fx, { d: v }))} />
      </div>
      {F.widths.length > 1 && (
        <select className="input !h-9" aria-label="Stock widths" value="" onChange={(e) => setW(+e.target.value * INCH)}>
          <option value="" disabled>Stock widths: {F.widths.map(two).join(", ")}</option>
          {F.widths.map((x) => <option key={x} value={x}>{cabCode(c, x * INCH, d, h)} · {x}&quot;</option>)}
        </select>
      )}
      {zone === "wall" && <Len label="Bottom off the floor" mm={fx.elevation_mm ?? def.z} units={units} onSet={(v) => save({ ...fx, elevation_mm: Math.round(v) || undefined })} />}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {zone !== "wall" && !F.id.startsWith("panel") && <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.counter} onChange={(e) => setCab({ counter: e.target.checked })} /> {F.id.startsWith("vanity") ? "Vanity top" : "Countertop"}</label>}
        {zone !== "base" && <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.crown} onChange={(e) => setCab({ crown: e.target.checked })} /> Crown molding</label>}
        {zone === "wall" && <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.rail} onChange={(e) => setCab({ rail: e.target.checked })} /> Light rail</label>}
      </div>
      <p className="text-muted text-[12.5px] leading-snug">{stock ? "A stock size." : `Stock ${F.label.toLowerCase()} widths are ${F.widths.map((x) => `${x}"`).join(", ")}; anything else is made to order.`} Typed widths within {fmtLen(std("cab.snap"), units)} of a stock width snap to it.</p>
      <button className="btn btn-sm btn-ghost text-red" onClick={onDelete}>Delete</button>
    </div>
  );
}

/** A cabinet size as typed: a bare number is inches ("18", "17 1/2", "34.5"), else any length ("2' 6""). */
function readSize(s: string, units: Units): number | null {
  const t = s.trim().replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4");
  const m = /^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?$/.exec(t);
  if (m && units === "ft") return (parseFloat(m[1]) + (m[2] ? +m[2] / Math.max(1, +m[3]) : 0)) * INCH;
  return parseLength(s, units);
}

function Len({ label, mm, units, onSet }: { label: string; mm: number; units: Units; onSet: (mm: number) => void }) {
  return (
    <label className="block">
      <span className="label !mb-1 block">{label}</span>
      <input key={`${Math.round(mm * 10)}${units}`} className="input !h-9 w-full" defaultValue={fmtLen(mm, units, true)} aria-label={label}
        onBlur={(e) => { const v = readSize(e.target.value, units); if (v != null && Math.abs(v - mm) > 0.5) onSet(units === "ft" ? Math.round(v / (INCH / 8)) * (INCH / 8) : roundLen(v, units)); }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
    </label>
  );
}
