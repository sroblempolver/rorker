"use client";
// One thread between the contractor and the job's client: messages, info and photos, both ways. The
// contractor sees it in the job's Client tab; the client on their own link. "paper" is the client's
// light page, "app" the contractor's dark one. Type @ to tag a room or an object in a room ("@Bedroom 1 ›
// Bed needs replacing"), or hold the mic and say it: rooms and objects named out loud become tags too.
// A tag in a message is a button that shows that spot on the map.
import { useEffect, useMemo, useRef, useState } from "react";
import type { JobMessage } from "@/lib/data/types";
import { spokenTags, withTags, type PlaceTag } from "@/lib/plan/places";
import { useDictation } from "@/components/voice/speech";

export interface ThreadApi {
  list(): Promise<JobMessage[]>;
  send(body: string, photo: File | null, places: PlaceTag[]): Promise<JobMessage[]>;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/** what's being typed after an @ at the end of the words, if anything */
const typingTag = (text: string) => text.match(/(?:^|\s)@([^@\n]{0,40})$/)?.[1] ?? null;

export function ClientThread({ api, initial, side, tone, other, color = "#ff6a1f", places = [], onPlace, onSeen }: {
  api: ThreadApi; initial?: JobMessage[]; side: JobMessage["from"]; tone: "app" | "paper";
  /** who's on the other end, for the empty state ("Sam and Priya Okafor") */
  other: string; color?: string;
  /** the rooms and objects that can be tagged (from the plan); none, no tagging */
  places?: PlaceTag[];
  /** a tag in a message was tapped: show it on the map */
  onPlace?: (t: PlaceTag) => void;
  /** the newest message has been seen (to clear "new" notices) */
  onSeen?: (list: JobMessage[]) => void;
}) {
  const [list, setList] = useState<JobMessage[] | null>(initial ?? null);
  const [text, setText] = useState("");
  const [tags, setTags] = useState<PlaceTag[]>([]);
  const [pick, setPick] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const paper = tone === "paper";
  const seen = useRef(onSeen);
  seen.current = onSeen;
  // what's said goes into the box with its rooms and objects tagged, to check before sending
  const dict = useDictation((words) => {
    const said = spokenTags(words.trim(), places);
    const line = said.text.charAt(0).toUpperCase() + said.text.slice(1);
    setText((s) => `${s}${s && !/\s$/.test(s) ? " " : ""}${line}`);
    setTags((old) => [...old, ...said.tags.filter((t) => !old.some((o) => o.id === t.id))]);
    box.current?.focus();
  });

  // new messages from the other side show up while the thread is open
  useEffect(() => {
    let live = true;
    const load = () => api.list().then((l) => { if (live) setList(l); }, () => {});
    if (!initial) void load();
    const t = setInterval(load, 15000);
    return () => { live = false; clearInterval(t); };
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); if (list) seen.current?.(list); }, [list?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // the @ menu: rooms and objects whose name has every word typed after the @
  const q = typingTag(text);
  const matches = useMemo(() => {
    if (q === null || !places.length) return [];
    const words = q.toLowerCase().split(/[\s›>]+/).filter(Boolean);
    // names that end with what was typed first ("desk" before "desk lamp"), then the shorter ones
    const ends = (l: string) => l.toLowerCase().endsWith(words[words.length - 1] ?? "");
    return places.filter((p) => words.every((w) => p.label.toLowerCase().includes(w)))
      .sort((a, b) => Number(ends(b.label)) - Number(ends(a.label)) || a.label.length - b.label.length).slice(0, 8);
  }, [q, places]);
  const choose = (t: PlaceTag) => {
    setText((s) => s.replace(/@([^@\n]{0,40})$/, `@${t.label} `));
    setTags((l) => (l.some((x) => x.id === t.id) ? l : [...l, t]));
    setPick(0);
    box.current?.focus();
  };

  const send = async () => {
    if (busy || (!text.trim() && !photo)) return;
    setErr(null);
    setBusy(true);
    const body = text.trim();
    try { setList(await api.send(body, photo, tags.filter((t) => body.includes(`@${t.label}`)))); setText(""); setTags([]); setPhoto(null); } catch (x) { setErr(x instanceof Error ? x.message : "That didn't send. Try again."); } finally { setBusy(false); }
  };

  const muted = paper ? "text-neutral-500" : "text-muted";
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 p-1">
        {list === null ? <p className={`text-[13.5px] ${muted}`}>Loading…</p>
          : !list.length ? <p className={`text-[13.5px] ${muted}`}>No messages yet. Anything you send here goes to {other}, with photos if you like.{places.length ? " Type @, or hold the mic and say it, to point at a room or something in it." : ""}</p>
          : list.map((m) => {
            const mine = m.from === side;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-[6px] px-3 py-2 ${mine ? (paper ? "text-white" : "bg-accent text-accent-ink") : paper ? "bg-white border border-neutral-200 text-neutral-900" : "bg-panel-2 border border-line"}`}
                  style={mine && paper ? { background: color } : undefined}>
                  <p className={`text-[11.5px] mb-0.5 ${mine ? "opacity-80" : muted}`}>{m.author_name} · {when(m.created_at)}</p>
                  {m.body && (
                    <p className="text-[14.5px] whitespace-pre-wrap leading-snug">
                      {withTags(m.body, m.places ?? []).map((part, i) => typeof part === "string" ? part : (
                        <button key={i} type="button" onClick={() => onPlace?.(part)} disabled={!onPlace} title="Show it on the map"
                          className={`inline-flex items-center gap-1 rounded-[3px] px-1 font-semibold underline-offset-2 ${onPlace ? "hover:underline" : ""} ${mine ? "bg-black/15" : paper ? "bg-neutral-100" : "bg-panel-3"}`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                          {part.label}
                        </button>
                      ))}
                    </p>
                  )}
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
      <div className={`relative shrink-0 pt-2 mt-1 border-t ${paper ? "border-neutral-200" : "border-line"} space-y-1.5`}>
        {matches.length > 0 && (
          <div role="listbox" aria-label="Tag a place" className={`absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-[4px] border shadow-lg z-20 ${paper ? "bg-white border-neutral-300" : "bg-panel border-line"}`}>
            <p className={`px-3 pt-2 pb-1 text-[11.5px] ${muted}`}>Tag a place</p>
            {matches.map((t, i) => (
              <button key={t.id} role="option" aria-selected={i === pick} type="button" onMouseDown={(e) => { e.preventDefault(); choose(t); }}
                className={`block w-full text-left px-3 py-1.5 text-[14px] ${i === pick ? (paper ? "bg-neutral-100" : "bg-panel-3") : ""}`}>{t.label}</button>
            ))}
          </div>
        )}
        {dict.listening && <p className={`text-[12.5px] ${paper ? "text-neutral-600" : "text-muted"}`}>Listening, let go when you're done{places.length ? ". Say a room or what's in it and it gets tagged" : ""}… {dict.interim && <span className={paper ? "text-neutral-900" : "text-text"}>“{dict.interim}”</span>}</p>}
        {dict.error && !dict.listening && <p className={`text-[12.5px] ${paper ? "text-amber-700" : "text-amber"}`}>{dict.error}</p>}
        {photo && <p className={`text-[12.5px] ${paper ? "text-neutral-600" : "text-muted"}`}>Photo: {photo.name} <button className="underline" onClick={() => setPhoto(null)}>remove</button></p>}
        <div className="flex gap-1.5 items-end">
          <button type="button" onClick={() => file.current?.click()} aria-label="Add a photo" title="Add a photo"
            className={`h-10 w-10 shrink-0 grid place-items-center rounded-[4px] border ${paper ? "border-neutral-300 bg-white text-neutral-700" : "border-line bg-panel-2 text-muted hover:text-text"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </button>
          {places.length > 0 && (
            <button type="button" onClick={() => { setText((s) => `${s}${s && !/\s$/.test(s) ? " " : ""}@`); box.current?.focus(); }} aria-label="Tag a room or object" title="Tag a room or object"
              className={`h-10 w-10 shrink-0 grid place-items-center rounded-[4px] border font-semibold text-[17px] ${paper ? "border-neutral-300 bg-white text-neutral-700" : "border-line bg-panel-2 text-muted hover:text-text"}`}>@</button>
          )}
          {dict.supported && !dict.blocked && (
            <button type="button" {...dict.hold()} aria-pressed={dict.listening} aria-label="Hold to talk" title={places.length ? "Hold and speak. Rooms and things you name get tagged." : "Hold and speak"}
              className={`h-10 w-10 shrink-0 grid place-items-center rounded-[4px] border ${dict.listening ? "bg-red-600 border-red-600 text-white animate-pulse" : paper ? "border-neutral-300 bg-white text-neutral-700" : "border-line bg-panel-2 text-muted hover:text-text"}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill={dict.listening ? "currentColor" : "none"} /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button>
          )}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <textarea ref={box} value={text} onChange={(e) => { setText(e.target.value); setPick(0); }} rows={1} placeholder={`Message ${other}`}
            onKeyDown={(e) => {
              if (matches.length) {
                if (e.key === "ArrowDown") { e.preventDefault(); return setPick((i) => (i + 1) % matches.length); }
                if (e.key === "ArrowUp") { e.preventDefault(); return setPick((i) => (i - 1 + matches.length) % matches.length); }
                if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); return choose(matches[Math.min(pick, matches.length - 1)]); }
                if (e.key === "Escape") { e.preventDefault(); return setText((s) => s.replace(/@([^@\n]{0,40})$/, "$1")); }
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
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
