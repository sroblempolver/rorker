"use client";
// The zoomable job map: the whole site -> the outside of the building -> a floor -> a room -> one wall.
// Scroll or pinch past the zoom limit to step a level in or out, use the depth ladder on the left, or
// the breadcrumb. The parent owns which level is open.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobItem, Pin, PinInput } from "@/lib/data/types";
import { roomSides } from "@/lib/plan/geometry";
import type { ElementStatus, Plan } from "@/lib/plan/types";
import { ExteriorView, WallView } from "./Elevations";
import { FloorCanvas, type ColorMode } from "./FloorCanvas";
import { Plan3D, webglAvailable, type WallMode } from "./Plan3D";
import { SiteView } from "./SiteView";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "./style";
import type { PinTarget, ScreenPoint } from "./target";

export type Level =
  | { kind: "site" }
  | { kind: "exterior" }
  | { kind: "floor"; floorId: string }
  | { kind: "room"; floorId: string; roomId: string }
  | { kind: "wall"; floorId: string; roomId: string; sideKey: string };


interface Props {
  plan: Plan;
  level: Level;
  setLevel: (l: Level) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  selectedPin: string | null;
  onSelectPin: (id: string) => void;
  states: Map<string, ElementStatus>;
  pins: Pin[];
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  pinMode: boolean;
  setPinMode: (on: boolean) => void;
  onPlacePin: (t: PinTarget, at: ScreenPoint) => void;
  draft: PinTarget | null;
  flyTo: { ids: string[]; n: number } | null;
  onAllJobs: () => void;
  jobName: string;
  /** shown over the site view: the project at a glance */
  hud?: React.ReactNode;
  items: JobItem[];
  selectedItem: string | null;
  onSelectItem: (id: string) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onMovePin: (id: string, input: Partial<PinInput>) => void;
  /** move an object by dx, dy on the plan and dz up, mm */
  onMoveFixture: (id: string, dx: number, dy: number, dz: number) => void;
  view3d: boolean;
  setView3d: (on: boolean) => void;
  /** 3D is part of the premium plan; without it the toggle shows what it would unlock */
  can3d: boolean;
  /** a shared link: look only, no pin button, nothing moves, no "All jobs" */
  readOnly?: boolean;
}

const DEPTH: Level["kind"][] = ["site", "exterior", "floor", "room", "wall"];
const DEPTH_LABEL: Record<Level["kind"], string> = { site: "Site", exterior: "Outside", floor: "Floor", room: "Room", wall: "Wall" };

const glass = "bg-[#17181b]/90 backdrop-blur-sm border border-line";

export function PlanViewer(p: Props) {
  const { plan, level } = p;
  const floors = useMemo(() => [...plan.floors].sort((a, b) => a.level - b.level), [plan]);
  const floor = level.kind === "site" || level.kind === "exterior" ? null : floors.find((f) => f.id === level.floorId) ?? floors[0];
  const room = floor && (level.kind === "room" || level.kind === "wall") ? floor.rooms.find((r) => r.id === level.roomId) ?? null : null;
  const side = useMemo(() => (floor && room && level.kind === "wall" ? roomSides(floor, room).find((s) => s.key === level.sideKey) ?? null : null), [floor, room, level]);
  const ctl = useRef<{ zoomBy: (f: number) => void; home: () => void } | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [wallMode, setWallMode] = useState<WallMode>("full");
  const [empty, setEmpty] = useState(false);
  const [gl, setGl] = useState(true);
  useEffect(() => setGl(webglAvailable()), []);
  // a room always opens as its own top view, where every wall and object is a click away
  const in3d = p.view3d && p.can3d && gl && (level.kind === "exterior" || level.kind === "floor");
  // the wall view slides objects along its own wall: turn that into a move on the plan
  const moveOnWall = useCallback((id: string, along: number, up: number) => {
    if (!side) return;
    const ux = (side.b[0] - side.a[0]) / side.length, uy = (side.b[1] - side.a[1]) / side.length;
    p.onMoveFixture(id, Math.round(ux * along), Math.round(uy * along), up);
  }, [side, p]);
  const controls = useCallback((api: { zoomBy: (f: number) => void; home: () => void }) => { ctl.current = api; }, []);

  const up = useCallback(() => {
    if (level.kind === "wall") p.setLevel({ kind: "room", floorId: level.floorId, roomId: level.roomId });
    else if (level.kind === "room") p.setLevel({ kind: "floor", floorId: level.floorId });
    else if (level.kind === "floor") p.setLevel({ kind: "exterior" });
    else if (level.kind === "exterior") p.setLevel({ kind: "site" });
    else p.onAllJobs();
  }, [level, p]);

  const crumbs: { label: string; go?: () => void }[] = [
    ...(p.readOnly ? [] : [{ label: "All jobs", go: p.onAllJobs }]),
    { label: p.jobName, go: level.kind !== "site" ? () => p.setLevel({ kind: "site" }) : undefined },
  ];
  if (level.kind !== "site") crumbs.push({ label: "Outside", go: level.kind !== "exterior" ? () => p.setLevel({ kind: "exterior" }) : undefined });
  if (floor) crumbs.push({ label: floor.name, go: level.kind !== "floor" ? () => p.setLevel({ kind: "floor", floorId: floor.id }) : undefined });
  if (room) crumbs.push({ label: room.name, go: level.kind === "wall" ? () => p.setLevel({ kind: "room", floorId: floor!.id, roomId: room.id }) : undefined });
  if (side) crumbs.push({ label: side.label });

  // the depth ladder: jump straight to any level you have a context for
  const depth = DEPTH.indexOf(level.kind);
  const jump = (k: Level["kind"]) => {
    if (k === "site") return p.setLevel({ kind: "site" });
    if (k === "exterior") return p.setLevel({ kind: "exterior" });
    if (k === "floor") return p.setLevel({ kind: "floor", floorId: floor?.id ?? floors[0].id });
    if (k === "room" && floor && room) return p.setLevel({ kind: "room", floorId: floor.id, roomId: room.id });
  };

  const hint = p.pinMode ? "Click anywhere to drop the pin · Esc to cancel" :
    in3d && level.kind === "exterior" ? "Drag to look around · zoom in to open the building, keep zooming to step into a floor · right-click or Pin to flag the roof or a wall" :
    in3d && p.readOnly ? "Drag to look around · right-drag to slide · click a flag to see the task" :
    in3d ? "Drag to look around · click a room to see it from above · click an object to select, drag it to move · right-click to pin" :
    level.kind === "site" ? "The whole job · click the building or zoom in to go inside" :
    level.kind === "exterior" ? "Click a floor to go inside · zoom out for the whole site" :
    level.kind === "floor" ? "Click a room to step in · zoom out for the outside" :
    level.kind === "room" ? "Click anything to see it · pick a wall tag to face that wall" :
    "Click a wall piece, door, window or fixture · zoom out to go back";

  return (
    <div className={`relative w-full h-full overflow-hidden bg-ink ${p.pinMode ? "pin-cursor" : ""}`}>
      {level.kind === "site" && (
        <SiteView plan={plan} jobName={p.jobName} pins={p.pins} states={p.states} colorMode={p.colorMode} selectedPin={p.selectedPin} pinMode={p.pinMode} draft={p.draft}
          controls={controls} onOpenBuilding={() => p.setLevel({ kind: "exterior" })} onSelectPin={p.onSelectPin} onPlacePin={p.onPlacePin} onLimitOut={p.onAllJobs} />
      )}
      {level.kind === "exterior" && !in3d && (
        <ExteriorView plan={plan} pins={p.pins} selectedPin={p.selectedPin} pinMode={p.pinMode} draft={p.draft} controls={controls} onSelectPin={p.onSelectPin} onPlacePin={p.onPlacePin}
          onOpenFloor={(id) => p.setLevel({ kind: "floor", floorId: id })} onLimitOut={() => p.setLevel({ kind: "site" })} />
      )}
      {in3d && (
        <Plan3D plan={plan} mode={level.kind === "exterior" ? "building" : "floor"} floor={floor} room={room} selected={p.selected} selectedPin={p.selectedPin} selectedItem={p.selectedItem}
          states={p.states} colorMode={p.colorMode} pins={p.pins} items={p.items} pinMode={p.pinMode} draft={p.draft} wallMode={wallMode} empty={empty} controls={controls}
          onSelect={(id) => { const r = floor && id ? floor.rooms.find((x) => x.id === id) : null; if (r && floor) p.setLevel({ kind: "room", floorId: floor.id, roomId: r.id }); p.onSelect(id); }}
          onSelectPin={p.onSelectPin} onSelectItem={p.onSelectItem} onPlacePin={p.onPlacePin}
          onMoveFixture={(id, dx, dy) => p.onMoveFixture(id, dx, dy, 0)} onMoveItem={p.onMoveItem} onMovePin={p.onMovePin}
          onOpenFloor={(id) => p.setLevel({ kind: "floor", floorId: id })} onLimitOut={up} />
      )}
      {floor && !in3d && (level.kind === "floor" || level.kind === "room") && (
        <FloorCanvas
          plan={plan} floor={floor} room={room} selected={p.selected} selectedPin={p.selectedPin} states={p.states} pins={p.pins}
          colorMode={p.colorMode} pinMode={p.pinMode} flyTo={p.flyTo} controls={controls} draft={p.draft}
          onSelect={p.onSelect} onSelectPin={p.onSelectPin} onUp={up}
          onOpenRoom={(id) => p.setLevel({ kind: "room", floorId: floor.id, roomId: id })}
          onOpenSide={(s) => p.setLevel({ kind: "wall", floorId: floor.id, roomId: s.roomId, sideKey: s.key })}
          onPlacePin={p.onPlacePin}
          items={p.items} showItems={showItems} selectedItem={p.selectedItem} onSelectItem={p.onSelectItem} onMovePin={p.onMovePin}
          onMoveFixture={(id, dx, dy) => p.onMoveFixture(id, dx, dy, 0)}
        />
      )}
      {floor && room && side && level.kind === "wall" && (
        <WallView
          floor={floor} room={room} side={side} selected={p.selected} selectedPin={p.selectedPin} states={p.states} pins={p.pins} colorMode={p.colorMode}
          pinMode={p.pinMode} draft={p.draft} controls={controls} onSelect={p.onSelect} onSelectPin={p.onSelectPin} onUp={up} onPlacePin={p.onPlacePin}
          items={p.items.filter((i) => i.side === side.key)} selectedItem={p.selectedItem} onSelectItem={p.onSelectItem} onMoveItem={p.onMoveItem} onMovePin={p.onMovePin}
          onMoveFixture={moveOnWall}
        />
      )}

      {/* breadcrumb */}
      <nav className="absolute left-3 top-3 right-3 sm:right-auto flex items-center flex-wrap gap-1 pointer-events-none" aria-label="Where you are">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1 pointer-events-auto">
            {i > 0 && <span className="text-[#5d5a53] text-xs">/</span>}
            {c.go ? (
              <button onClick={c.go} className={`h-7 px-2.5 rounded-[3px] ${glass} text-[13px] text-muted hover:text-text font-display font-semibold tracking-[0.06em] uppercase`}>{c.label}</button>
            ) : (
              <span className="h-7 px-2.5 rounded-[3px] bg-accent text-accent-ink text-[13px] font-display font-extrabold tracking-[0.06em] uppercase inline-flex items-center">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* depth ladder */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-stretch" aria-label="Zoom level">
        {DEPTH.map((k, i) => {
          const can = k === "site" || k === "exterior" || k === "floor" || (k === "room" && !!room) || (k === "wall" && !!side);
          const on = i === depth;
          return (
            <button key={k} disabled={!can || on} onClick={() => jump(k)}
              className={`group flex items-center gap-2 h-8 pl-1 pr-2 text-left ${can && !on ? "cursor-pointer" : "cursor-default"}`}>
              <span className={`w-2.5 h-2.5 rotate-45 border ${on ? "bg-accent border-accent" : i < depth ? "bg-[#5d5a53] border-[#5d5a53]" : can ? "border-[#77736a]" : "border-[#3e3f45]"}`} />
              <span className={`font-display text-[12px] font-bold tracking-[0.14em] uppercase ${on ? "text-accent" : can ? "text-muted group-hover:text-text" : "text-[#4a4842]"}`}>{DEPTH_LABEL[k]}</span>
            </button>
          );
        })}
      </div>

      {/* floor switcher */}
      {floor && level.kind === "floor" && floors.length > 1 && (
        <div className={`absolute left-3 top-14 md:left-1/2 md:-translate-x-1/2 md:top-3 flex gap-1 p-1 rounded-[4px] ${glass}`}>
          {floors.map((f) => (
            <button key={f.id} onClick={() => p.setLevel({ kind: "floor", floorId: f.id })} className={`h-7 px-2.5 rounded-[3px] text-[13px] font-display font-bold tracking-[0.06em] uppercase ${f.id === floor.id ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}>{f.name}</button>
          ))}
        </div>
      )}

      {/* colour mode, 2D / 3D, and what to show */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        <div className="flex gap-1.5">
          {(level.kind === "exterior" || level.kind === "floor" || level.kind === "room") && (
            <div className={`flex rounded-[4px] overflow-hidden ${glass}`} role="group" aria-label="2D or 3D">
              {([false, true] as const).map((on) => (
                <button key={String(on)} onClick={() => p.setView3d(on)} aria-pressed={p.view3d === on} disabled={on && (!p.can3d || !gl)}
                  title={on && !p.can3d ? "3D is part of the Pro plan" : on && !gl ? "This browser can't show 3D" : undefined}
                  className={`h-8 px-3 text-[13px] font-display font-bold tracking-[0.08em] uppercase inline-flex items-center gap-1.5 ${p.view3d === on ? "bg-panel-3 text-text" : "text-muted hover:text-text"} disabled:opacity-60`}>
                  {on ? "3D" : "2D"}{on && <span className="text-[9.5px] px-1 rounded-[2px] bg-accent text-accent-ink leading-[14px]">PRO</span>}
                </button>
              ))}
            </div>
          )}
          <div className={`hidden sm:flex rounded-[4px] overflow-hidden ${glass}`}>
            {(["type", "progress"] as const).map((m) => (
              <button key={m} onClick={() => p.setColorMode(m)} className={`h-8 px-3 text-[13px] font-display font-bold tracking-[0.08em] uppercase ${p.colorMode === m ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}>{m === "type" ? "Materials" : "Progress"}</button>
            ))}
          </div>
        </div>
        {in3d && (
          <div className="flex gap-1.5">
            <div className={`flex rounded-[4px] overflow-hidden ${glass}`} role="group" aria-label="Walls">
              {(["full", "low", "none"] as const).map((m) => (
                <button key={m} onClick={() => setWallMode(m)} aria-pressed={wallMode === m} title={m === "none" ? "Hide the walls to see everything inside" : undefined}
                  className={`h-7 px-2.5 text-[12px] font-display font-bold tracking-[0.08em] uppercase ${wallMode === m ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}>{m === "full" ? "Walls" : m === "low" ? "Low walls" : "No walls"}</button>
              ))}
            </div>
            <button onClick={() => setEmpty(!empty)} aria-pressed={empty} title="Hide the cabinets, appliances, furniture and wall items: just the rooms"
              className={`h-7 px-2.5 rounded-[4px] text-[12px] font-display font-bold tracking-[0.08em] uppercase ${glass} ${empty ? "!border-accent text-text" : "text-muted hover:text-text"}`}>Empty rooms</button>
          </div>
        )}
        {!in3d && (level.kind === "floor" || level.kind === "room") && p.items.length > 0 && (
          <button onClick={() => setShowItems(!showItems)} aria-pressed={showItems} title="Outlets, switches and other small things on the walls"
            className={`h-7 px-2.5 rounded-[4px] text-[12px] font-display font-bold tracking-[0.08em] uppercase ${glass} ${showItems ? "!border-accent text-text" : "text-muted hover:text-text"}`}>
            {showItems ? "Hide" : "Show"} outlets & switches
          </button>
        )}
      </div>

      {p.hud && level.kind === "site" && <div className="absolute left-3 top-14 md:left-28 hidden sm:block">{p.hud}</div>}

      {/* tools */}
      <div className="absolute right-3 bottom-3 flex flex-col items-end gap-1.5">
        {!p.readOnly && <button onClick={() => p.setPinMode(!p.pinMode)} title="Pick up a pin: your cursor becomes a pin, click anywhere to drop it (right-click or press and hold works too)" aria-pressed={p.pinMode}
          className={`self-end h-10 rounded-[4px] border inline-flex items-center gap-1.5 px-3 font-display font-bold tracking-[0.08em] uppercase text-[13px] ${p.pinMode ? "bg-accent border-accent text-accent-ink" : `${glass} text-text hover:bg-panel-3`}`}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 22V3" /><path d="M6 3h12l-3 4 3 4H6" fill="currentColor" /></svg>
          {p.pinMode ? "Cancel" : "Pin"}
        </button>}
        <button onClick={() => ctl.current?.zoomBy(1.4)} title="Zoom in" className={`hidden sm:block w-10 h-10 rounded-[4px] ${glass} hover:bg-panel-3 text-lg`}>+</button>
        <button onClick={() => ctl.current?.zoomBy(1 / 1.4)} title="Zoom out" className={`hidden sm:block w-10 h-10 rounded-[4px] ${glass} hover:bg-panel-3 text-lg`}>−</button>
        <button onClick={() => ctl.current?.home()} title="Fit to screen" className={`w-10 h-10 rounded-[4px] ${glass} hover:bg-panel-3 grid place-items-center`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
        {level.kind !== "site" && (
          <button onClick={up} title="Step out" className={`w-10 h-10 rounded-[4px] ${glass} hover:bg-panel-3 grid place-items-center`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </div>

      {/* hints and legend */}
      <div className="absolute left-3 bottom-3 flex flex-col gap-2 items-start max-w-[calc(100%-80px)] pointer-events-none">
        {p.colorMode === "progress" && level.kind !== "exterior" && (
          <div className={`flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 rounded-[4px] ${glass} text-[12px]`}>
            {STATUS_ORDER.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[1px]" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>)}
          </div>
        )}
        <div className={`chip !rounded-[3px] ${glass} ${p.pinMode ? "!text-accent !border-accent" : "hidden sm:inline-flex"}`}>{hint}</div>
      </div>
    </div>
  );
}
