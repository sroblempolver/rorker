"use client";
// One thread between the contractor and the job's client: messages, info and photos, both ways. The
// contractor sees it in the job's Client tab; the client on their own link. "paper" is the client's
// light page, "app" the contractor's dark one.
import { useEffect, useRef, useState } from "react";
import type { JobMessage } from "@/lib/data/types";

export interface ThreadApi {
  list(): Promise<JobMessage[]>;
  send(body: string, photo: File | null): Promise<JobMessage[]>;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export function ClientThread({ api, initial, side, tone, other, color = "#ff6a1f" }: {
  api: ThreadApi; initial?: JobMessage[]; side: JobMessage["from"]; tone: "app" | "paper";
  /** who's on the other end, for the empty state ("Sam and Priya Okafor") */
  other: string; color?: string;
}) {
  const [list, setList] = useState<JobMessage[] | null>(initial ?? null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const paper = tone === "paper";

  // new messages from the other side show up while the thread is open
  useEffect(() => {
    let live = true;
    const load = () => api.list().then((l) => { if (live) setList(l); }, () => {});
    if (!initial) void load();
    const t = setInterval(load, 15000);
    return () => { live = false; clearInterval(t); };
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list?.length]);

  const send = async () => {
    if (busy || (!text.trim() && !photo)) return;
    setErr(null);
    setBusy(true);
    try { setList(await api.send(text.trim(), photo)); setText(""); setPhoto(null); } catch (x) { setErr(x instanceof Error ? x.message : "That didn't send. Try again."); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 p-1">
        {list === null ? <p className={`text-[13.5px] ${paper ? "text-neutral-500" : "text-muted"}`}>Loading…</p>
          : !list.length ? <p className={`text-[13.5px] ${paper ? "text-neutral-500" : "text-muted"}`}>No messages yet. Anything you send here goes to {other}, with photos if you like.</p>
          : list.map((m) => {
            const mine = m.from === side;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-[6px] px-3 py-2 ${mine ? (paper ? "text-white" : "bg-accent text-accent-ink") : paper ? "bg-white border border-neutral-200 text-neutral-900" : "bg-panel-2 border border-line"}`}
                  style={mine && paper ? { background: color } : undefined}>
                  <p className={`text-[11.5px] mb-0.5 ${mine ? "opacity-80" : paper ? "text-neutral-500" : "text-muted"}`}>{m.author_name} · {when(m.created_at)}</p>
                  {m.body && <p className="text-[14.5px] whitespace-pre-wrap leading-snug">{m.body}</p>}
                  {m.photos.length > 0 && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      {m.photos.map((src) => <a key={src} href={src} target="_blank" rel="noreferrer noopener"><img src={src} alt="" className="w-full max-h-48 object-cover rounded-[3px]" /></a>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        <div ref={end} />
      </div>
      {err && <p className={`text-[13px] ${paper ? "text-red-700" : "text-red"}`}>{err}</p>}
      <div className={`shrink-0 pt-2 mt-1 border-t ${paper ? "border-neutral-200" : "border-line"} space-y-1.5`}>
        {photo && <p className={`text-[12.5px] ${paper ? "text-neutral-600" : "text-muted"}`}>Photo: {photo.name} <button className="underline" onClick={() => setPhoto(null)}>remove</button></p>}
        <div className="flex gap-1.5 items-end">
          <button type="button" onClick={() => file.current?.click()} aria-label="Add a photo" title="Add a photo"
            className={`h-10 w-10 shrink-0 grid place-items-center rounded-[4px] border ${paper ? "border-neutral-300 bg-white text-neutral-700" : "border-line bg-panel-2 text-muted hover:text-text"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </button>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={`Message ${other}`}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            className={paper ? "flex-1 min-h-10 max-h-32 rounded-[4px] border border-neutral-300 bg-white px-3 py-2 text-[15px] text-neutral-900 focus:outline-none focus:border-neutral-500" : "input flex-1 !h-auto min-h-10 max-h-32 py-2"} />
          <button onClick={() => void send()} disabled={busy || (!text.trim() && !photo)}
            className={paper ? "h-10 px-4 rounded-[4px] text-white font-semibold disabled:opacity-40" : "btn btn-primary"} style={paper ? { background: color } : undefined}>
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
