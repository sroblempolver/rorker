// When someone taps a tag (a place in a message, a question's spot), the plan goes to it: the floor it's
// on comes up. The assistant's own dots don't move the map: it says where they are and offers to go
// (see lib/plan/away). Either way the one it's about opens in the side panel.
import { useEffect, useRef } from "react";
import type { Level } from "@/components/plan/PlanViewer";
import { useMarks } from "@/lib/plan/marks";
import { findElement, roomOf } from "@/lib/plan/geometry";
import type { Plan } from "@/lib/plan/types";

export function useFollowMarks(view: Plan | null, level: Level, go: (l: Level) => void, open: (id: string) => void) {
  const { marks, focus, n, follow } = useMarks();
  const pending = useRef<string | null>(null);
  const cb = useRef({ go, open, level });
  cb.current = { go, open, level };

  // a new set of dots: show the floor they're on (leaving a room or the outside when they're elsewhere)
  useEffect(() => {
    if (!n || !marks.length) { pending.current = focus; return; }
    pending.current = focus;
    if (!follow) return;
    const floorId = marks[0].floor_id;
    const l = cb.current.level;
    // dots on the outside (the roof, a porch) show on the building from outside
    if (marks.every((m) => m.outside)) { if (l.kind !== "exterior") cb.current.go({ kind: "exterior" }); return; }
    const inRoom = l.kind === "room" || l.kind === "wall";
    const roomIds = new Set(marks.map((m) => (view && m.id ? (() => { const e = findElement(view, m.id!); return e ? (e.kind === "room" ? e.el.id : roomOf(e)) : null; })() : null)));
    const away = l.kind === "site" || l.kind === "exterior" || l.floorId !== floorId || (inRoom && !(roomIds.size === 1 && roomIds.has(l.roomId)));
    if (away) cb.current.go({ kind: "floor", floorId });
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  // open the one it's about, once it's in the plan (something just added shows up after the refresh)
  useEffect(() => {
    const id = pending.current;
    if (!id || !view || !findElement(view, id)) return;
    pending.current = null;
    cb.current.open(id);
  }, [n, view]);
}
