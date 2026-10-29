// When the assistant puts a dot somewhere the viewer can't see it (another floor, the outside, another
// room), it says so and offers to go there: "That's on Level 2, and you're on Level 1" with a "Go to
// Level 2" button. The map's own view (PlanViewer) works out what's in view and keeps it here, so the
// assistant's words and buttons and the chip on the map agree.
import { useSyncExternalStore } from "react";
import type { Mark } from "./pointing";
import type { Plan } from "./types";
import { findElement, roomOf } from "./geometry";

/** The view a viewer can be in, as the map shows it (the same shape as PlanViewer's Level). */
export type View =
  | { kind: "site" } | { kind: "exterior" } | { kind: "floor"; floorId: string }
  | { kind: "room"; floorId: string; roomId: string } | { kind: "wall"; floorId: string; roomId: string; sideKey: string };

/** One place to go to see some of the dots. */
export interface AwayTarget { key: string; go: View; /** "Level 2", "the outside", "Bedroom 1" */ name: string; marks: Mark[]; /** the outside only shows in 3D */ needs3d: boolean }

const floorName = (plan: Plan, id: string) => plan.floors.find((f) => f.id === id)?.name ?? "another floor";
const roomName = (plan: Plan, floorId: string, roomId: string) => plan.floors.find((f) => f.id === floorId)?.rooms.find((r) => r.id === roomId)?.name ?? "that room";

/** Where the viewer is, in words: "Level 1", "the outside". */
export function viewName(plan: Plan, v: View): string {
  if (v.kind === "site") return "the whole site";
  if (v.kind === "exterior") return "the outside";
  if (v.kind === "floor") return floorName(plan, v.floorId);
  return roomName(plan, v.floorId, v.roomId);
}

const markRoom = (plan: Plan, m: Mark) => {
  const e = m.id ? findElement(plan, m.id) : null;
  return e ? roomOf(e) : null;
};

/** The dots the viewer can't see from here, grouped by where to go to see them. 3D from outside shows
 *  every floor's dots through the walls; a floor shows its own; a room its own (and dots with no room). */
export function awayFrom(plan: Plan, v: View, in3d: boolean, can3d: boolean, marks: Mark[]): AwayTarget[] {
  const out = new Map<string, AwayTarget>();
  for (const m of marks) {
    let go: View | null = null;
    if (m.outside) {
      if (!(in3d && v.kind === "exterior")) go = can3d ? { kind: "exterior" } : null;
    } else if (v.kind === "exterior" && in3d) go = null;
    else if (v.kind === "site" || v.kind === "exterior" || v.floorId !== m.floor_id) go = { kind: "floor", floorId: m.floor_id };
    else if (v.kind === "room" || v.kind === "wall") {
      const r = markRoom(plan, m);
      // facing a wall shows no dots; in a room, dots in another room are behind its walls
      if (v.kind === "wall" || (r && r !== v.roomId)) go = r ? { kind: "room", floorId: m.floor_id, roomId: r } : { kind: "floor", floorId: m.floor_id };
    }
    if (!go) continue;
    const key = JSON.stringify(go);
    const t = out.get(key) ?? { key, go, name: go.kind === "room" ? roomName(plan, go.floorId, go.roomId) : viewName(plan, go), marks: [], needs3d: go.kind === "exterior" && !in3d };
    t.marks.push(m);
    out.set(key, t);
  }
  return [...out.values()];
}

/** What the assistant says about it: "That's on Level 2, and you're on Level 1." */
export function awaySay(plan: Plan, v: View, away: AwayTarget[], total: number): string {
  if (!away.length) return "";
  const here = viewName(plan, v);
  const one = (t: AwayTarget) => (t.go.kind === "exterior" ? "on the outside of the building" : t.go.kind === "room" ? `in ${t.name}` : `on ${t.name}`);
  if (away.length === 1 && away[0].marks.length === total) {
    const what = total === 1 ? "That dot is" : "Those dots are";
    return `${what} ${one(away[0])}, and you're looking at ${here}.`;
  }
  return `Some of the dots aren't in view here: ${away.map((t) => `${t.marks.length === 1 ? "one" : t.marks.length} ${one(t)}`).join(", ")}.`;
}

/** What the map knows right now: the dots out of view, and how to go to them. */
export interface Away { targets: AwayTarget[]; say: string; go: (t: AwayTarget) => void }
const NONE: Away = { targets: [], say: "", go: () => {} };
let state: Away = NONE;
const subs = new Set<() => void>();
const sig = (a: Away) => a.say + "|" + a.targets.map((t) => `${t.key}:${t.marks.length}:${t.needs3d}`).join(",");
export function setAway(a: Away | null) {
  const next = a ?? NONE;
  const same = sig(next) === sig(state);
  state = next;
  if (!same) subs.forEach((f) => f());
}
export const getAway = () => state;
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function useAway(): Away {
  return useSyncExternalStore(subscribe, getAway, () => NONE);
}

/** Where the map is looking, kept by the map so the assistant can tell the viewer about dots it can't see. */
interface Here { plan: Plan; view: View; in3d: boolean; can3d: boolean }
let here: Here | null = null;
export const setHere = (h: Here | null) => { here = h; };

/** The words to add to the assistant's answer about the dots it just put up, or "" when they're in view. */
export function awayNote(marks: Mark[]): string {
  if (!here || !marks.length) return "";
  return awaySay(here.plan, here.view, awayFrom(here.plan, here.view, here.in3d, here.can3d, marks), marks.length);
}
