"use client";
// The details card for whatever is selected on the plan: what it is, its ID, its build status, and the
// pins on it. With nothing selected it summarises the current level.
import type { Pin } from "@/lib/data/types";
import { elementKindLabel, elementLabel, findElement, floorBBox, pointInPoly, roomOf, roomSides } from "@/lib/plan/geometry";
import type { Element, ElementStatus, Plan } from "@/lib/plan/types";
import { HEADING_LABEL, type Level } from "@/components/plan/PlanViewer";
import { PIN_COLOR, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "@/components/plan/style";
import { PinRow } from "./PinsPanel";

const SOURCE: Record<string, string> = {
  drawing: "Read from the drawing", ai: "Named by the plan reader", contents: "Guessed from what is inside", contractor: "Confirmed by you", vision: "Read from the image",
};

const m = (mm: number) => `${(mm / 1000).toFixed(2)} m`;

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-line/60 last:border-0">
      <span className="text-muted text-[13px] w-28 shrink-0">{k}</span>
      <span className="text-[14px] min-w-0">{v}</span>
    </div>
  );
}

export function StatusPicker({ value, onChange }: { value: ElementStatus | undefined; onChange: (s: ElementStatus | null) => void }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {STATUS_ORDER.map((s) => (
          <button key={s} onClick={() => onChange(value === s ? null : s)} aria-pressed={value === s}
            className={`h-9 rounded-lg border text-[12.5px] inline-flex items-center justify-center gap-1.5 transition-colors ${value === s ? "border-transparent text-[#111]" : "border-line bg-panel-2 hover:bg-panel-3"}`}
            style={value === s ? { background: STATUS_COLOR[s] } : undefined}>
            {value !== s && <span className="dot" style={{ background: STATUS_COLOR[s] }} />}{STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {!value && <p className="text-[12px] text-muted mt-1.5">No status yet. Pick one to colour it on the plan.</p>}
    </div>
  );
}

interface Props {
  plan: Plan;
  level: Level;
  selected: string | null;
  states: Map<string, ElementStatus>;
  pins: Pin[];
  onSetStatus: (id: string, s: ElementStatus | null) => void;
  onSelect: (id: string, fly?: boolean) => void;
  onSelectPin: (id: string) => void;
  onAddPin: (elementId: string) => void;
  setLevel: (l: Level) => void;
}

function pinsFor(plan: Plan, pins: Pin[], e: Element) {
  return pins.filter((p) => {
    if (p.element_id === e.el.id) return true;
    if (e.kind !== "room" || !p.element_id) return false;
    const pe = findElement(plan, p.element_id);
    return pe ? roomOf(pe) === e.el.id : p.x != null && p.y != null && pointInPoly([p.x, p.y], e.el.polygon);
  });
}

export function Inspector(p: Props) {
  const { plan, level, selected, states } = p;
  const e = selected ? findElement(plan, selected) : null;

  if (e) {
    const myPins = pinsFor(plan, p.pins, e);
    return (
      <div className="p-4 space-y-5">
        <div>
          <p className="eyebrow">{elementKindLabel(e)} · {e.floor.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="font-display text-[21px] font-bold leading-tight min-w-0 truncate">{elementLabel(e)}</h2>
            <span className="chip font-mono text-[11.5px] ml-auto shrink-0">{e.el.id}</span>
          </div>
        </div>

        <div>
          {e.kind === "room" && (
            <>
              <Row k="Size" v={`${e.el.area_m2.toFixed(1)} m²${e.el.drawing_area_m2 ? ` (drawing says ${e.el.drawing_area_m2} m²)` : ""}`} />
              <Row k="Type" v={e.el.type.replace("_", " ")} />
              <Row k="Name" v={<>{SOURCE[e.el.label_source] ?? e.el.label_source}{e.el.confidence < 0.7 && <span className="text-amber"> · please check</span>}</>} />
              <Row k="Contains" v={`${e.floor.fixtures.filter((f) => f.room_id === e.el.id).length} items, ${e.el.opening_ids.length} doors and windows, ${e.el.wall_ids.length} walls`} />
              {e.el.notes && <Row k="Notes" v={e.el.notes} />}
            </>
          )}
          {e.kind === "wall" && (
            <>
              <Row k="Length" v={m(e.el.length_mm)} />
              <Row k="Thickness" v={`${Math.round(e.el.thickness_mm)} mm`} />
              <Row k="Side of" v={e.el.room_ids.map((id) => findElement(plan, id)).filter(Boolean).map((r) => elementLabel(r!)).join(", ") || "Outside"} />
            </>
          )}
          {e.kind === "opening" && (
            <>
              <Row k="Width" v={`${Math.round(e.el.width_mm)} mm`} />
              <Row k="Kind" v={e.el.kind.replace("_", " ")} />
              <Row k="Between" v={e.el.room_ids.map((id) => findElement(plan, id)).filter(Boolean).map((r) => elementLabel(r!)).join(" and ") || "Outside"} />
              {e.el.confidence < 0.7 && <Row k="Note" v={<span className="text-amber">Found from the linework only, please check</span>} />}
            </>
          )}
          {e.kind === "fixture" && (
            <>
              <Row k="Kind" v={e.el.kind === "other" ? "Not identified yet" : e.el.kind.replace("_", " ")} />
              <Row k="Room" v={e.el.room_id ? elementLabel(findElement(plan, e.el.room_id)!) : "None"} />
              <Row k="Size" v={`${Math.round(e.el.bbox[2] - e.el.bbox[0])} × ${Math.round(e.el.bbox[3] - e.el.bbox[1])} mm`} />
              {e.el.source_ref && <Row k="Drawing" v={<span className="font-mono text-[12px]">{e.el.source_ref}</span>} />}
            </>
          )}
          {e.kind === "stair" && <Row k="Room" v={e.el.room_id ? elementLabel(findElement(plan, e.el.room_id)!) : "None"} />}
        </div>

        <div>
          <p className="eyebrow mb-2">Build status</p>
          <StatusPicker value={states.get(e.el.id)} onChange={(s) => p.onSetStatus(e.el.id, s)} />
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={() => p.onAddPin(e.el.id)}>Add task or note</button>
          {e.kind === "room" && level.kind === "floor" && <button className="btn" onClick={() => p.setLevel({ kind: "room", floorId: e.floor.id, roomId: e.el.id })}>Step in</button>}
        </div>

        <div>
          <p className="eyebrow mb-2">Pins here ({myPins.length})</p>
          {myPins.length ? <div className="space-y-1.5">{myPins.map((pin) => <PinRow key={pin.id} pin={pin} plan={plan} onClick={() => p.onSelectPin(pin.id)} />)}</div>
            : <p className="text-[13px] text-muted">Nothing yet.</p>}
        </div>

        {e.kind === "room" && (
          <div>
            <p className="eyebrow mb-2">In this room</p>
            <div className="flex flex-wrap gap-1.5">
              {[...e.floor.openings.filter((o) => o.room_ids.includes(e.el.id)), ...e.floor.fixtures.filter((f) => f.room_id === e.el.id && f.kind !== "other")].map((x) => (
                <button key={x.id} onClick={() => p.onSelect(x.id, true)} className="chip hover:text-text">
                  {states.get(x.id) && <span className="dot" style={{ background: STATUS_COLOR[states.get(x.id)!] }} />}{x.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // nothing selected: summary of where we are
  const floors = [...plan.floors].sort((a, b) => a.level - b.level);
  const open = p.pins.filter((x) => x.status !== "done");
  const counts = new Map<ElementStatus, number>();
  for (const s of states.values()) counts.set(s, (counts.get(s) ?? 0) + 1);

  if (level.kind === "wall") {
    const f = plan.floors.find((x) => x.id === level.floorId)!;
    const r = f.rooms.find((x) => x.id === level.roomId)!;
    const side = roomSides(f, r).find((s) => s.key === level.sideKey);
    return (
      <div className="p-4 space-y-4">
        <div>
          <p className="eyebrow">{r.name} · {f.name}</p>
          <h2 className="font-display text-[21px] font-bold">{side ? HEADING_LABEL(side.heading) : "Wall"}</h2>
          {side && <p className="text-muted text-sm">{m(side.length)} long, {((f.height_mm || 2700) / 1000).toFixed(1)} m high</p>}
        </div>
        <div className="space-y-1.5">
          {side?.segments.map((s) => (
            <button key={s.id} onClick={() => p.onSelect(s.id)} className="w-full text-left card px-3 py-2 flex items-center gap-2 hover:border-[#3a4552]">
              <span className="dot" style={{ background: states.get(s.id) ? STATUS_COLOR[states.get(s.id)!] : "#3a4552" }} />
              <span className="text-[14px]">{s.kind === "wall" ? "Wall piece" : (s.el as { name: string }).name}</span>
              <span className="text-muted text-[12.5px] ml-auto">{m(s.to - s.from)} · <span className="font-mono">{s.id}</span></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (level.kind === "floor" || level.kind === "room") {
    const f = plan.floors.find((x) => x.id === level.floorId) ?? floors[0];
    return (
      <div className="p-4 space-y-4">
        <div>
          <p className="eyebrow">Floor</p>
          <h2 className="font-display text-[21px] font-bold">{f.name}</h2>
          <p className="text-muted text-sm">{f.rooms.length} rooms · {f.rooms.reduce((a, r) => a + r.area_m2, 0).toFixed(0)} m² inside · {f.openings.filter((o) => o.kind === "window").length} windows · {f.openings.filter((o) => o.kind !== "window").length} doors and openings</p>
        </div>
        <div className="space-y-1.5">
          {f.rooms.map((r) => {
            const n = pinsFor(plan, open, { kind: "room", floor: f, el: r }).length;
            const st = states.get(r.id);
            return (
              <button key={r.id} onClick={() => p.setLevel({ kind: "room", floorId: f.id, roomId: r.id })} className="w-full text-left card px-3 py-2 flex items-center gap-2 hover:border-[#3a4552]">
                <span className="dot" style={{ background: st ? STATUS_COLOR[st] : "#3a4552" }} />
                <span className="text-[14px] truncate">{r.name}</span>
                <span className="text-muted text-[12.5px] ml-auto shrink-0">{r.area_m2.toFixed(1)} m²</span>
                {n > 0 && <span className="text-[11px] font-bold rounded-full bg-red text-white px-1.5 min-w-5 text-center">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const bb = floors.length ? floorBBox(floors[0]) : null;
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="eyebrow">Building</p>
        <h2 className="font-display text-[21px] font-bold">{floors.length} floor{floors.length === 1 ? "" : "s"}, {floors.reduce((a, f) => a + f.rooms.length, 0)} rooms</h2>
        {bb && <p className="text-muted text-sm">About {(plan.building.size_mm[0] / 1000).toFixed(1)} × {(plan.building.size_mm[1] / 1000).toFixed(1)} m · {floors.reduce((a, f) => a + f.rooms.reduce((b, r) => b + r.area_m2, 0), 0).toFixed(0)} m² of rooms</p>}
      </div>
      <div className="space-y-1.5">
        {floors.map((f) => (
          <button key={f.id} onClick={() => p.setLevel({ kind: "floor", floorId: f.id })} className="w-full text-left card px-3 py-2.5 flex items-center gap-2 hover:border-[#3a4552]">
            <span className="font-display font-semibold">{f.name}</span>
            <span className="text-muted text-[13px] ml-auto">{f.rooms.length} rooms ›</span>
          </button>
        ))}
      </div>
      <div>
        <p className="eyebrow mb-2">Progress</p>
        {counts.size ? (
          <div className="flex flex-wrap gap-1.5">{STATUS_ORDER.filter((s) => counts.get(s)).map((s) => <span key={s} className="chip"><span className="dot" style={{ background: STATUS_COLOR[s] }} />{counts.get(s)} {STATUS_LABEL[s].toLowerCase()}</span>)}</div>
        ) : <p className="text-[13px] text-muted">Nothing marked yet. Click a room, wall or item and give it a status.</p>}
      </div>
      <div>
        <p className="eyebrow mb-2">Open pins</p>
        <div className="flex flex-wrap gap-1.5">
          {(["task", "issue", "note", "material"] as const).map((k) => <span key={k} className="chip"><span className="dot" style={{ background: PIN_COLOR[k] }} />{open.filter((x) => x.kind === k).length} {k}{open.filter((x) => x.kind === k).length === 1 ? "" : "s"}</span>)}
        </div>
      </div>
    </div>
  );
}
