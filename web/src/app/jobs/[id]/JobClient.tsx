"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import * as A from "@/app/jobs/actions";
import type { WorkspaceApi, WorkspaceData } from "@/components/workspace/api";
import { JobWorkspace } from "@/components/workspace/JobWorkspace";

export function JobClient({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const id = data.job.id;
  const api = useMemo<WorkspaceApi>(() => ({
    backHref: "/jobs",
    setElementState: (el, s) => A.setElementState(id, el, s),
    createPin: (input) => A.createPin(id, input),
    updatePin: (pin, input) => A.updatePin(id, pin, input),
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
  }), [id]);
  return <JobWorkspace data={data} api={api} onAllJobs={() => router.push("/jobs")} />;
}
