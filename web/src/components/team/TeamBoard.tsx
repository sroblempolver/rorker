"use client";
// The team board. On the Team page the office writes to everyone or to picked people (words and a
// photo); each sub or employee sees it on their own link, with what's to them, and answers the office.
// It is the same thread as the client's (ClientThread), with "to" on the office side.
import { useMemo, useRef, useState } from "react";
import type { JobMessage, Member, TeamMessage } from "@/lib/data/types";
import { toNames } from "@/lib/cloud/team";
import { ClientThread, type ThreadApi } from "@/components/workspace/ClientThread";

export interface TeamBoardApi {
  list(): Promise<TeamMessage[]>;
  /** the office sends to everyone (null) or to these members */
  send(to: string[] | null, body: string, photo: File | null): Promise<TeamMessage[]>;
}
/** A crew member's side: what's for them, and their answers to the office. */
export interface TeamInboxApi {
  list(): Promise<TeamMessage[]>;
  send(body: string, photo: File | null): Promise<TeamMessage[]>;
}

/** The board as a thread: the office on one side, crew answers on the other. */
const asThread = (list: TeamMessage[], members?: Member[]): JobMessage[] => list.map((m) => ({
  id: m.id, job_id: "", from: m.from === "office" ? "contractor" : "client", body: m.body, photos: m.photos, created_at: m.created_at,
  author_name: members && m.from === "office" ? `${m.author_name} → ${toNames(m, members)}` : m.author_name,
}));

/** The office's side, on the Team page. */
export function TeamBoard({ api, members, meId }: { api: TeamBoardApi; members: Member[]; meId: string | null }) {
  const crew = useMemo(() => members.filter((m) => m.id !== meId && !m.client), [members, meId]);
  const [to, setTo] = useState<string[]>([]);
  // who's picked when Send is pressed (the thread keeps its own api)
  const toRef = useRef(to);
  toRef.current = to;
  const thread = useMemo<ThreadApi>(() => ({
    list: () => api.list().then((l) => asThread(l, members)),
    send: (body, photo) => api.send(toRef.current.length ? toRef.current : null, body, photo).then((l) => asThread(l, members)),
  }), [api, members]);
  const pick = (id: string) => setTo((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const who = to.length ? toNames({ from: "office", to } as TeamMessage, members) : "everyone";
  return (
    <section className="card p-4 space-y-3" aria-label="Message the team">
      <div>
        <p className="eyebrow">Message the team</p>
        <p className="text-[13px] text-muted">Goes to each person&apos;s link, with their tasks. They can answer you here.</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Send to">
        <button type="button" onClick={() => setTo([])} aria-pressed={!to.length} className={`chip !h-8 ${!to.length ? "!text-accent !border-accent" : ""}`}>Everyone</button>
        {crew.map((m) => (
          <button key={m.id} type="button" onClick={() => pick(m.id)} aria-pressed={to.includes(m.id)} className={`chip !h-8 ${to.includes(m.id) ? "!text-accent !border-accent" : ""}`}>
            {m.full_name}{m.title ? <span className="text-muted font-normal"> · {m.title}</span> : null}
          </button>
        ))}
      </div>
      <div className="h-[420px]">
        <ClientThread api={thread} side="contractor" tone="app" other={who} />
      </div>
    </section>
  );
}

/** A sub's or employee's side, on their link. */
export function TeamInbox({ api, company }: { api: TeamInboxApi; company: string }) {
  const thread = useMemo<ThreadApi>(() => ({
    list: () => api.list().then((l) => asThread(l)),
    send: (body, photo) => api.send(body, photo).then((l) => asThread(l)),
  }), [api]);
  return <ClientThread api={thread} side="client" tone="app" other={company} />;
}
