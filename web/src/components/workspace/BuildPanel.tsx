"use client";
// Build mode, like a sim game's: pick a tool, then the map. Put a door or window in a wall, move a wall
// to make a room bigger, cut a room in two, and change the size of any door or window. Every change is
// an edit on top of the drawing (Undo, or "Put back as drawn", always works). Under the tools sit the
// plan's own things: the reader's questions, a new drawing, and talking to the plan.
import type { ElementEdit } from "@/lib/data/types";
import type { Floor, Opening, Plan, Room } from "@/lib/plan/types";
import type { BuildSide } from "@/lib/plan/house";
import { DOOR_KINDS, WIDTHS, WIN, doorHeight } from "@/lib/plan/standard";
import { fmtLen, type Units } from "@/lib/plan/units";
import { Len } from "@/components/newjob/WallView";

export type BuildTool = "pick" | "door" | "window" | "wall" | "split";
export const BUILD_TOOLS: { id: BuildTool; label: string; key: string; help: string }[] = [
  { id: "pick", label: "Pick", key: "v", help: "Click a door, window or room to change it. Drag any wall to move it." },
  { id: "door", label: "Door", key: "d", help: "Click a wall to put a door in it." },
  { id: "window", label: "Window", key: "w", help: "Click an outside wall to put a window in it." },
  { id: "wall", label: "Move wall", key: "m", help: "Drag a wall out or in, or drag its ends. Right-click a wall to cut it in two." },
  { id: "split", label: "Split room", key: "s", help: "Click in a room where the new wall goes. It runs straight across." },
];
/** how far one tap of a nudge button goes: 6 inches */
const STEP = 152.4;
const UNITS: Units = "ft";

function Icon({ tool }: { tool: BuildTool }) {
  const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tool === "pick") return <svg {...p}><path d="M5 3l14 8-6 2-2 6z" /></svg>;
  if (tool === "door") return <svg {...p}><path d="M3 21h18" /><path d="M6 21V4h9v17" /><path d="M15 4l3 2v15" /><circle cx="12.5" cy="12.5" r=".6" fill="currentColor" /></svg>;
  if (tool === "window") return <svg {...p}><rect x="4" y="4" width="16" height="16" /><path d="M12 4v16M4 12h16" /></svg>;
  if (tool === "wall") return <svg {...p}><path d="M4 4v16M10 4v16" /><path d="M14 12h7M18 9l3 3-3 3" /></svg>;
  return <svg {...p}><rect x="3" y="5" width="18" height="14" /><path d="M12 5v14" strokeDasharray="2 2.5" /></svg>;
}

export interface SidePick { room: Room; side: BuildSide; by: number }

export function BuildPanel({ plan, floor, tool, setTool, doorKind, setDoorKind, selected, edits, side, onSave, onRemove, onNudge, onSetBy, onSplit, onJoin, onJoinWall, onDone, children }: {
  plan: Plan; floor: Floor | null; tool: BuildTool; setTool: (t: BuildTool) => void;
  doorKind: string; setDoorKind: (k: string) => void;
  selected: string | null; edits: Record<string, ElementEdit>;
  /** the wall picked with Move wall */
  side: SidePick | null;
  onSave: (id: string, patch: ElementEdit | null) => void;
  onRemove: (o: Opening) => void;
  onNudge: (by: number) => void; onSetBy: (by: number) => void;
  onSplit: (room: Room) => void; onJoin: (room: Room) => void;
  /** put the pieces of a cut wall back together */
  onJoinWall: (side: BuildSide) => void;
  onDone: () => void;
  children?: React.ReactNode;
}) {
  const help = BUILD_TOOLS.find((t) => t.id === tool)!.help;
  const opening = selected && floor ? floor.openings.find((o) => o.id === selected) ?? null : null;
  const room = !opening && selected && floor ? floor.rooms.find((r) => r.id === selected) ?? null : null;
  const m = (mm: number) => fmtLen(mm, UNITS);

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <p className="eyebrow text-accent">Build mode</p>
          <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Change the house</h2>
        </div>
        <button className="btn btn-primary btn-sm ml-auto" onClick={onDone} title="Back to the job (B)">Done</button>
      </div>

      <div>
        <div className="grid grid-cols-5 gap-1" role="toolbar" aria-label="Build tools">
          {BUILD_TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)} aria-pressed={tool === t.id} title={`${t.label} (${t.key.toUpperCase()})`}
              className={`h-[60px] rounded-[4px] border flex flex-col items-center justify-center gap-1 text-[11.5px] font-display font-bold tracking-[0.06em] uppercase leading-none ${tool === t.id ? "bg-accent border-accent text-accent-ink" : "border-line text-muted hover:text-text hover:bg-panel-2"}`}>
              <Icon tool={t.id} />{t.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted mt-2">{floor ? help : "Open a floor to change its walls, doors and windows."}</p>
      </div>

      {tool === "door" && (
        <div>
          <p className="eyebrow mb-2">Kind of door</p>
          <div className="flex flex-wrap gap-1.5">
            {DOOR_KINDS.map(([k, label]) => (
              <button key={k} onClick={() => setDoorKind(k)} aria-pressed={doorKind === k}
                className={`chip !h-8 !text-[13px] ${doorKind === k ? "!bg-accent !text-accent-ink !border-accent" : "hover:text-text"}`}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {opening && <OpeningCard key={opening.id} o={opening} edit={edits[opening.id]} m={m} onSave={(p) => onSave(opening.id, p)} onRemove={() => onRemove(opening)} />}

      {side && (
        <div className="card p-4 space-y-3">
          <div>
            <p className="eyebrow">Move wall</p>
            <p className="font-display text-[19px] font-bold uppercase leading-tight">{side.side.label} · {side.room.name}</p>
            <p className="text-[13px] text-muted">{m(side.side.length)} long. Drag it on the map, or push it out to make the {side.room.name.toLowerCase()} bigger, in to make it smaller. Drag its ends to make it longer or shorter.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn flex-1" onClick={() => onNudge(-STEP)} title="Move it into the room">‹ In</button>
            <span className="font-mono text-[14px] w-[96px] text-center">{side.by ? `${side.by > 0 ? "+" : "−"}${m(Math.abs(side.by))}` : "as drawn"}</span>
            <button className="btn flex-1" onClick={() => onNudge(STEP)} title="Move it out of the room">Out ›</button>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <Len label={side.by < 0 ? "Moved in by" : "Moved out by"} mm={Math.abs(side.by)} units={UNITS} onStart={() => {}} onSet={(v) => onSetBy(side.by < 0 ? -v : v)} />
            {side.by !== 0 && <button className="btn btn-ghost btn-sm ml-auto" onClick={() => onSetBy(0)}>Put back</button>}
          </div>
          <p className="text-[12px] text-muted">The {side.room.name.toLowerCase()} is {fmtArea(side.room.area_m2)} now{side.by ? ", and the room next door changed with it" : ""}.</p>
          {side.side.cutA || side.side.cutB ? (
            <div className="flex items-center gap-2 border-t border-line pt-3">
              <p className="text-[12.5px] text-muted flex-1">This is a piece of a longer wall, cut so it moves on its own.</p>
              {!side.by && <button className="btn btn-ghost btn-sm" onClick={() => onJoinWall(side.side)}>Join it back</button>}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted border-t border-line pt-3">Only want part of it to move? Right-click the wall where it should come apart.</p>
          )}
        </div>
      )}

      {room && !side && (
        <div className="card p-4 space-y-3">
          <div>
            <p className="eyebrow">Room · {fmtArea(room.area_m2)}</p>
            <input key={room.id} className="input !text-[16px] font-medium mt-1" defaultValue={room.name} aria-label="Room name"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== room.name) onSave(room.id, { name: v }); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
          </div>
          <div className="flex flex-wrap gap-2">
            {edits[room.id]?.split ? <button className="btn btn-sm" onClick={() => onJoin(room)}>Join the two halves back</button>
              : !room.id.endsWith("b") || !edits[room.id.slice(0, -1)]?.split ? <button className="btn btn-sm" onClick={() => onSplit(room)}>Split in two</button> : <button className="btn btn-sm" onClick={() => onJoin(room)}>Join back with the other half</button>}
            <button className="btn btn-sm" onClick={() => setTool("wall")}>Move a wall</button>
          </div>
        </div>
      )}

      {!opening && !side && !room && floor && tool === "pick" && (
        <p className="text-[13px] text-muted">{floor.name}: {floor.rooms.length} rooms, {floor.openings.filter((o) => o.kind !== "window").length} doors and openings, {floor.openings.filter((o) => o.kind === "window").length} windows. Changes show in 2D and 3D straight away.</p>
      )}

      {children && <div className="border-t border-line pt-4 -mx-4">{children}</div>}
      {!plan.floors.length && <p className="text-muted">No floors yet.</p>}
    </div>
  );
}

function fmtArea(m2: number) { return `${Math.round(m2 * 10.7639)} ft²`; }

function OpeningCard({ o, edit, m, onSave, onRemove }: { o: Opening; edit: ElementEdit | undefined; m: (mm: number) => string; onSave: (p: ElementEdit | null) => void; onRemove: () => void }) {
  const win = o.kind === "window";
  const widths = WIDTHS[o.kind] ?? WIDTHS.door;
  const height = o.height_mm ?? (win ? WIN.height : doorHeight(o.kind));
  const added = !!edit?.opening;
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{win ? "Window" : "Door"} · {o.exterior ? "outside wall" : "inside wall"}</p>
          <p className="font-display text-[19px] font-bold uppercase leading-tight truncate">{o.name}</p>
        </div>
        {!win && (
          <select className="input !h-8 !w-auto ml-auto" value={o.kind} aria-label="Kind of door" onChange={(e) => onSave({ kind: e.target.value, width: undefined })}>
            {DOOR_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        )}
      </div>
      <div>
        <p className="text-[13px] text-muted mb-1.5">Width</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {widths.map((w) => (
            <button key={w} onClick={() => onSave({ width: w })} aria-pressed={Math.abs(o.width_mm - w) < 5}
              className={`chip !h-8 !text-[13px] font-mono ${Math.abs(o.width_mm - w) < 5 ? "!bg-accent !text-accent-ink !border-accent" : "hover:text-text"}`}>{m(w)}</button>
          ))}
          <span className="text-[13px]"><Len label="" mm={o.width_mm} units={UNITS} onStart={() => {}} onSet={(v) => v >= 300 && onSave({ width: v })} /></span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
        <Len label="Height" mm={height} units={UNITS} onStart={() => {}} onSet={(v) => v >= 300 && onSave({ height_mm: v })} />
        {win && <Len label="Off the floor" mm={o.sill_mm ?? WIN.sill} units={UNITS} onStart={() => {}} onSet={(v) => onSave({ sill_mm: v })} />}
      </div>
      <div>
        <p className="text-[13px] text-muted mb-1.5">Slide along the wall</p>
        <div className="flex gap-2">
          <button className="btn btn-sm flex-1" onClick={() => onSave({ slide: (edit?.slide ?? 0) - STEP })}>‹ 6&quot;</button>
          <button className="btn btn-sm flex-1" onClick={() => onSave({ slide: (edit?.slide ?? 0) - STEP * 4 })}>‹ 2&apos;</button>
          <button className="btn btn-sm flex-1" onClick={() => onSave({ slide: (edit?.slide ?? 0) + STEP * 4 })}>2&apos; ›</button>
          <button className="btn btn-sm flex-1" onClick={() => onSave({ slide: (edit?.slide ?? 0) + STEP })}>6&quot; ›</button>
        </div>
      </div>
      <div className="flex gap-2">
        {!added && edit && Object.keys(edit).length > 0 && !edit.removed && <button className="btn btn-ghost btn-sm" onClick={() => onSave(null)}>Put back as drawn</button>}
        <button className="btn btn-ghost btn-sm text-red ml-auto" onClick={onRemove}>Take it out</button>
      </div>
    </div>
  );
}
