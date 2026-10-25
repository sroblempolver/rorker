// Staff faces without photos: initials on a hard-hat colour picked from the name, so the same person
// keeps the same colour everywhere (pins, lists, the team page).
import type { Member } from "@/lib/data/types";

const HATS = ["#f3c530", "#ff6a1f", "#55b2ff", "#3fb46a", "#f0ece3", "#db4ea6", "#2fb7a1", "#e8432e"];

export function hatColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HATS[h % HATS.length];
}

export const initials = (name: string) => name.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export function Avatar({ m, size = 26, ring }: { m: Pick<Member, "full_name">; size?: number; ring?: boolean }) {
  return (
    <span title={m.full_name} className="shrink-0 inline-grid place-items-center rounded-[3px] font-mono font-bold text-[#141310]"
      style={{ width: size, height: size, fontSize: size * 0.4, background: hatColor(m.full_name), boxShadow: ring ? "0 0 0 2px var(--panel)" : undefined }}>
      {initials(m.full_name)}
    </span>
  );
}

/** Up to four faces in a row, then "+n". */
export function AvatarStack({ members, size = 20 }: { members: Pick<Member, "id" | "full_name">[]; size?: number }) {
  if (!members.length) return null;
  return (
    <span className="inline-flex items-center -space-x-1">
      {members.slice(0, 4).map((m) => <Avatar key={m.id} m={m} size={size} ring />)}
      {members.length > 4 && <span className="pl-2 font-mono text-[11px] text-muted">+{members.length - 4}</span>}
    </span>
  );
}

/** Tag staff: tap a person to tag or untag them. */
export function StaffPicker({ members, value, onChange, compact }: { members: Member[]; value: string[]; onChange: (ids: string[]) => void; compact?: boolean }) {
  if (!members.length) return <p className="text-[12.5px] text-muted">No staff yet. Add your team under Team.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map((m) => {
        const on = value.includes(m.id);
        return (
          <button type="button" key={m.id} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
            title={[m.full_name, m.title].filter(Boolean).join(" · ")}
            className={`inline-flex items-center gap-1.5 rounded-[3px] border pr-2 ${compact ? "h-7 pl-0.5 text-[12px]" : "h-8 pl-1 text-[13px]"} ${on ? "border-chalk bg-chalk/15 text-text" : "border-line bg-panel-2 text-muted hover:text-text"}`}>
            <Avatar m={m} size={compact ? 22 : 24} />
            <span className="truncate max-w-[110px]">{compact ? m.full_name.split(" ")[0] : m.full_name}</span>
            {on && <span className="text-chalk text-[11px]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
