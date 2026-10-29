"use client";
// Share a job with someone who doesn't sign in: a team member (they see every task tagged to them,
// now and later) or a one-time sub (they see the tasks you pick). They get a link, nothing to install.
import { useEffect, useState } from "react";
import type { Member, Pin, ShareLink } from "@/lib/data/types";
import type { Plan } from "@/lib/plan/types";
import { linkLive, linkPins } from "@/lib/share";
import { useEscape } from "@/components/ui/hotkeys";
import type { WorkspaceApi } from "./api";
import { PinBadge, where } from "./PinsPanel";

const DAY = 86400000;

export function ShareDialog({ api, members, pins, plan, onClose }: { api: WorkspaceApi; members: Member[]; pins: Pin[]; plan: Plan | null; onClose: () => void }) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [who, setWho] = useState<string>(members.find((m) => !m.is_owner)?.id ?? "sub");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [days, setDays] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { api.listShareLinks?.().then(setLinks).catch((e) => setErr(e.message)); }, [api]);
  useEffect(() => { setDays(who === "sub" ? 30 : 0); }, [who]);
  useEscape(onClose);

  const member = members.find((m) => m.id === who) ?? null;
  const theirs = member ? pins.filter((p) => p.tagged.includes(member.id) && p.status !== "done") : [];
  const others = pins.filter((p) => p.status !== "done" && !theirs.includes(p)).sort((a, b) => a.number - b.number);
  const url = (l: ShareLink) => api.shareUrl?.(l.token) ?? `/s/${l.token}`;

  const copy = async (l: ShareLink) => {
    try { await navigator.clipboard.writeText(url(l)); setCopied(l.id); setTimeout(() => setCopied((c) => (c === l.id ? null : c)), 2000); }
    catch { window.prompt("Copy this link", url(l)); }
  };

  const create = async () => {
    setErr(null);
    setBusy(true);
    try {
      const label = member ? `${member.full_name}${member.title ? ` (${member.title})` : ""}` : name.trim();
      const l = await api.createShareLink!({ label, member_id: member?.id ?? null, pin_ids: [...picked], expires_at: days ? new Date(Date.now() + days * DAY).toISOString() : null });
      setMade(l);
      setLinks((x) => [l, ...(x ?? [])]);
      setPicked(new Set());
      setName("");
      void copy(l);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't make the link."); }
    finally { setBusy(false); }
  };

  const revoke = async (l: ShareLink) => {
    try { await api.revokeShareLink!(l.id); setLinks((x) => (x ?? []).map((y) => (y.id === l.id ? { ...y, revoked_at: new Date().toISOString() } : y))); if (made?.id === l.id) setMade(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't turn it off."); }
  };

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const scope = (l: ShareLink) => {
    if (l.audience === "contractor") return l.taken_by ? `Your contractor: taken on by ${l.taken_by}` : "Your contractor: not opened yet";
    if (l.audience === "client") return "Client page";
    const n = linkPins(l, pins).length;
    return `${n} task${n === 1 ? "" : "s"}${l.member_id ? ", plus new ones tagged to them" : ""}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Share this job" className="w-full max-w-[560px] max-h-[calc(100vh-24px)] flex flex-col bg-panel border border-line border-t-[3px] border-t-accent rounded-[6px] shadow-2xl">
        <header className="flex items-center gap-2 px-4 h-12 border-b border-line shrink-0">
          <h2 className="font-display font-extrabold uppercase tracking-[0.08em] text-[15px]">Share this job</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto w-8 h-8 grid place-items-center text-muted hover:text-text">✕</button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-4">
          <p className="text-[13.5px] text-muted">They open a link, no sign-in and nothing to download. They see the plan and only their own tasks: no client details, no prices, nobody else&apos;s work.</p>
          {api.contractorLink && <ToContractor api={api} copy={copy} copied={copied} />}

          <div className="space-y-2">
            <label className="eyebrow !text-[11.5px] block" htmlFor="share-who">Who is it for?</label>
            <select id="share-who" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
              {members.filter((m) => !m.is_owner).map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.title ? ` · ${m.title}` : ""}</option>)}
              <option value="sub">Someone else (a one-time sub)</option>
            </select>
            {who === "sub" && <input className="input" placeholder="Their name or company, e.g. Ace Drywall" value={name} onChange={(e) => setName(e.target.value)} aria-label="Their name or company" />}
            {member && <p className="text-[13px] text-muted">They&apos;ll see the {theirs.length} open task{theirs.length === 1 ? "" : "s"} tagged to them, and any you tag them on later.{others.length ? " Add more below if you like." : ""}</p>}
          </div>

          {others.length > 0 && (
            <div className="space-y-1.5">
              <p className="eyebrow !text-[11.5px]">{member ? "Also show" : "Tasks they should see"}</p>
              <div className="max-h-[220px] overflow-y-auto scroll-thin space-y-1 pr-1">
                {others.map((p) => (
                  <label key={p.id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-[3px] border cursor-pointer ${picked.has(p.id) ? "border-accent bg-panel-2" : "border-line hover:border-chalk"}`}>
                    <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="accent-[var(--color-accent)]" />
                    <PinBadge pin={p} size={20} />
                    <span className="min-w-0 flex-1"><span className="block text-[13.5px] truncate">{p.title}</span><span className="block text-[11.5px] text-muted truncate">{where(plan, p)}</span></span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow !text-[11.5px]">Link works</span>
            {[[0, "Until I turn it off"], [7, "7 days"], [30, "30 days"]].map(([d, l]) => (
              <button key={d} type="button" onClick={() => setDays(d as number)} className={`chip !h-8 ${days === d ? "!text-accent !border-accent" : ""}`}>{l}</button>
            ))}
          </div>

          {err && <p className="text-[13px] text-red">{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy || (who === "sub" && (!name.trim() || !picked.size))} onClick={create}>{busy ? "Making the link…" : "Make the link"}</button>

          {made && (
            <div className="card !rounded-[3px] border-l-[3px] !border-l-accent p-3 space-y-2">
              <p className="text-[13.5px]">Link for <b>{made.label}</b>{copied === made.id ? " is copied. Paste it in a text or email." : "."}</p>
              <div className="flex gap-2">
                <input readOnly className="input !h-9 font-mono text-[12px] flex-1" value={url(made)} onFocus={(e) => e.currentTarget.select()} aria-label="The link" />
                <button className="btn btn-ghost btn-sm" onClick={() => copy(made)}>{copied === made.id ? "Copied" : "Copy"}</button>
              </div>
              {api.openShare && <button className="text-[13px] text-accent underline" onClick={() => api.openShare!(made.token)}>See what they see</button>}
            </div>
          )}

          {links && links.length > 0 && (
            <div className="space-y-1.5">
              <p className="eyebrow !text-[11.5px]">Links you&apos;ve sent</p>
              {links.map((l) => {
                const live = linkLive(l);
                return (
                  <div key={l.id} className={`flex items-center gap-2 px-3 py-2 rounded-[3px] border border-line ${live ? "" : "opacity-55"}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] truncate">{l.label}</span>
                      <span className="block text-[11.5px] text-muted truncate">{live ? `${scope(l)}${l.expires_at ? ` · until ${l.expires_at.slice(0, 10)}` : ""}${l.saved_by?.length ? ` · in ${l.saved_by.join(", ")}'s account` : ""}` : l.revoked_at ? "Turned off" : "Ran out"}</span>
                    </span>
                    {live && <>
                      {api.openShare && <button className="text-[12.5px] text-muted hover:text-text" onClick={() => api.openShare!(l.token)}>Open</button>}
                      <button className="text-[12.5px] text-muted hover:text-text" onClick={() => copy(l)}>{copied === l.id ? "Copied" : "Copy"}</button>
                      <button className="text-[12.5px] text-red hover:underline" onClick={() => revoke(l)}>Turn off</button>
                    </>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** A homeowner's own project: one link for their contractor, who takes it on into their Rorker account
 *  (the full job), while the homeowner keeps the client page of that same job in theirs. */
function ToContractor({ api, copy, copied }: { api: WorkspaceApi; copy: (l: ShareLink) => Promise<void>; copied: string | null }) {
  const [l, setL] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const make = async () => {
    setBusy(true); setErr(null);
    try { const x = await api.contractorLink!(); setL(x); void copy(x); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't make the link."); }
    setBusy(false);
  };
  return (
    <div className="rounded-[4px] border border-line p-3 space-y-2">
      <p className="text-[13.5px]"><span className="font-semibold">Your own home?</span> Send this project to your contractor. They take it on in their Rorker account, and you keep following it from yours: progress, messages and their bills.</p>
      {l ? (
        <div className="flex items-center gap-2">
          <input readOnly value={api.shareUrl?.(l.token) ?? ""} aria-label="Link for your contractor" className="input !h-8 text-[12.5px] flex-1" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn btn-sm" onClick={() => copy(l)}>{copied === l.id ? "Copied" : "Copy"}</button>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={make} disabled={busy}>{busy ? "Making the link…" : "Send to my contractor"}</button>
      )}
      {err && <p className="text-red text-[12.5px]">{err}</p>}
    </div>
  );
}
