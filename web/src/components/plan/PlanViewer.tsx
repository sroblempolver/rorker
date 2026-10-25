"use client";
// The zoomable plan: outside of the building -> a floor -> a room -> one wall. Scroll or pinch past the
// zoom limit to step a level in or out, or use the breadcrumb. The parent owns which level is open.
import { useCallback, useMemo, useRef } from "react";
import type { Pin } from "@/lib/data/types";
import { roomSides, type WallSide } from "@/lib/plan/geometry";
import type { ElementStatus, Plan } from "@/lib/plan/types";
import { ExteriorView, WallView } from "./Elevations";
import { FloorCanvas, type ColorMode } from "./FloorCanvas";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "./style";

export type Level =
  | { kind: "exterior" }
  | { kind: "floor"; floorId: string }
  | { kind: "room"; floorId: string; roomId: string }
  | { kind: "wall"; floorId: string; roomId: string; sideKey: string };

export const HEADING_LABEL = (h: WallSide["heading"]) => `${h[0].toUpperCase()}${h.slice(1)} wall`;

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
  onPlacePin: (floorId: string, x: number | null, y: number | null, elementId: string | null) => void;
  flyTo: { ids: string[]; n: number } | null;
  onAllJobs: () => void;
  jobName: string;
}

export function PlanViewer(p: Props) {
  const { plan, level } = p;
  const floors = useMemo(() => [...plan.floors].sort((a, b) => a.level - b.level), [plan]);
  const floor = level.kind === "exterior" ? null : floors.find((f) => f.id === level.floorId) ?? floors[0];
  const room = floor && (level.kind === "room" || level.kind === "wall") ? floor.rooms.find((r) => r.id === level.roomId) ?? null : null;
  const side = useMemo(() => (floor && room && level.kind === "wall" ? roomSides(floor, room).find((s) => s.key === level.sideKey) ?? null : null), [floor, room, level]);
  const ctl = useRef<{ zoomBy: (f: number) => void; home: () => void } | null>(null);
  const controls = useCallback((api: { zoomBy: (f: number) => void; home: () => void }) => { ctl.current = api; }, []);

  const up = useCallback(() => {
    if (level.kind === "wall") p.setLevel({ kind: "room", floorId: level.floorId, roomId: level.roomId });
    else if (level.kind === "room") p.setLevel({ kind: "floor", floorId: level.floorId });
    else if (level.kind === "floor") p.setLevel({ kind: "exterior" });
    else p.onAllJobs();
  }, [level, p]);

  const crumbs: { label: string; go?: () => void }[] = [{ label: "All jobs", go: p.onAllJobs }, { label: p.jobName, go: level.kind !== "exterior" ? () => p.setLevel({ kind: "exterior" }) : undefined }];
  if (floor) crumbs.push({ label: floor.name, go: level.kind !== "floor" ? () => p.setLevel({ kind: "floor", floorId: floor.id }) : undefined });
  if (room) crumbs.push({ label: room.name, go: level.kind === "wall" ? () => p.setLevel({ kind: "room", floorId: floor!.id, roomId: room.id }) : undefined });
  if (side) crumbs.push({ label: HEADING_LABEL(side.heading) });

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0f141a]">
      {level.kind === "exterior" && (
        <ExteriorView plan={plan} controls={controls} onOpenFloor={(id) => p.setLevel({ kind: "floor", floorId: id })} onLimitIn={() => floors[0] && p.setLevel({ kind: "floor", floorId: floors[0].id })} />
      )}
      {floor && (level.kind === "floor" || level.kind === "room") && (
        <FloorCanvas
          plan={plan} floor={floor} room={room} selected={p.selected} selectedPin={p.selectedPin} states={p.states} pins={p.pins}
          colorMode={p.colorMode} pinMode={p.pinMode} flyTo={p.flyTo} controls={controls}
          onSelect={p.onSelect} onSelectPin={p.onSelectPin} onUp={up}
          onOpenRoom={(id) => p.setLevel({ kind: "room", floorId: floor.id, roomId: id })}
          onOpenSide={(s) => p.setLevel({ kind: "wall", floorId: floor.id, roomId: s.roomId, sideKey: s.key })}
          onPlacePin={(x, y, id) => p.onPlacePin(floor.id, x, y, id)}
        />
      )}
      {floor && side && level.kind === "wall" && (
        <WallView
          floor={floor} side={side} selected={p.selected} selectedPin={p.selectedPin} states={p.states} pins={p.pins} colorMode={p.colorMode}
          pinMode={p.pinMode} controls={controls} onSelect={p.onSelect} onSelectPin={p.onSelectPin} onUp={up}
          onPlacePin={(x, y, id) => p.onPlacePin(floor.id, x, y, id)}
        />
      )}

      {/* breadcrumb */}
      <nav className="absolute left-3 top-3 right-3 sm:right-auto flex items-center flex-wrap gap-1 pointer-events-none" aria-label="Where you are">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1 pointer-events-auto">
            {i > 0 && <span className="text-[#4b5562]">›</span>}
            {c.go ? (
              <button onClick={c.go} className="h-7 px-2.5 rounded-md bg-[#161b22]/90 border border-line text-[12.5px] text-muted hover:text-text font-display tracking-wide">{c.label}</button>
            ) : (
              <span className="h-7 px-2.5 rounded-md bg-accent text-accent-ink text-[12.5px] font-display font-semibold tracking-wide inline-flex items-center">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* floor switcher */}
      {floor && level.kind === "floor" && floors.length > 1 && (
        <div className="absolute left-3 top-14 flex gap-1 p-1 rounded-lg bg-[#161b22]/90 border border-line">
          {floors.map((f) => (
            <button key={f.id} onClick={() => p.setLevel({ kind: "floor", floorId: f.id })} className={`h-7 px-2.5 rounded-md text-[12px] font-display tracking-wide ${f.id === floor.id ? "bg-panel-3 text-text" : "text-muted hover:text-text"}`}>{f.name}</button>
          ))}
        </div>
      )}

      {/* tools */}
      <div className="absolute right-3 top-3 hidden sm:flex flex-col gap-2 items-end">
        <div className="flex rounded-lg overflow-hidden border border-line bg-[#161b22]/90">
          <button onClick={() => p.setColorMode("type")} className={`h-8 px-3 text-[12px] font-display tracking-wide ${p.colorMode === "type" ? "bg-panel-3 text-text" : "text-muted"}`}>Rooms</button>
          <button onClick={() => p.setColorMode("progress")} className={`h-8 px-3 text-[12px] font-display tracking-wide ${p.colorMode === "progress" ? "bg-panel-3 text-text" : "text-muted"}`}>Progress</button>
        </div>
      </div>
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
        {level.kind !== "exterior" && (
          <button onClick={() => p.setPinMode(!p.pinMode)} title="Drop a pin" aria-pressed={p.pinMode}
            className={`w-10 h-10 rounded-lg border grid place-items-center ${p.pinMode ? "bg-accent border-accent text-accent-ink" : "bg-[#161b22]/90 border-line text-text hover:bg-panel-3"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>
          </button>
        )}
        <button onClick={() => ctl.current?.zoomBy(1.4)} title="Zoom in" className="hidden sm:block w-10 h-10 rounded-lg border border-line bg-[#161b22]/90 hover:bg-panel-3 text-lg">+</button>
        <button onClick={() => ctl.current?.zoomBy(1 / 1.4)} title="Zoom out" className="hidden sm:block w-10 h-10 rounded-lg border border-line bg-[#161b22]/90 hover:bg-panel-3 text-lg">−</button>
        <button onClick={() => ctl.current?.home()} title="Fit to screen" className="w-10 h-10 rounded-lg border border-line bg-[#161b22]/90 hover:bg-panel-3 grid place-items-center">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
        {level.kind !== "exterior" && (
          <button onClick={up} title="Step out" className="w-10 h-10 rounded-lg border border-line bg-[#161b22]/90 hover:bg-panel-3 grid place-items-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </div>

      {/* hints and legend */}
      <div className="absolute left-3 bottom-3 flex flex-col gap-2 items-start max-w-[calc(100%-80px)]">
        {p.colorMode === "progress" && level.kind !== "exterior" && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 rounded-lg bg-[#161b22]/90 border border-line text-[12px]">
            {STATUS_ORDER.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>)}
          </div>
        )}
        <div className="chip bg-[#161b22]/90">
          {p.pinMode ? "Click anywhere to drop the pin" :
            level.kind === "exterior" ? "Click a floor to go inside" :
            level.kind === "floor" ? "Click a room to step in · scroll out for the outside" :
            level.kind === "room" ? "Click anything to see it · pick a wall to face it" :
            "Click a wall piece, door or window · scroll out to go back"}
        </div>
      </div>
    </div>
  );
}
