"use client";
import { addMember, removeMember, updateMember } from "@/app/settings/actions";
import { TeamManager } from "@/components/team/TeamManager";
import type { Member } from "@/lib/data/types";
import { unwrap } from "@/lib/result";

const api = {
  add: (...a: Parameters<typeof addMember>) => unwrap(addMember(...a)),
  update: (...a: Parameters<typeof updateMember>) => unwrap(updateMember(...a)),
  remove: (...a: Parameters<typeof removeMember>) => unwrap(removeMember(...a)),
};

export function TeamClient(p: { initial: Member[]; canManage: boolean; meId: string | null }) {
  return <TeamManager {...p} api={api} />;
}
