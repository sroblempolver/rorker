"use client";
// The company's library in the side panel: saved rooms to drop onto the plan (the room follows the
// pointer and snaps to the walls beside it, like a moved room; click to put it down) and saved houses
// to start a drawing from. "Save to library" on a picked room, "Save this drawing" here.
import { useState } from "react";
import type { Pt } from "@/lib/plan/types";
import type { Sketch, SketchFloor } from "@/lib/plan/sketch";
import { pieceSize, removeFromLibrary, saveToLibrary, useLibrary, type LibItem, type Piece } from "@/lib/plan/library";
import { fmtLen, type Units } from "@/lib/plan/units";

/** A saved room following the pointer until it's put down. */
export function usePlacing({ snap }: { snap: (xs: number[], ys: number[]) => Pt }) {
  const [placing, setPlacing] = useState<{ item: LibItem; piece: Piece; at: Pt | null } | null>(null);
  const start = (item: LibItem) => item.piece && setPlacing({ item, piece: item.piece, at: null });
  const moveTo = (p: Pt) => {
    if (!placing) return;
    const [w, h] = pieceSize(placing.piece);
    const tl: Pt = [p[0] - w / 2, p[1] - h / 2];
    // its edges snap onto the walls beside it (or the grid), like a moved room
    const [dx, dy] = snap([tl[0], tl[0] + w], [tl[1], tl[1] + h]);
    setPlacing({ ...placing, at: [tl[0] + dx, tl[1] + dy] });
  };
  const ghost = (px: number) => {
    if (!placing?.at) return null;
    const [x, y] = placing.at, P = placing.piece;
    return (
      <g style={{ pointerEvents: "none" }} transform={`translate(${x} ${y})`}>
        {P.rooms.map((r, i) => <polygon key={i} points={r.polygon.map((q) => q.join(",")).join(" ")} fill="#ff6a1f" fillOpacity={0.15} stroke="#ff6a1f" strokeWidth={2 * px} strokeDasharray={`${6 * px} ${4 * px}`} />)}
        {(P.fixtures ?? []).map((f, i) => {
          const across = f.facing === "east" || f.facing === "west";
          const w = (across ? f.depth_mm : f.width_mm) ?? 600, d = (across ? f.width_mm : f.depth_mm) ?? 600;
          return <rect key={`f${i}`} x={f.center[0] - w / 2} y={f.center[1] - d / 2} width={w} height={d} fill="#f4efe6" fillOpacity={0.5} stroke="#ff6a1f" strokeWidth={px} />;
        })}
      </g>
    );
  };
  return { placing, start, moveTo, ghost, stop: () => setPlacing(null) };
}

export function LibraryPanel({ sk, floor, units, placingId, onPlace, onStart }: {
  sk: Sketch; floor: SketchFloor; units: Units; placingId: string | null;
  onPlace: (item: LibItem) => void; onStart: (sketch: Sketch, name: string) => void;
}) {
  const items = useLibrary();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const rooms = items.filter((x) => x.kind === "room"), houses = items.filter((x) => x.kind === "house");
  const size = (it: LibItem) => { if (!it.piece) return ""; const [w, h] = pieceSize(it.piece); return `${fmtLen(w, units)} × ${fmtLen(h, units)}`; };
  const drawn = sk.floors.some((f) => f.rooms.length);
  const del = (it: LibItem) => !it.starter && <button className="text-muted hover:text-red px-1" onClick={() => removeFromLibrary(it.id)} aria-label={`Delete ${it.name}`} title="Delete from the library">✕</button>;

  return (
    <div className="space-y-2 pt-1 border-t border-line">
      <button className="eyebrow pt-2 w-full text-left flex items-center" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        Library <span className="ml-auto text-muted normal-case tracking-normal">{open ? "Hide" : `${items.length} saved`}</span>
      </button>
      {open && <>
        <p className="text-muted leading-snug">Rooms and houses your company uses again and again. Pick a room, then click on the plan where it goes.</p>
        <p className="label !mb-1">Rooms</p>
        <ul className="space-y-1">
          {rooms.map((it) => (
            <li key={it.id} className="flex items-center gap-1">
              <button onClick={() => onPlace(it)} title={it.note ?? "Put it on the plan"}
                className={`chip !h-auto py-1 flex-1 text-left leading-snug ${placingId === it.id ? "!text-accent !border-accent" : ""}`}>
                <span className="block">{it.name}</span>
                <span className="block text-[11.5px] text-muted">{it.note ?? size(it)}</span>
              </button>
              {del(it)}
            </li>
          ))}
        </ul>
        <p className="label !mb-1 pt-1">Houses</p>
        <ul className="space-y-1">
          {houses.map((it) => (
            <li key={it.id} className="flex items-center gap-1">
              {asked === it.id ? (
                <span className="flex-1 text-[12.5px]">Start over from {it.name}? <button className="underline text-accent" onClick={() => { setAsked(null); onStart(it.sketch!, it.name); }}>Yes</button> · <button className="underline" onClick={() => setAsked(null)}>No</button></span>
              ) : (
                <button onClick={() => (drawn ? setAsked(it.id) : onStart(it.sketch!, it.name))} title="Start a new drawing from it"
                  className="chip !h-auto py-1 flex-1 text-left leading-snug">
                  <span className="block">{it.name}</span>
                  <span className="block text-[11.5px] text-muted">{it.note ?? `${it.sketch?.floors.reduce((n, f) => n + f.rooms.length, 0)} rooms`}</span>
                </button>
              )}
              {del(it)}
            </li>
          ))}
        </ul>
        {naming == null ? (
          <button className="btn btn-sm btn-ghost w-full" disabled={!drawn} onClick={() => setNaming(sk.building_name || floor.name || "My house")}>Save this drawing to the library</button>
        ) : (
          <div className="flex gap-1">
            <input className="input !h-8 flex-1" autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} aria-label="Name for the library"
              onKeyDown={(e) => { if (e.key === "Enter" && naming.trim()) { saveToLibrary({ kind: "house", name: naming.trim(), sketch: sk }); setNaming(null); } }} />
            <button className="btn btn-sm btn-primary" disabled={!naming.trim()} onClick={() => { saveToLibrary({ kind: "house", name: naming.trim(), sketch: sk }); setNaming(null); }}>Save</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setNaming(null)} aria-label="Cancel">✕</button>
          </div>
        )}
      </>}
    </div>
  );
}
