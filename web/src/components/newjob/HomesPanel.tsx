"use client";
// Homes in a building: for a duplex, townhouses or an apartment building (a property manager's whole
// building in one drawing). Lists each home with its rooms and floor area; click one to light its rooms
// up, rename it, copy it beside (or mirrored) or to the floor above.
import { useState } from "react";
import type { Sketch } from "@/lib/plan/sketch";
import { copyHomeBeside, copyHomeUp, homesOf, intoOneHome, renameHome } from "@/lib/plan/homes";
import { fmtArea, type Units } from "@/lib/plan/units";

export function HomesPanel({ sk, fi, units, lit, onLight, onChange, onFloor, onNote }: {
  sk: Sketch; fi: number; units: Units; lit: string | null;
  onLight: (name: string | null) => void; onChange: (s: Sketch) => void; onFloor: (fi: number) => void; onNote: (n: string) => void;
}) {
  const homes = homesOf(sk);
  const loose = sk.floors.reduce((n, f) => n + f.rooms.filter((r) => !r.unit).length, 0);
  const [open, setOpen] = useState(homes.length > 1);
  const [copying, setCopying] = useState<string | null>(null);
  if (!open && homes.length <= 1) {
    return (
      <div className="pt-3 border-t border-line">
        <button className="btn btn-sm btn-ghost w-full" disabled={!loose && !homes.length} onClick={() => { setOpen(true); if (!homes.length) onChange(intoOneHome(sk)); }}
          title="A duplex, townhouses or an apartment building: one drawing, several homes">This building has several homes</button>
      </div>
    );
  }
  const light = (name: string) => {
    if (lit === name) return onLight(null);
    onLight(name);
    const h = homes.find((x) => x.name === name);
    if (h && !h.floors.includes(fi) && h.floors.length) onFloor(h.floors[0]);
  };
  return (
    <div className="space-y-2 pt-1 border-t border-line" aria-label="Homes">
      <p className="eyebrow pt-2">Homes · {homes.length}</p>
      <ul className="space-y-2">
        {homes.map((h) => (
          <li key={h.name} className={`rounded-[4px] border p-2 space-y-1.5 ${lit === h.name ? "border-[#55b2ff]" : "border-line"}`}>
            <div className="flex items-center gap-1.5">
              <input className="input !h-8 flex-1 min-w-0" defaultValue={h.name} key={h.name} aria-label="Home name"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.name) { onChange(renameHome(sk, h.name, v)); if (lit === h.name) onLight(v); } else e.target.value = h.name; }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <button className={`chip !h-8 ${lit === h.name ? "!text-[#55b2ff] !border-[#55b2ff]" : ""}`} onClick={() => light(h.name)} title="Light up its rooms on the plan">Show</button>
            </div>
            <button className="text-left text-muted leading-snug w-full" onClick={() => light(h.name)}>
              {h.rooms.length} rooms · {fmtArea(h.area_m2, units)}{h.floors.length > 1 ? ` · ${h.floors.length} floors` : ""}
              <span className="block text-[12px]">{h.rooms.map((r) => r.name).join(", ")}</span>
            </button>
            {copying === h.name ? (
              <div className="flex flex-wrap gap-1">
                <button className="chip !h-7" onClick={() => { const r = copyHomeBeside(sk, h.name, false); onChange(r.sketch); setCopying(null); onLight(r.name); onNote(`${r.name} is a copy of ${h.name}, beside it.`); }}>Beside</button>
                <button className="chip !h-7" onClick={() => { const r = copyHomeBeside(sk, h.name, true); onChange(r.sketch); setCopying(null); onLight(r.name); onNote(`${r.name} is ${h.name} mirrored, beside it.`); }}>Mirrored</button>
                <button className="chip !h-7" onClick={() => {
                  const r = copyHomeUp(sk, h.name); setCopying(null);
                  if (!r) { onNote("The floor above already has rooms there."); return; }
                  onChange(r.sketch); onLight(r.name); onFloor(r.fi); onNote(`${r.name} is a copy of ${h.name} on the floor above.`);
                }}>To the floor above</button>
                <button className="chip !h-7" onClick={() => setCopying(null)} aria-label="Cancel">✕</button>
              </div>
            ) : <button className="btn btn-sm btn-ghost !h-7" onClick={() => setCopying(h.name)}>Copy this home</button>}
          </li>
        ))}
      </ul>
      {loose > 0 && <p className="text-muted">{loose} {loose === 1 ? "room isn't" : "rooms aren't"} in a home (halls, stairs, shared rooms). Pick a room to set its home.</p>}
    </div>
  );
}
