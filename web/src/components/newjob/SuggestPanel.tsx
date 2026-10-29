"use client";
// The client suggests, the contractor approves. In the client's view the drawing tool works the same
// (move rooms, change sizes, add furniture), but on a copy: the plan doesn't change. What they did
// is listed as plain changes and sent to the contractor with a note. The contractor sees "Your client
// suggested 3 changes", can see their version (the plan and the 3D show it, the changed rooms lit up),
// and approves or declines all of them or each one. Approving puts the change into the plan (Undo
// takes it out). The words follow the client portal: "Approve", "Decline", "Your contractor".
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type { Sketch, SketchFloor } from "@/lib/plan/sketch";
import { applyChanges, diffSketches, marksOn, reverse, withNeeds, type Change } from "@/lib/plan/suggest";
import { newSuggestion, saveSuggestion, useSuggestions, type Suggestion } from "@/lib/plan/suggestions";
import type { Units } from "@/lib/plan/units";

export type ViewAs = "contractor" | "client";
export type Marks = { rooms: number[]; things: number[] } | null;
const BLUE = "#55b2ff";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "");

/** Rooms and furniture lit up in chalk blue on the plan (changed ones, or one home's rooms). */
export function MarkLayer({ floor, marks, px }: { floor: SketchFloor; marks: Marks; px: number }) {
  if (!marks) return null;
  return (
    <g style={{ pointerEvents: "none" }} fill="none" stroke={BLUE}>
      {marks.rooms.map((i) => floor.rooms[i] && <polygon key={`r${i}`} points={floor.rooms[i].polygon.map((q) => q.join(",")).join(" ")} fill={BLUE} fillOpacity={0.14} strokeWidth={3 * px} strokeDasharray={`${8 * px} ${5 * px}`} />)}
      {marks.things.map((i) => {
        const f = floor.fixtures?.[i];
        if (!f) return null;
        const across = f.facing === "east" || f.facing === "west";
        const w = (across ? f.depth_mm : f.width_mm) ?? 600, d = (across ? f.width_mm : f.depth_mm) ?? 600;
        return <rect key={`t${i}`} x={f.center[0] - w / 2 - 4 * px} y={f.center[1] - d / 2 - 4 * px} width={w + 8 * px} height={d + 8 * px} strokeWidth={2.5 * px} />;
      })}
    </g>
  );
}

/**
 * Who is looking (the contractor, or their client), the client's copy, and the contractor's answers.
 * The editor keeps drawing on `sk` as always: in the client's view that is their copy, and while the
 * contractor looks at the client's version it is that version (and the plan can't be changed).
 */
export function useSuggest({ sk, setSk, past, future, fi, setFi, start = "contractor", drawing = "preview", units }: {
  sk: Sketch; setSk: (s: Sketch) => void; past: MutableRefObject<Sketch[]>; future: MutableRefObject<Sketch[]>;
  fi: number; setFi: (i: number) => void; start?: ViewAs; drawing?: string; units: Units;
}) {
  const [as, setAs] = useState<ViewAs>(start);
  // the contractor's plan while the client's copy or version is on screen, and its undo history
  const real = useRef<Sketch | null>(start === "client" ? sk : null);
  const hist = useRef<{ past: Sketch[]; future: Sketch[] } | null>(null);
  const [base, setBase] = useState<Sketch | null>(start === "client" ? sk : null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [theirs, setTheirs] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const all = useSuggestions(drawing);

  // ---- the client's side ----
  const mine = useMemo(() => (as === "client" && base ? diffSketches(base, sk, units) : []), [as, base, sk, units]);
  const round = all.find((s) => s.id === roundId) ?? null;
  const lastAnswered = [...all].reverse().find((s) => s.status === "answered") ?? null;
  // the client's copy is kept as they go, so leaving and coming back finds it
  useEffect(() => {
    if (as !== "client" || !base) return;
    const t = setTimeout(() => {
      if (round) { if (round.status !== "answered") saveSuggestion({ ...round, proposed: sk, changes: mine }); }
      else if (mine.length) { const s = newSuggestion(drawing, base, sk, mine); saveSuggestion(s); setRoundId(s.id); }
    }, 400);
    return () => clearTimeout(t);
  }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    if (!round || !mine.length) return;
    saveSuggestion({ ...round, proposed: sk, changes: mine, status: "sent", sent_at: new Date().toISOString(), note: note.trim() || null });
  };
  const takeBack = (c: Change) => { past.current.push(sk); future.current = []; setSk(applyChanges(sk, [reverse(c)])); };

  // ---- the contractor's side ----
  const open = as === "contractor" ? [...all].reverse().find((s) => s.status === "sent") ?? null : null;
  const pending = useMemo(() => (open ? open.changes.filter((c) => !open.answers[c.id]) : []), [open]);
  const plan = () => (as === "client" || theirs ? real.current ?? sk : sk);
  const showTheirs = (on: boolean) => {
    if (on === theirs || !open) return;
    if (on) { real.current = sk; setSk(applyChanges(sk, pending)); }
    else { setSk(real.current ?? sk); real.current = null; }
    setTheirs(on);
  };
  useEffect(() => { if (theirs && !pending.length) showTheirs(false); }, [pending.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (s: Suggestion, ids: string[], a: "approved" | "declined", finish = false) => {
    const answers = { ...s.answers };
    let next: Sketch | null = null;
    if (a === "approved") {
      const picked = withNeeds(s.changes, new Set(ids)).filter((c) => s.answers[c.id] !== "approved");
      const now = theirs ? real.current ?? sk : sk;
      next = applyChanges(now, picked);
      if (theirs) { real.current = null; setTheirs(false); }
      past.current.push(now); future.current = [];
      setSk(next);
      for (const c of picked) answers[c.id] = "approved";
    } else for (const id of ids) answers[id] = "declined";
    const left = s.changes.filter((c) => !answers[c.id]).length;
    const over = finish || !left;
    saveSuggestion({ ...s, answers, ...(over ? { status: "answered", answered_at: new Date().toISOString(), reply: reply.trim() || null } : {}) });
    const n = Object.values(answers).filter((x) => x === "approved").length;
    setDone(a === "approved" ? `Put into the plan. Undo takes it out.${over ? ` Answer sent: ${n} approved, ${s.changes.length - n} declined.` : ""}` : over ? `Answer sent: ${n} approved, ${s.changes.length - n} declined.` : "Declined.");
    if (over) { setReply(""); setFocus(null); }
  };

  const go = (to: ViewAs) => {
    if (to === as) return;
    if (to === "client") {
      if (theirs) showTheirs(false);
      const now = theirs ? real.current ?? sk : sk;
      real.current = now;
      hist.current = { past: past.current, future: future.current };
      past.current = []; future.current = [];
      // pick up the round the client is still on, else start from the plan as it is
      const r = [...all].reverse().find((s) => s.status === "draft" || s.status === "sent") ?? null;
      setRoundId(r?.id ?? null);
      setBase(r ? r.base : now);
      setNote(r?.note ?? "");
      setSk(r ? clone(r.proposed) : clone(now));
    } else {
      setSk(real.current ?? sk);
      real.current = null;
      past.current = hist.current?.past ?? []; future.current = hist.current?.future ?? [];
      hist.current = null;
      setBase(null); setRoundId(null);
    }
    setDone(null); setFocus(null);
    setAs(to);
  };

  // what is lit up on the plan and in the 3D
  const lit = as === "client" ? mine : theirs ? (focus ? pending.filter((c) => c.id === focus) : pending) : [];
  const marks: Marks = lit.length ? marksOn(sk, fi, lit) : null;
  const pick = (c: Change) => {
    setFocus(focus === c.id ? null : c.id);
    const k = sk.floors.findIndex((f) => f.level === c.level);
    if (k >= 0 && k !== fi) setFi(k);
  };

  const toggle = (
    <div className="flex items-center rounded-[4px] border border-line overflow-hidden text-[12.5px]" role="group" aria-label="View as">
      <span className="px-2 text-muted">View as</span>
      {(["contractor", "client"] as const).map((x) => (
        <button key={x} onClick={() => go(x)} aria-pressed={as === x} className={`h-8 px-2.5 ${as === x ? "bg-accent text-ink font-semibold" : "hover:bg-panel-3"}`}>{x === "contractor" ? "Contractor" : "Client"}</button>
      ))}
    </div>
  );

  const row = (c: Change, children: ReactNode) => (
    <li key={c.id} className={`flex items-start gap-2 py-1.5 border-t border-line first:border-t-0 ${focus === c.id ? "text-accent" : ""}`}>
      <button className="flex-1 text-left leading-snug" onClick={() => pick(c)} title="Show it on the plan">
        {c.text}{c.floorName && <span className="text-muted"> · {c.floorName}</span>}
      </button>
      {children}
    </li>
  );

  // the banner over the drawing for the contractor
  const banner = open && (
    <div className="px-3 py-2 border-b border-line bg-panel text-[13px] space-y-2" aria-label="Your client's suggestions">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{open.from.name ?? "Your client"} suggested {open.changes.length} {open.changes.length === 1 ? "change" : "changes"}</span>
        <span className="text-muted">{when(open.sent_at)}</span>
        {pending.length > 0 && (
          <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
            <input type="checkbox" checked={theirs} onChange={(e) => showTheirs(e.target.checked)} /> Show their version
          </label>
        )}
      </div>
      {open.note && <p className="italic">&ldquo;{open.note}&rdquo;</p>}
      <ul className="max-h-48 overflow-y-auto scroll-thin">
        {open.changes.map((c) => (
          row(c, open.answers[c.id] ? <span className={`chip !h-6 ${open.answers[c.id] === "approved" ? "!text-green" : "!text-red"}`}>{open.answers[c.id] === "approved" ? "Approved" : "Declined"}</span> : <>
              <button className="btn btn-sm btn-ghost !h-7" onClick={() => answer(open, [c.id], "approved")}>Approve</button>
              <button className="btn btn-sm btn-ghost !h-7 text-muted" onClick={() => answer(open, [c.id], "declined")}>Decline</button>
            </>)
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input !h-8 flex-1 min-w-[180px]" placeholder="A note back to your client (optional)" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply to your client" />
        <button className="btn btn-sm btn-primary" disabled={!pending.length} onClick={() => answer(open, pending.map((c) => c.id), "approved", true)}>Approve all</button>
        <button className="btn btn-sm btn-ghost" disabled={!pending.length} onClick={() => answer(open, pending.map((c) => c.id), "declined", true)}>Decline all</button>
      </div>
      {done && <p className="text-muted">{done}</p>}
    </div>
  );
  // after the round is answered, a line for the contractor
  const answeredLine = !open && as === "contractor" && done && <div className="px-3 py-2 border-b border-line bg-panel text-[13px] text-muted">{done}</div>;

  // the client's list in the side panel
  const sent = round?.status === "sent";
  const changedSinceSent = sent && JSON.stringify(round.changes.map((c) => c.id)) !== JSON.stringify(mine.map((c) => c.id));
  const clientPanel = as === "client" && (
    <div className="space-y-2 pb-3 border-b border-line" aria-label="Your suggestions">
      {lastAnswered && !round && (
        <div className="rounded-[4px] border border-line p-2 space-y-1">
          <p className="eyebrow">Your contractor answered</p>
          <p>{Object.values(lastAnswered.answers).filter((a) => a === "approved").length} approved, {Object.values(lastAnswered.answers).filter((a) => a === "declined").length} declined · {when(lastAnswered.answered_at)}</p>
          {lastAnswered.reply && <p className="italic">&ldquo;{lastAnswered.reply}&rdquo;</p>}
        </div>
      )}
      <p className="eyebrow">Your suggestions ({mine.length})</p>
      {!mine.length ? <p className="text-muted leading-snug">Change anything: move a room, change its size, add a window or furniture. The plan stays as it is until your contractor approves.</p> : (
        <ul>{mine.map((c) => row(c, <button className="text-muted hover:text-red px-1" onClick={() => takeBack(c)} title="Take this one back" aria-label={`Take back: ${c.text}`}>✕</button>))}</ul>
      )}
      {mine.length > 0 && <>
        <textarea className="input !h-16 py-1.5 w-full" placeholder="A note for your contractor (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note for your contractor" />
        <button className="btn btn-sm btn-primary w-full" disabled={sent && !changedSinceSent && (round?.note ?? "") === note.trim()} onClick={send}>{sent ? "Send again" : "Send to your contractor"}</button>
      </>}
      {sent && <p className="text-muted">Sent to your contractor {when(round.sent_at)}. You&apos;ll see their answer here.</p>}
    </div>
  );

  return { as, go, toggle, banner: banner || answeredLine || null, clientPanel, marks, locked: theirs, plan, pending };
}
