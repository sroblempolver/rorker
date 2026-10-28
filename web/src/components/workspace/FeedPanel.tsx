"use client";
// The feed: the first thing beside the map. What's going on now and what's coming up on this job, by
// who it's on (or by day). A tap on anything shows it on the map and opens it.
import { useEffect, useMemo, useState } from "react";
import { today as todayNow } from "@/lib/dates";
import type { JobStage, Pin } from "@/lib/data/types";
import { byPerson, byWhenGroups, dayText, feedItems, stageNowNext, type FeedItem } from "@/lib/feed";
import type { MaterialLine } from "@/lib/materials/types";
import type { Plan } from "@/lib/plan/types";
import { PIN_COLOR, PIN_LABEL } from "@/components/plan/style";
import { Avatar, AvatarStack } from "@/components/team/Avatar";
import { useTeam } from "@/components/team/context";
import { recall, remember } from "@/lib/remember";
import { where } from "./PinsPanel";

type GroupBy = "person" | "day";
/** rows shown per group before "Show n more" */
const FIRST = 4;

export function FeedPanel({ pins, lines, stages, plan, onPin, onLine, onStages }: {
  pins: Pin[]; lines: MaterialLine[]; stages: JobStage[]; plan: Plan | null;
  onPin: (id: string) => void; onLine: (id: string) => void; onStages: () => void;
}) {
  const { members, me } = useTeam();
  const [groupBy, setGroupByRaw] = useState<GroupBy>("person");
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => { const g = recall<GroupBy>("feed.groupBy"); if (g === "day") setGroupByRaw(g); }, []);
  const setGroupBy = (g: GroupBy) => { setGroupByRaw(g); remember("feed.groupBy", g); };
  const today = todayNow();
  const items = useMemo(() => feedItems(pins, lines, today), [pins, lines, today]);
  const groups = useMemo(() => (groupBy === "person" ? byPerson(items, members) : byWhenGroups(items)), [groupBy, items, members]);
  const { now, next } = stageNowNext(stages);
  const count = (w: FeedItem["when"]) => items.filter((i) => i.when === w).length;
  const late = count("late"), dueToday = count("today"), going = count("now");

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="eyebrow">On this job</p>
        <h2 className="font-display text-[25px] font-extrabold uppercase leading-none">Coming up</h2>
        <p className="text-[13px] text-muted mt-1.5">
          {items.length ? <>
            {[late > 0 && <span key="l" className="text-red">{late} late</span>, going > 0 && <span key="g" className="text-amber">{going} going on now</span>,
              dueToday > 0 && <span key="t" className="text-text">{dueToday} due today</span>].filter(Boolean).flatMap((x, i) => (i ? [" · ", x] : [x]))}
            {!going && !late && !dueToday && `${items.length} open, nothing due today`}
          </> : "Nothing open on this job."}
        </p>
      </div>

      {(now || next) && (
        <button onClick={onStages} className="w-full text-left card !rounded-[3px] px-3 py-2.5 hover:border-chalk border-l-[3px] !border-l-accent" title="Open the stages">
          {now && <span className="flex items-baseline gap-2"><span className="eyebrow !text-[11.5px] shrink-0">Stage now</span><span className="text-[14px] truncate">{now.name}</span></span>}
          {next && <span className="flex items-baseline gap-2 text-muted"><span className="eyebrow !text-[11.5px] shrink-0">Then</span><span className="text-[13px] truncate">{next.name}</span></span>}
        </button>
      )}

      {items.length > 0 && (
        <div className="flex gap-1.5" role="group" aria-label="Group the feed">
          {(["person", "day"] as const).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)} aria-pressed={groupBy === g} className={`chip ${groupBy === g ? "!text-accent-ink !bg-accent !border-accent" : "hover:text-text"}`}>
              {g === "person" ? "By person" : "By day"}
            </button>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id} className="space-y-1.5">
          <div className="flex items-center gap-2 pt-1">
            {g.member && <Avatar m={g.member} size={24} />}
            <h3 className={`font-display font-bold uppercase tracking-[0.06em] text-[14px] truncate ${g.id === "late" ? "text-red" : g.id === "now" ? "text-amber" : ""}`}>
              {g.title}{g.member && g.member.id === me ? " (you)" : ""}
            </h3>
            {g.member?.title && <span className="text-[12px] text-muted truncate">{g.member.title}</span>}
            <span className="ml-auto font-mono text-[11.5px] text-muted shrink-0">{g.items.length}</span>
          </div>
          {(open.has(g.id) ? g.items : g.items.slice(0, FIRST)).map((i) => (
            <FeedRow key={i.key} item={i} plan={plan} today={today} showPeople={groupBy === "day"}
              onClick={() => ("pin" in i.ref ? onPin(i.ref.pin) : onLine(i.ref.line))} />
          ))}
          {g.items.length > FIRST && (
            <button onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })} className="text-[13px] text-muted hover:text-text px-1">
              {open.has(g.id) ? "Show less" : `Show ${g.items.length - FIRST} more`}
            </button>
          )}
        </section>
      ))}
      {!items.length && <p className="text-muted text-sm py-4 text-center">Tasks, issues and things to buy show up here as they&apos;re added, with who&apos;s on them and when they&apos;re due.</p>}
    </div>
  );
}

function FeedRow({ item, plan, today, showPeople, onClick }: { item: FeedItem; plan: Plan | null; today: string; showPeople: boolean; onClick: () => void }) {
  const { members } = useTeam();
  const people = members.filter((m) => item.people.includes(m.id));
  const tone = item.when === "late" ? "text-red" : item.when === "today" ? "text-text" : "text-muted";
  return (
    <button onClick={onClick} className={`w-full text-left card !rounded-[3px] px-3 py-2 flex items-center gap-3 hover:border-chalk ${item.when === "late" ? "overdue-edge" : ""}`}>
      <span className="shrink-0 w-1.5 self-stretch rounded-[1px]" style={{ background: PIN_COLOR[item.kind] }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] truncate">{item.title}</span>
        <span className="block text-[12px] text-muted truncate">{PIN_LABEL[item.kind]} · {where(plan, item)}</span>
      </span>
      <span className="shrink-0 flex flex-col items-end gap-1">
        {item.inProgress ? <span className="chip !h-5 !px-1.5 !text-[11.5px] text-amber">{"line" in item.ref ? "Ordered" : item.kind === "material" ? "Got it" : "In progress"}</span> : null}
        {item.date && <span className={`font-mono text-[11.5px] ${tone}`} title={`${item.dateWord} ${item.date}`}>{item.dateWord === "Order by" ? (item.when === "late" ? "Order now" : item.date === today ? "Order today" : `Order by ${dayText(item.date, today)}`) : dayText(item.date, today)}</span>}
      </span>
      {showPeople && <AvatarStack members={people} />}
    </button>
  );
}
