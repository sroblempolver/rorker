// The team board's rules, the same on the page and in the `build` edge function: what a crew member's
// link shows of it, and who an office message may be sent to.
import type { Member, TeamMessage } from "@/lib/data/types";

/** What one crew member sees: messages to everyone, messages to them, and their own answers. */
export function teamFor(list: TeamMessage[], memberId: string): TeamMessage[] {
  return list.filter((m) => (m.from === "office" ? !m.to || m.to.includes(memberId) : m.member_id === memberId));
}

/** Who an office message goes to: everyone (null), or the picked people who are on the team. */
export function cleanTo(v: unknown, members: Pick<Member, "id">[]): string[] | null {
  if (!Array.isArray(v)) return null;
  const ids = new Set(members.map((m) => m.id));
  const to = [...new Set(v.filter((x): x is string => typeof x === "string" && ids.has(x)))];
  return to.length ? to : null;
}

/** "Everyone" or "Marco and Aisha": who a message went to, for the office's list. */
export function toNames(m: TeamMessage, members: Pick<Member, "id" | "full_name">[]): string {
  if (m.from === "crew") return "the office";
  if (!m.to) return "everyone";
  const names = m.to.map((id) => members.find((x) => x.id === id)?.full_name.split(" ")[0] ?? "someone");
  return names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
