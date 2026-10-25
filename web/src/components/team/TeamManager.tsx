"use client";
// The team: everyone who works on the company's jobs, the owner included. Admins add people, change
// roles and remove them; employees see the list. People can be added before they have an account, so
// they can be tagged on pins right away; they join by signing in with the same email.
import { useState } from "react";
import type { Member, MemberInput, MemberRole } from "@/lib/data/types";
import { Avatar } from "./Avatar";

export interface TeamApi {
  add(input: MemberInput): Promise<Member[]>;
  update(id: string, input: Partial<MemberInput>): Promise<Member[]>;
  remove(id: string): Promise<Member[]>;
}

const ROLE: Record<MemberRole, { label: string; can: string }> = {
  admin: { label: "Admin", can: "Everything: jobs, pins and stages, plus company details, the team, roles and stage templates." },
  employee: { label: "Employee", can: "Editor: works on jobs, pins, notes, photos and stages. Can't change the company, the team or templates." },
};

function RolePick({ value, onChange, disabled }: { value: MemberRole; onChange: (r: MemberRole) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex rounded-[3px] border border-line overflow-hidden shrink-0">
      {(["admin", "employee"] as const).map((r) => (
        <button key={r} type="button" disabled={disabled} onClick={() => onChange(r)} aria-pressed={value === r}
          className={`h-8 px-2.5 text-[12.5px] font-display font-bold uppercase tracking-[0.08em] ${value === r ? (r === "admin" ? "bg-accent text-accent-ink" : "bg-panel-3 text-text") : "bg-panel-2 text-muted hover:text-text"} disabled:cursor-default`}>
          {ROLE[r].label}
        </button>
      ))}
    </div>
  );
}

export function TeamManager({ initial, canManage, meId, api }: { initial: Member[]; canManage: boolean; meId: string | null; api: TeamApi }) {
  const [members, setMembers] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const blank: MemberInput = { full_name: "", title: "", email: "", phone: "", role: "employee" };
  const [form, setForm] = useState<MemberInput>(blank);
  const [edit, setEdit] = useState<MemberInput>(blank);

  const run = async (fn: () => Promise<Member[]>) => {
    setErr(null);
    setBusy(true);
    try { setMembers(await fn()); return true; } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); return false; } finally { setBusy(false); }
  };
  const admins = members.filter((m) => m.role === "admin").length;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-3">
        {(["admin", "employee"] as const).map((r) => (
          <div key={r} className={`card !rounded-[3px] p-4 border-l-[3px] ${r === "admin" ? "!border-l-accent" : "!border-l-muted"}`}>
            <div className="flex items-baseline gap-2">
              <p className="font-display font-extrabold uppercase tracking-[0.06em] text-[17px]">{ROLE[r].label}</p>
              <span className="font-mono text-[12px] text-muted">{members.filter((m) => m.role === r).length}</span>
            </div>
            <p className="text-[13px] text-muted mt-1">{ROLE[r].can}</p>
          </div>
        ))}
      </div>

      <div className="card !rounded-[4px] divide-y divide-line">
        {members.map((m) => (
          <div key={m.id} className="p-3 sm:p-4">
            {editing === m.id ? (
              <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api.update(m.id, edit))) setEditing(null); }}>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className="input" aria-label="Full name" placeholder="Full name" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
                  <input className="input" aria-label="Title or trade" placeholder="Title or trade" value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                  <input className="input" type="email" aria-label="Email" placeholder="Email" value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                  <input className="input" aria-label="Phone" placeholder="Phone" value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                </div>
                <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={busy}>Save</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Avatar m={m} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium truncate">
                    {m.full_name}
                    {m.id === meId && <span className="text-muted font-normal"> (you)</span>}
                    {m.is_owner && <span className="ml-2 align-middle tag !h-5 !text-[10.5px]">OWNER</span>}
                  </p>
                  <p className="text-[12.5px] text-muted truncate">{[m.title, m.email, m.phone].filter(Boolean).join(" · ") || "No details yet"}</p>
                  {!m.user_id && <p className="text-[12px] text-amber mt-0.5">Not signed in yet{m.email ? `: joins when they sign in with ${m.email}` : ": add an email so they can sign in"}</p>}
                </div>
                <RolePick value={m.role} disabled={!canManage || busy || m.is_owner || (m.role === "admin" && admins === 1)}
                  onChange={(r) => r !== m.role && run(() => api.update(m.id, { role: r }))} />
                {canManage && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(m.id); setEdit({ full_name: m.full_name, title: m.title ?? "", email: m.email ?? "", phone: m.phone ?? "", role: m.role }); }}>Edit</button>
                    {!m.is_owner && <button className="btn btn-ghost btn-sm hover:!text-red" disabled={busy} onClick={() => { if (confirm(`Remove ${m.full_name} from the team? They'll be untagged from every pin.`)) run(() => api.remove(m.id)); }}>Remove</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {err && <p className="text-red text-sm">{err}</p>}

      {canManage ? (
        <form className="card !rounded-[4px] p-4 sm:p-5 space-y-3 border-t-[3px] !border-t-accent" onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api.add(form))) setForm(blank);
        }}>
          <p className="eyebrow">Add someone</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <input className="input" aria-label="Full name" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            <input className="input" aria-label="Title or trade" placeholder="Title or trade (Site lead, Electrician…)" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="input" type="email" aria-label="Email" placeholder="Email (to sign in)" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" aria-label="Phone" placeholder="Phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RolePick value={form.role} onChange={(r) => setForm({ ...form, role: r })} />
            <span className="text-[12.5px] text-muted flex-1 min-w-[200px]">{ROLE[form.role].can}</span>
            <button className="btn btn-primary" disabled={busy || !form.full_name.trim()}>{busy ? "Adding…" : "Add to team"}</button>
          </div>
          <p className="text-[12px] text-muted">They can be tagged on pins straight away. Email invites come next; for now they join by signing in with this email.</p>
        </form>
      ) : (
        <p className="text-[13px] text-muted">Only an admin can add people or change roles.</p>
      )}
    </div>
  );
}
