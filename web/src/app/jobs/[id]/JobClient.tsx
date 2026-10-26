"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import * as A from "@/app/jobs/actions";
import type { WorkspaceApi, WorkspaceData } from "@/components/workspace/api";
import { JobWorkspace } from "@/components/workspace/JobWorkspace";
import { unwrap } from "@/lib/result";
import { askServer } from "@/components/assistant/client";

export function JobClient({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const id = data.job.id;
  const api = useMemo<WorkspaceApi>(() => ({
    backHref: "/jobs",
    setElementState: (el, s) => A.setElementState(id, el, s),
    saveElementEdit: (el, d) => unwrap(A.saveElementEdit(id, el, d)),
    createItem: (input) => unwrap(A.createItem(id, input)),
    updateItem: (item, input) => unwrap(A.updateItem(id, item, input)),
    deleteItem: (item) => unwrap(A.deleteItem(id, item)),
    createPin: (input) => A.createPin(id, input),
    updatePin: (pin, input) => unwrap(A.updatePin(id, pin, input)),
    deletePin: (pin) => A.deletePin(id, pin),
    listComments: (pin) => A.listComments(id, pin),
    addComment: (pin, body, photos) => {
      const f = new FormData();
      f.set("pin_id", pin);
      f.set("body", body);
      photos.forEach((p) => f.append("photos", p));
      return A.addComment(id, f);
    },
    setStageStatus: (s, st) => A.setStageStatus(id, s, st),
    addStage: (n) => A.addStage(id, n),
    renameStage: (s, n) => A.renameStage(id, s, n),
    deleteStage: (s) => A.deleteStage(id, s),
    moveStage: (s, d) => A.moveStage(id, s, d),
    uploadPlan: (file) => { const f = new FormData(); f.set("plan", file); return A.uploadPlan(id, f); },
    answer: (planId, answers) => A.answerQuestions(id, planId, answers),
    refreshPlan: () => A.refreshPlan(id),
    listShareLinks: () => unwrap(A.listShareLinks(id)),
    createShareLink: (input) => unwrap(A.createShareLink(id, input)),
    revokeShareLink: (link) => unwrap(A.revokeShareLink(id, link)),
    personLink: (member) => unwrap(A.personLink(id, member)),
    shareUrl: (token) => `${window.location.origin}/s/${token}`,
    ask: askServer,
    afterAssistant: () => router.refresh(),
  }), [id, router]);
  return <JobWorkspace data={data} api={api} onAllJobs={() => router.push("/jobs")} />;
}
