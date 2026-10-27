"use client";
// The details card for whatever is selected on the plan: what it is, its ID, its build status, the
// things you can do to that one element, what is attached to it, and the pins on it. With nothing
// selected it summarises the current level, from the whole project down to one wall.
import { useState } from "react";
import type { ElementEdit, ItemInput, ItemKind, JobItem, JobStage, Pin, PinAnchor, PinKind } from "@/lib/data/types";
import { attachedToSide, attachedToWall, elementKindLabel, elementLabel, findElement, pointInPoly, roomOf, roomSides, sideOfWall, type WallSide } from "@/lib/plan/geometry";
import type { Element, ElementStatus, Floor, Plan } from "@/lib/plan/types";
import type { Level } from "@/components/plan/PlanViewer";
import { PIN_COLOR, PIN_LABEL, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "@/components/plan/style";
import { ITEM_HEIGHT, ITEM_LABEL } from "@/components/plan/items";
import { FixtureCard, ItemPanel, RoomEdit } from "./Editors";
import { PinRow } from "./PinsPanel";
import { StageStrip } from "./StagesPanel";
import { BuyHere, type BuyTarget } from "@/components/materials/MaterialsPanel";
import { itemSuggestions, suggestFor, wallSuggestions, type Suggestion } from "@/lib/materials/suggest";
import type { MaterialLine } from "@/lib/materials/types";
import { useTeam } from "@/components/team/context";

const SOURCE: Record<string, string> = {
  drawing: "Read from the drawing", ai: "Named by the plan reader", contents: "Guessed from what is inside", contractor: "Confirmed by you", vision: "Read from the image",
};

const m = (mm: number) => `${(mm / 1000).toFixed(2)} m`;

export interface Preset { kind: PinKind; title: string }
export interface AddPin { elementId: string | null; floorId?: string | null; anchor?: PinAnchor | null; preset?: Preset; status?: ElementStatus }

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-dashed border-line last:border-0">
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
            className={`h-9 rounded-[3px] border text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${value === s ? "border-transparent text-[#141310]" : "border-line bg-panel-2 hover:bg-panel-3"}`}
            style={value === s ? { background: STATUS_COLOR[s] } : undefined}>
            {value !== s && <span className="w-2.5 h-2.5 rounded-[1px]" style={{ background: STATUS_COLOR[s] }} />}{STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {!value && <p className="text-[12px] text-muted mt-1.5">No status yet. Pick one to mark it on the plan.</p>}
    </div>
  );
}

// ------------------------------------------------------------------ what you can do to one element

type Action = { label: string; icon: string; kind: PinKind; title: (name: string) => string; status?: ElementStatus; item?: ItemKind; product?: boolean };
const WALL_ACTIONS: Action[] = [
  { label: "Paint", icon: "▤", kind: "task", title: (n) => `Paint ${n}` },
  { label: "Tile", icon: "▦", kind: "task", title: (n) => `Tile ${n}` },
  { label: "Patch / drywall", icon: "▨", kind: "task", title: (n) => `Patch and skim ${n}` },
  { label: "Outlet", icon: "⏻", kind: "task", title: () => "Add outlet", item: "outlet" },
  { label: "Switch", icon: "⎍", kind: "task", title: () => "Add light switch", item: "switch" },
  { label: "Light", icon: "✶", kind: "task", title: () => "Add wall light", item: "light" },
  { label: "Plumbing point", icon: "⌇", kind: "task", title: () => "Plumbing point", item: "plumbing" },
  { label: "Mount / shelf", icon: "▭", kind: "task", title: () => "Fix mount or shelf (check backing)", item: "mount" },
  { label: "New window", icon: "◫", kind: "task", title: () => "Cut in new window" },
  { label: "New door", icon: "▯", kind: "task", title: () => "Cut in new door" },
  { label: "Insulate", icon: "≋", kind: "task", title: (n) => `Insulate ${n}` },
  { label: "Demolish", icon: "✕", kind: "task", title: (n) => `Demolish ${n}`, status: "demolish" },
];
const OPENING_ACTIONS: Action[] = [
  { label: "Replace", icon: "↻", kind: "task", title: (n) => `Replace ${n}` },
  { label: "Repair / adjust", icon: "⚒", kind: "task", title: (n) => `Repair ${n}` },
  { label: "Paint / stain", icon: "▤", kind: "task", title: (n) => `Paint ${n}` },
  { label: "Hardware", icon: "⚿", kind: "material", title: (n) => `Hardware for ${n}` },
  { label: "Seal / trim", icon: "▭", kind: "task", title: (n) => `Seal and trim ${n}` },
  { label: "Remove", icon: "✕", kind: "task", title: (n) => `Remove ${n}`, status: "demolish" },
];
const FIXTURE_ACTIONS: Action[] = [
  { label: "Install", icon: "＋", kind: "task", title: (n) => `Install ${n}` },
  { label: "Replace", icon: "↻", kind: "task", title: (n) => `Replace ${n}` },
  { label: "Connect", icon: "⌇", kind: "task", title: (n) => `Connect ${n} (plumbing / power)` },
  { label: "Spec / product", icon: "◈", kind: "material", title: (n) => `${n}: model and finish`, product: true },
  { label: "Repair", icon: "⚒", kind: "issue", title: (n) => `Fix ${n}` },
  { label: "Remove", icon: "✕", kind: "task", title: (n) => `Remove ${n}`, status: "demolish" },
];
const ROOM_ACTIONS: Action[] = [
  { label: "Paint walls", icon: "▤", kind: "task", title: (n) => `Paint ${n}` },
  { label: "Flooring", icon: "▦", kind: "task", title: (n) => `New floor in ${n}` },
  { label: "Ceiling", icon: "▔", kind: "task", title: (n) => `Ceiling in ${n}` },
  { label: "Electrical", icon: "⏻", kind: "task", title: (n) => `Electrical in ${n}` },
  { label: "Plumbing", icon: "⌇", kind: "task", title: (n) => `Plumbing in ${n}` },
  { label: "Clean / snag", icon: "✓", kind: "task", title: (n) => `Final clean and snag ${n}` },
];

function Actions({ actions, name, onPick }: { actions: Action[]; name: string; onPick: (a: Action) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {actions.map((a) => (
        <button key={a.label} onClick={() => onPick(a)}
          className="h-[52px] rounded-[3px] border border-line bg-panel-2 hover:bg-panel-3 hover:border-accent flex flex-col items-center justify-center gap-0.5 px-1 group">
          <span className="text-[15px] leading-none text-muted group-hover:text-accent">{a.icon}</span>
          <span className="text-[12px] leading-tight text-center">{a.label}</span>
        </button>
      ))}
      <span className="sr-only">Each opens a pin on {name}</span>
    </div>
  );
}

interface Props {
  plan: Plan;
  level: Level;
  selected: string | null;
  states: Map<string, ElementStatus>;
  pins: Pin[];
  stages: JobStage[];
  onSetStatus: (id: string, s: ElementStatus | null) => void;
  onSelect: (id: string, fly?: boolean) => void;
  onSelectPin: (id: string) => void;
  onAddPin: (a: AddPin) => void;
  setLevel: (l: Level) => void;
  edits: Record<string, ElementEdit>;
  onSaveEdit: (id: string, patch: ElementEdit | null) => Promise<void>;
  items: JobItem[];
  selectedItem: string | null;
  onSelectItem: (id: string) => void;
  onAddItem: (input: ItemInput) => Promise<void>;
  onUpdateItem: (id: string, input: Partial<ItemInput>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onPinKind: (k: PinKind) => void;
  /** the materials list: this job's lines, one-tap add, the full add sheet, open a line */
  buy?: { lines: MaterialLine[]; onQuick: (t: BuyTarget, s: Suggestion) => void; onAll: (t: BuyTarget, list: Suggestion[]) => void; onMore: (t: BuyTarget) => void; onOpen: (id: string) => void };
}

/** "Buy for this" on any picked spot, with the lines already on the list for it. */
function Buy({ p, target, here }: { p: Props; target: BuyTarget; here: (l: MaterialLine) => boolean }) {
  const { members } = useTeam();
  if (!p.buy) return null;
  const b = p.buy;
  return <BuyHere target={target} lines={b.lines.filter(here)} members={members} onQuick={(s) => b.onQuick(target, s)} onAll={(list) => b.onAll(target, list)} onMore={() => b.onMore(target)} onOpen={b.onOpen} />;
}

function pinsFor(plan: Plan, pins: Pin[], e: Element) {
  return pins.filter((p) => {
    if (p.element_id === e.el.id) return true;
    if (e.kind !== "room") return false;
    if (p.anchor?.view === "wall") return p.anchor.side?.split(":")[0] === e.el.id;
    if (!p.element_id) return p.floor_id === e.floor.id && p.x != null && p.y != null && pointInPoly([p.x, p.y], e.el.polygon);
    const pe = findElement(plan, p.element_id);
    return pe ? roomOf(pe) === e.el.id : false;
  });
}

function Head({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <h2 className="font-display text-[25px] font-extrabold uppercase tracking-[0.02em] leading-none min-w-0 truncate">{title}</h2>
        {id && <span className="tag ml-auto shrink-0">{id}</span>}
      </div>
    </div>
  );
}

function Chips({ items, states, onSelect }: { items: { id: string; name: string }[]; states: Map<string, ElementStatus>; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <button key={x.id} onClick={() => onSelect(x.id)} className="chip hover:text-text hover:border-chalk">
          {states.get(x.id) && <span className="w-2 h-2 rounded-[1px]" style={{ background: STATUS_COLOR[states.get(x.id)!] }} />}
          {x.name}<span className="font-mono text-[11px] opacity-70">{x.id}</span>
        </button>
      ))}
    </div>
  );
}

function sideItems(floor: Floor, side: WallSide) {
  return [
    ...side.segments.map((s) => ({ id: s.id, name: s.kind === "wall" ? "Wall piece" : (s.el as { name: string }).name })),
    ...attachedToSide(floor, side).map((a) => ({ id: a.f.id, name: a.f.kind === "other" ? "Unidentified item" : a.f.name })),
  ];
}

/** The wall side an item goes on and where along it, for an action picked on an element. */
function itemSpot(plan: Plan, level: Level, e: Element | null): { floorId: string; side: WallSide; x: number } | null {
  if (level.kind === "wall") {
    const f = plan.floors.find((x) => x.id === level.floorId)!;
    const side = roomSides(f, f.rooms.find((r) => r.id === level.roomId)!).find((s) => s.key === level.sideKey);
    if (!side) return null;
    const seg = e ? side.segments.find((s) => s.id === e.el.id) : null;
    const fix = e && !seg ? attachedToSide(f, side).find((a) => a.f.id === e.el.id) : null;
    return { floorId: f.id, side, x: Math.round(seg ? (seg.from + seg.to) / 2 : fix ? (fix.from + fix.to) / 2 : side.length / 2) };
  }
  if (e?.kind === "wall") {
    const side = sideOfWall(e.floor, e.el.id, level.kind === "room" ? level.roomId : null);
    const seg = side?.segments.find((s) => s.id === e.el.id);
    if (side) return { floorId: e.floor.id, side, x: Math.round(seg ? (seg.from + seg.to) / 2 : side.length / 2) };
  }
  return null;
}

export function Inspector(p: Props) {
  const { plan, level, selected, states } = p;
  const e = selected ? findElement(plan, selected) : null;
  const [product, setProduct] = useState<string | null>(null);

  /** Outlet, switch, light ...: put a real one on the wall (and face that wall) to drag into place. */
  const placeItem = (kind: ItemKind, el: Element | null) => {
    const spot = itemSpot(plan, level, el);
    if (!spot) return false;
    if (level.kind !== "wall") p.setLevel({ kind: "wall", floorId: spot.floorId, roomId: spot.side.roomId, sideKey: spot.side.key });
    void p.onAddItem({ kind, floor_id: spot.floorId, side: spot.side.key, x: spot.x, y: ITEM_HEIGHT[kind] });
    return true;
  };

  const item = p.selectedItem ? p.items.find((i) => i.id === p.selectedItem) : null;
  if (item) {
    const f = plan.floors.find((x) => x.id === item.floor_id);
    const room = f?.rooms.find((r) => r.id === item.side.split(":")[0]);
    const side = f && room ? roomSides(f, room).find((s) => s.key === item.side) : null;
    const itemAnchor = { view: "wall" as const, side: item.side, x: item.x, y: -item.y };
    return <><ItemPanel key={item.id} item={item} wallLabel={side && room ? `${side.label}, ${room.name}` : "Wall"} wallLength={side?.length ?? null}
      onUpdate={(input) => p.onUpdateItem(item.id, input)} onDelete={() => p.onDeleteItem(item.id)}
      onShow={() => f && room && p.setLevel({ kind: "wall", floorId: f.id, roomId: room.id, sideKey: item.side })}
      onPin={() => p.onAddPin({ elementId: null, floorId: item.floor_id, anchor: { view: "wall", side: item.side, x: item.x, y: -item.y }, preset: { kind: "task", title: `${item.label || ITEM_LABEL[item.kind]}: ` } })} />
      <div className="px-4 pb-4"><Buy p={p} target={{ element_id: null, floor_id: item.floor_id, anchor: itemAnchor, where: `${item.label || ITEM_LABEL[item.kind]} · ${side && room ? `${side.label}, ${room.name}` : "Wall"}`, suggestions: itemSuggestions(item.kind) }}
        here={(l) => l.anchor?.side === item.side && Math.abs((l.anchor?.x ?? -1e9) - item.x) < 60} /></div></>;
  }

  if (e) {
    const myPins = pinsFor(plan, p.pins, e);
    const name = elementLabel(e);
    const lname = e.kind === "wall" ? "this wall" : name.toLowerCase();
    // inside a wall view, actions on an element keep their spot on that wall
    const wallAnchor = level.kind === "wall" ? (() => {
      const side = roomSides(e.floor, e.floor.rooms.find((r) => r.id === level.roomId)!).find((s) => s.key === level.sideKey);
      const seg = side?.segments.find((s) => s.id === e.el.id);
      const fix = side && !seg ? attachedToSide(e.floor, side).find((a) => a.f.id === e.el.id) : null;
      const x = seg ? (seg.from + seg.to) / 2 : fix ? (fix.from + fix.to) / 2 : null;
      return x == null ? null : { view: "wall" as const, side: level.sideKey, x: Math.round(x), y: seg?.kind === "wall" ? -1400 : fix ? -1100 : -2300 };
    })() : null;
    const pick = (a: Action) => {
      if (a.product && e.kind === "fixture") return setProduct(e.el.id);
      if (a.item && placeItem(a.item, e)) return;
      if (a.status) p.onSetStatus(e.el.id, a.status);
      p.onAddPin({ elementId: e.el.id, floorId: e.floor.id, anchor: wallAnchor, preset: { kind: a.kind, title: a.title(lname) } });
    };
    const H = e.floor.height_mm || 2700;
    const wallSide = e.kind === "wall" ? sideOfWall(e.floor, e.el.id, level.kind === "room" || level.kind === "wall" ? level.roomId : null) : null;
    const att = e.kind === "wall" ? attachedToWall(e.floor, e.el) : null;
    return (
      <div className="p-4 space-y-5">
        <Head eyebrow={`${elementKindLabel(e)} · ${e.floor.name}`} title={name} id={e.el.id} />

        <div>
          {e.kind === "room" && (
            <>
              <Row k="Size" v={`${e.el.area_m2.toFixed(1)} m²${e.el.drawing_area_m2 ? ` (drawing says ${e.el.drawing_area_m2} m²)` : ""}`} />
              <Row k="Type" v={e.el.type.replace("_", " ")} />
              <Row k="Name" v={<>{SOURCE[e.el.label_source] ?? e.el.label_source}{e.el.confidence < 0.7 && <span className="text-amber"> · please check</span>}</>} />
              <Row k="Contains" v={`${e.floor.fixtures.filter((f) => f.room_id === e.el.id).length} items, ${e.el.opening_ids.length} doors and windows, ${e.el.wall_ids.length} walls`} />
              {e.el.notes && <Row k="Notes" v={e.el.notes} />}
              <div className="mt-2 flex justify-end"><RoomEdit key={e.el.id} r={e.el} onSave={(patch) => p.onSaveEdit(e.el.id, { ...p.edits[e.el.id], ...patch })} /></div>
            </>
          )}
          {e.kind === "wall" && (
            <>
              <Row k="Length" v={m(e.el.length_mm)} />
              <Row k="Height" v={`${(H / 1000).toFixed(1)} m (floor to ceiling)`} />
              <Row k="Face area" v={`${((e.el.length_mm * H) / 1e6).toFixed(1)} m² each side, before openings`} />
              <Row k="Thickness" v={`${Math.round(e.el.thickness_mm)} mm · ${e.el.exterior ? "exterior" : "interior"}`} />
              <Row k="Rooms" v={e.el.room_ids.map((id) => findElement(plan, id)).filter(Boolean).map((r) => elementLabel(r!)).join(" | ") + (e.el.exterior ? " | outside" : "") || "Outside"} />
            </>
          )}
          {e.kind === "opening" && (
            <>
              <Row k="Width" v={`${Math.round(e.el.width_mm)} mm`} />
              <Row k="Kind" v={e.el.kind.replace("_", " ")} />
              <Row k="Between" v={e.el.room_ids.map((id) => findElement(plan, id)).filter(Boolean).map((r) => elementLabel(r!)).join(" and ") + (e.el.exterior ? " and outside" : "") || "Outside"} />
              {e.el.confidence < 0.7 && <Row k="Note" v={<span className="text-amber">Found from the linework only, please check</span>} />}
            </>
          )}
          {e.kind === "fixture" && (
            <FixtureCard key={`${e.el.id}${product === e.el.id ? "p" : ""}`} f={e.el} edit={p.edits[e.el.id]} focus={product === e.el.id ? "product" : null}
              room={e.el.room_id ? elementLabel(findElement(plan, e.el.room_id)!) : "None"}
              onSave={async (patch) => { await p.onSaveEdit(e.el.id, patch); setProduct(null); }} />
          )}
          {e.kind === "stair" && <Row k="Room" v={e.el.room_id ? elementLabel(findElement(plan, e.el.room_id)!) : "None"} />}
        </div>

        {(e.kind === "wall" && wallSide && level.kind !== "wall" || e.kind === "room" && level.kind === "floor") && (
          <div className="flex gap-2">
            {e.kind === "wall" && wallSide && <button className="btn flex-1" onClick={() => { p.setLevel({ kind: "wall", floorId: e.floor.id, roomId: wallSide.roomId, sideKey: wallSide.key }); p.onSelect(e.el.id); }}>Face this wall ›</button>}
            {e.kind === "room" && <button className="btn flex-1" onClick={() => p.setLevel({ kind: "room", floorId: e.floor.id, roomId: e.el.id })}>Step in ›</button>}
          </div>
        )}

        {e.kind !== "stair" && (
          <div>
            <p className="eyebrow mb-2">{e.kind === "wall" ? "Work on this wall" : e.kind === "room" ? "Work in this room" : `Work on this ${e.kind === "fixture" ? "item" : e.el.kind === "window" ? "window" : "door"}`}</p>
            <Actions actions={e.kind === "wall" ? WALL_ACTIONS : e.kind === "opening" ? OPENING_ACTIONS : e.kind === "fixture" ? FIXTURE_ACTIONS : ROOM_ACTIONS} name={name} onPick={pick} />
            <button className="btn btn-primary w-full mt-2" onClick={() => p.onAddPin({ elementId: e.el.id, floorId: e.floor.id, anchor: wallAnchor })}>Something else: add a pin</button>
          </div>
        )}

        <Buy p={p} target={{ element_id: e.el.id, floor_id: e.floor.id, anchor: wallAnchor, where: `${name} · ${e.floor.name}`, suggestions: suggestFor(e) }}
          here={(l) => {
            if (l.element_id === e.el.id) return true;
            if (e.kind !== "room") return false;
            const le = l.element_id ? findElement(plan, l.element_id) : null;
            return le ? roomOf(le) === e.el.id : l.anchor?.side?.split(":")[0] === e.el.id;
          }} />

        {att && (att.openings.length > 0 || att.fixtures.length > 0) && (
          <div>
            <p className="eyebrow mb-2">Attached to this wall</p>
            <Chips items={[...att.openings, ...att.fixtures.map((f) => ({ id: f.id, name: f.kind === "other" ? "Unidentified item" : f.name }))]} states={states} onSelect={(id) => p.onSelect(id, true)} />
          </div>
        )}

        <div>
          <p className="eyebrow mb-2">Build status</p>
          <StatusPicker value={states.get(e.el.id)} onChange={(s) => p.onSetStatus(e.el.id, s)} />
        </div>

        <div>
          <p className="eyebrow mb-2">Pins here ({myPins.length})</p>
          {myPins.length ? <div className="space-y-1.5">{myPins.map((pin) => <PinRow key={pin.id} pin={pin} plan={plan} onClick={() => p.onSelectPin(pin.id)} />)}</div>
            : <p className="text-[13px] text-muted">Nothing yet.</p>}
        </div>

        {e.kind === "room" && (
          <div>
            <p className="eyebrow mb-2">In this room</p>
            <Chips items={[...e.floor.openings.filter((o) => o.room_ids.includes(e.el.id)), ...e.floor.fixtures.filter((f) => f.room_id === e.el.id && f.kind !== "other")]} states={states} onSelect={(id) => p.onSelect(id, true)} />
          </div>
        )}
      </div>
    );
  }

  // nothing selected: summary of where we are
  const floors = [...plan.floors].sort((a, b) => a.level - b.level);
  const open = p.pins.filter((x) => x.status !== "done");

  if (level.kind === "wall") {
    const f = plan.floors.find((x) => x.id === level.floorId)!;
    const r = f.rooms.find((x) => x.id === level.roomId)!;
    const side = roomSides(f, r).find((s) => s.key === level.sideKey);
    if (!side) return null;
    const H = f.height_mm || 2700;
    const opArea = side.segments.filter((s) => s.kind === "opening").reduce((a, s) => a + (s.to - s.from) * 2100, 0);
    const main = [...side.segments.filter((s) => s.kind === "wall")].sort((a, b) => b.to - b.from - (a.to - a.from))[0];
    const here = p.pins.filter((x) => x.anchor?.side === side.key || side.segments.some((s) => s.id === x.element_id));
    return (
      <div className="p-4 space-y-5">
        <Head eyebrow={`${r.name} · ${f.name}`} title={side.label} />
        <div>
          <Row k="Length" v={m(side.length)} />
          <Row k="Height" v={`${(H / 1000).toFixed(1)} m`} />
          <Row k="Paintable" v={`about ${((side.length * H - opArea) / 1e6).toFixed(1)} m² after doors and windows`} />
          <Row k="Pieces" v={`${side.segments.filter((s) => s.kind === "wall").length} wall, ${side.segments.filter((s) => s.kind === "opening").length} doors and windows`} />
        </div>
        <div>
          <p className="eyebrow mb-2">Work on this wall</p>
          <Actions actions={WALL_ACTIONS} name="this wall" onPick={(a) => {
            if (a.item && placeItem(a.item, null)) return;
            if (a.status && main) p.onSetStatus(main.id, a.status);
            p.onAddPin({ elementId: main?.id ?? null, floorId: f.id, anchor: { view: "wall", side: side.key, x: Math.round(side.length / 2), y: -1400 }, preset: { kind: a.kind, title: a.title(`${side.label[0].toLowerCase()}${side.label.slice(1)} of the ${r.name.toLowerCase()}`) } });
          }} />
          <p className="text-[12px] text-muted mt-2">Outlets, switches and lights go on the wall for you to drag into place. For anything else, pick up a pin and click the exact spot, or right-click it.</p>
        </div>
        <Buy p={p} target={{ element_id: main?.id ?? null, floor_id: f.id, anchor: { view: "wall", side: side.key, x: Math.round(side.length / 2), y: -1400 }, where: `${side.label}, ${r.name}`, suggestions: wallSuggestions(side.length, H, 1, opArea) }}
          here={(l) => l.anchor?.side === side.key || side.segments.some((s) => s.id === l.element_id)} />
        <div>
          <p className="eyebrow mb-2">On this wall</p>
          <Chips items={sideItems(f, side)} states={states} onSelect={(id) => p.onSelect(id)} />
          {p.items.some((i) => i.side === side.key) && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {p.items.filter((i) => i.side === side.key).map((i) => (
                <button key={i.id} onClick={() => p.onSelectItem(i.id)} className="chip hover:text-text hover:border-chalk">{i.label || ITEM_LABEL[i.kind]}<span className="font-mono text-[11px] opacity-70">{Math.round(i.y)} up</span></button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="eyebrow mb-2">Pins here ({here.length})</p>
          {here.length ? <div className="space-y-1.5">{here.map((pin) => <PinRow key={pin.id} pin={pin} plan={plan} onClick={() => p.onSelectPin(pin.id)} />)}</div> : <p className="text-[13px] text-muted">Nothing yet.</p>}
        </div>
      </div>
    );
  }

  if (level.kind === "floor" || level.kind === "room") {
    const f = plan.floors.find((x) => x.id === level.floorId) ?? floors[0];
    return (
      <div className="p-4 space-y-4">
        <Head eyebrow="Floor" title={f.name} />
        <p className="text-muted text-sm -mt-2">{f.rooms.length} rooms · {f.rooms.reduce((a, r) => a + r.area_m2, 0).toFixed(0)} m² inside · {f.openings.filter((o) => o.kind === "window").length} windows · {f.openings.filter((o) => o.kind !== "window").length} doors and openings</p>
        <div className="space-y-1">
          {f.rooms.map((r) => {
            const n = pinsFor(plan, open, { kind: "room", floor: f, el: r }).length;
            const st = states.get(r.id);
            return (
              <button key={r.id} onClick={() => p.setLevel({ kind: "room", floorId: f.id, roomId: r.id })} className="w-full text-left card !rounded-[3px] px-3 py-2 flex items-center gap-2.5 hover:border-chalk">
                <span className="w-1 self-stretch rounded-[1px]" style={{ background: st ? STATUS_COLOR[st] : "#3e3f45" }} />
                <span className="text-[14px] truncate">{r.name}</span>
                <span className="font-mono text-[11.5px] text-muted">{r.id}</span>
                <span className="text-muted text-[12.5px] ml-auto shrink-0">{r.area_m2.toFixed(1)} m²</span>
                {n > 0 && <span className="text-[11px] font-mono font-bold rounded-[2px] bg-accent text-accent-ink px-1.5 min-w-5 text-center">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // site and outside: the whole project
  return <ProjectSummary plan={plan} pins={p.pins} states={states} stages={p.stages} setLevel={p.setLevel} onPinKind={p.onPinKind} />;
}

/** Share of a floor's elements in each status, for the progress bars. */
export function floorProgress(f: Floor, states: Map<string, ElementStatus>) {
  const ids = [...f.rooms, ...f.walls, ...f.openings, ...f.fixtures.filter((x) => x.kind !== "other")].map((x) => x.id);
  const c: Record<ElementStatus, number> = { not_built: 0, in_progress: 0, done: 0, existing: 0, demolish: 0 };
  for (const id of ids) { const s = states.get(id); if (s) c[s]++; }
  return { total: ids.length, c };
}

export function ProgressBar({ total, c }: { total: number; c: Record<ElementStatus, number> }) {
  return (
    <div className="h-2 w-full bg-panel-3 rounded-[1px] overflow-hidden flex">
      {(["done", "existing", "in_progress", "not_built", "demolish"] as ElementStatus[]).map((s) => c[s] ? <div key={s} style={{ width: `${(c[s] / total) * 100}%`, background: STATUS_COLOR[s] }} /> : null)}
    </div>
  );
}

export function ProjectSummary({ plan, pins, states, stages, setLevel, compact, onPinKind }: { plan: Plan; pins: Pin[]; states: Map<string, ElementStatus>; stages: JobStage[]; setLevel: (l: Level) => void; compact?: boolean; onPinKind?: (k: PinKind) => void }) {
  const floors = [...plan.floors].sort((a, b) => a.level - b.level);
  const open = pins.filter((x) => x.status !== "done");
  const current = stages.find((s) => s.status === "active");
  const done = stages.filter((s) => s.status === "done").length;
  const questions = plan.questions.filter((q) => !q.answer).length;
  return (
    <div className={compact ? "space-y-3" : "p-4 space-y-5"}>
      {!compact && <Head eyebrow="Whole project" title={`${floors.length} floor${floors.length === 1 ? "" : "s"}, ${floors.reduce((a, f) => a + f.rooms.length, 0)} rooms`} />}
      <div>
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="eyebrow">Stage</span>
          <span className="text-[14px] truncate">{current?.name ?? (stages.length && done === stages.length ? "All done" : "Not started")}</span>
          <span className="ml-auto font-mono text-[12px] text-muted">{done}/{stages.length}</span>
        </div>
        <StageStrip stages={stages} />
      </div>
      <div className="space-y-2">
        <p className="eyebrow">Floors</p>
        {floors.map((f) => {
          const pr = floorProgress(f, states);
          const n = open.filter((x) => x.floor_id === f.id || x.element_id?.startsWith(f.id + "-")).length;
          return (
            <button key={f.id} onClick={() => setLevel({ kind: "floor", floorId: f.id })} className="w-full text-left group">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-display font-bold uppercase tracking-[0.06em] text-[14px] group-hover:text-accent">{f.name}</span>
                <span className="text-muted text-[12px]">{f.rooms.length} rooms</span>
                {n > 0 && <span className="ml-auto font-mono text-[11.5px] text-accent">{n} open</span>}
              </div>
              <ProgressBar {...pr} />
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["task", "issue", "note", "material"] as const).map((k) => {
          const n = open.filter((x) => x.kind === k).length;
          return (
            <button key={k} type="button" onClick={() => onPinKind?.(k)} title={`Show the open ${PIN_LABEL[k].toLowerCase()}s`} className="chip hover:text-text hover:border-chalk">
              <span className="w-2 h-2 rounded-[1px]" style={{ background: PIN_COLOR[k] }} />{n} {PIN_LABEL[k].toLowerCase()}{n === 1 ? "" : "s"}
            </button>
          );
        })}
        {pins.some((x) => x.anchor?.view === "site") && <span className="chip">{pins.filter((x) => x.anchor?.view === "site").length} on the site</span>}
      </div>
      {questions > 0 && <p className="text-[13px] text-amber">{questions} question{questions > 1 ? "s" : ""} about the plan still open</p>}
    </div>
  );
}
