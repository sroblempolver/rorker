// Everything rorker.com says Rorker can do. To add a feature when it ships, add one entry at the top of
// FEATURES: the cards, the "What's new" list and the counts all come from here.
//   status: "live" (in the app now), "new" (live, shipped in the last few weeks), "next" (being built)
//   scene:  what the house behind the page does while the card is hovered (see ScenePreset in stage.tsx)

export type ScenePreset = "outside" | "stages" | "pins" | "crew" | "progress" | "assistant" | "build" | "jobs";

export interface Feature {
  id: string;
  title: string;
  /** one or two plain sentences, trade words, no hype */
  body: string;
  group: "Plan" | "Crew" | "Assistant" | "Money" | "Materials" | "Clients";
  status: "live" | "new" | "next";
  /** the day it shipped (YYYY-MM-DD); "next" features leave it out */
  shipped?: string;
  scene: ScenePreset;
}

export const FEATURES: Feature[] = [
  { id: "build-mode", title: "Build mode", body: "Move a wall, cut a door, split a room, right on the map. The room next door follows, and anything read from the drawing can be put back.", group: "Plan", status: "new", shipped: "2026-10-29", scene: "build" },
  { id: "live-map", title: "A living map of every job", body: "Every job is a building on one map. Crews show on the jobs they're on, late work pulses, and finished rooms turn green.", group: "Crew", status: "new", shipped: "2026-10-29", scene: "jobs" },
  { id: "go-to", title: "Go to anything", body: "Ctrl+K and type. Any job, floor, room, pin or person, and the map flies there.", group: "Plan", status: "new", shipped: "2026-10-28", scene: "outside" },
  { id: "feed", title: "The job feed", body: "What's on now, what's late and what's coming, by person and by day. It opens first on every job.", group: "Crew", status: "new", shipped: "2026-10-28", scene: "crew" },
  { id: "stages", title: "Build stages you can see", body: "Slab, framing, sheetrock, finished. Pick a stage and the house shows it: chalk lines, studs at 16 inches, bare board, then the dressed house.", group: "Plan", status: "live", shipped: "2026-10-27", scene: "stages" },
  { id: "house-3d", title: "The house in 3D", body: "Roof, siding, trim, porches and the lot, built from the drawing. Zoom in and the roof lifts off. Keep going and you're standing in the room.", group: "Plan", status: "live", shipped: "2026-10-27", scene: "outside" },
  { id: "money", title: "Quotes, change orders, invoices", body: "Price the job room by room, send the quote, bill the change order and take the payment. Your logo on every page.", group: "Money", status: "live", shipped: "2026-10-27", scene: "progress" },
  { id: "materials", title: "Materials and the supply run", body: "What to buy for each task, which store, who's picking it up. One list for the run, ticked off in the aisle.", group: "Materials", status: "live", shipped: "2026-10-27", scene: "pins" },
  { id: "assistant", title: "Ask it out loud", body: "One tap and talk. \"What's late on Hadley?\" It answers, points at the spot on the map, and makes the change if you tell it to.", group: "Assistant", status: "live", shipped: "2026-10-25", scene: "assistant" },
  { id: "links", title: "Links for the crew and subs", body: "Send a link, no app to download. They see the plan and only the tasks tagged to them. Turn it off when the job's done.", group: "Crew", status: "live", shipped: "2026-10-25", scene: "crew" },
  { id: "pins", title: "Pins on the exact spot", body: "Task, issue, note or material, dropped on the room, the wall, the outlet. Photos, due dates, and close it with a photo.", group: "Plan", status: "live", shipped: "2026-10-25", scene: "pins" },
  { id: "plan-reader", title: "Drop in the drawing", body: "AutoCAD, PDF or a photo of the plan. Every room, wall, door, window and fixture comes out numbered, in feet and inches.", group: "Plan", status: "live", shipped: "2026-10-25", scene: "stages" },
  { id: "client-portal", title: "The client's own view", body: "Where the job is, what's next, what you need from them. Photos once a day, a recap every week, and a pay button.", group: "Clients", status: "next", scene: "progress" },
  { id: "white-label", title: "Your brand on all of it", body: "Your logo, colours and name across the app and every client and crew link.", group: "Clients", status: "next", scene: "outside" },
];
