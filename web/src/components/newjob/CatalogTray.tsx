"use client";
// The catalogue tray under the plan while placing furniture: a row of room tabs, a row of kind tabs and a
// search box. Click an item to pick it up, then click the plan to put it down (Shift-click keeps
// placing). The tabs come from lib/plan/tray.ts, so a new section is one addTrayGroup call.
import { useMemo, useState } from "react";
import { CATALOG } from "@/lib/plan/catalog";
import { itemLabel, trayGroups, trayItems, type TrayItem } from "@/lib/plan/tray";
import { fmtLen, type Units } from "@/lib/plan/units";

const sameItem = (a: TrayItem | null, b: TrayItem) => !!a && a.kind === b.kind && (a.label ?? "") === (b.label ?? "") && (a.w ?? CATALOG[a.kind]?.w) === (b.w ?? CATALOG[b.kind]?.w) && (a.d ?? CATALOG[a.kind]?.d) === (b.d ?? CATALOG[b.kind]?.d);

export function CatalogTray({ armed, onPick, startRoom, units = "ft" }: { armed: TrayItem | null; onPick: (it: TrayItem) => void; startRoom?: string | null; units?: Units }) {
  const groups = useMemo(() => trayGroups(), []);
  const [room, setRoom] = useState<string | null>(startRoom ?? null);
  const [kind, setKind] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const items = trayItems(groups, room, kind, q);
  const tab = (id: string | null, label: string, on: boolean, pick: () => void) => (
    <button key={id ?? "all"} onClick={pick} className={`chip !h-7 shrink-0 ${on ? "!text-accent !border-accent" : ""}`}>{label}</button>
  );
  return (
    <div className="border-t border-line bg-panel px-3 py-2 space-y-1.5" aria-label="Catalogue">
      <div className="flex items-center gap-1.5">
        <input className="input !h-8 !w-44 shrink-0" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: sink, couch, oven" aria-label="Search the catalogue" />
        <div className="flex gap-1 overflow-x-auto scroll-thin min-w-0">
          {tab(null, "Any room", !room, () => setRoom(null))}
          {groups.filter((g) => g.by === "room").map((g) => tab(g.id, g.label, room === g.id, () => { setRoom(g.id); setQ(""); }))}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto scroll-thin">
        {tab(null, "Everything", !kind, () => setKind(null))}
        {groups.filter((g) => g.by === "kind").map((g) => tab(g.id, g.label, kind === g.id, () => { setKind(g.id); setQ(""); }))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-1 max-h-[148px] overflow-y-auto scroll-thin">
        {items.map((it, i) => {
          const s = CATALOG[it.kind], w = it.w ?? s?.w ?? 600, d = it.d ?? s?.d ?? 600, k = 22 / Math.max(w, d);
          const on = sameItem(armed, it);
          return (
            <button key={i} onClick={() => onPick(it)} title={`${itemLabel(it)}: ${fmtLen(w, units)} wide, ${fmtLen(d, units)} deep`}
              className={`flex items-center gap-2 rounded-[3px] border px-1.5 py-1 text-left ${on ? "border-accent bg-panel-2" : "border-line hover:border-muted"}`}>
              <svg width="24" height="24" viewBox="-12 -12 24 24" className="shrink-0" aria-hidden><rect x={(-w * k) / 2} y={(-d * k) / 2} width={w * k} height={d * k} fill={s?.fill ?? "#888"} stroke="#17181b" strokeWidth="1" /></svg>
              <span className="min-w-0 leading-tight">
                <span className={`block truncate text-[12.5px] ${on ? "text-accent" : ""}`}>{itemLabel(it)}</span>
                <span className="block truncate text-[11px] text-muted">{fmtLen(w, units)} × {fmtLen(d, units)}</span>
              </span>
            </button>
          );
        })}
        {!items.length && <p className="text-muted text-[13px] col-span-full py-2">Nothing by that name. Try another word, or clear the tabs.</p>}
      </div>
    </div>
  );
}
