// What's new in a thread since this person last looked, kept in this browser. Used for the "new from
// your client" notices (and the client's "new from your contractor"); clears when the thread is opened.
import type { JobMessage } from "@/lib/data/types";

const key = (k: string) => `rorker-seen:${k}`;
export function seenAt(k: string): string {
  try { return localStorage.getItem(key(k)) ?? ""; } catch { return ""; }
}
export function markSeen(k: string, list: JobMessage[]) {
  const last = list.reduce((m, x) => (x.created_at > m ? x.created_at : m), "");
  try { if (last && last > seenAt(k)) { localStorage.setItem(key(k), last); window.dispatchEvent(new Event("rorker-seen")); } } catch { /* private window: notices just don't clear */ }
}
/** messages from the other side that came in after the last look */
export const unread = (list: JobMessage[], side: JobMessage["from"], k: string) => {
  const at = seenAt(k);
  return list.filter((m) => m.from !== side && m.created_at > at);
};
