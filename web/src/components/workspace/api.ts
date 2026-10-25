// What the job workspace needs from the outside world. The app wires it to server actions; the
// standalone preview wires it to memory, so the same screens run in both.
import type { ElementState, Job, JobStage, Member, Pin, PinComment, PinInput, PinStatus, PlanRow, PlanRun, StageStatus } from "@/lib/data/types";

export interface WorkspaceData {
  job: Job;
  plan: PlanRow | null;
  stages: JobStage[];
  pins: Pin[];
  states: ElementState[];
  runs: PlanRun[];
  members: Member[];
  aiAvailable: boolean;
}

export interface WorkspaceApi {
  setElementState(elementId: string, status: ElementState["status"] | null): Promise<void>;
  createPin(input: PinInput): Promise<Pin>;
  updatePin(pinId: string, input: Partial<PinInput> & { status?: PinStatus }): Promise<void>;
  deletePin(pinId: string): Promise<void>;
  listComments(pinId: string): Promise<PinComment[]>;
  addComment(pinId: string, body: string, photos: File[]): Promise<PinComment[]>;
  setStageStatus(stageId: string, status: StageStatus): Promise<JobStage[]>;
  addStage(name: string): Promise<JobStage[]>;
  renameStage(stageId: string, name: string): Promise<JobStage[]>;
  deleteStage(stageId: string): Promise<JobStage[]>;
  moveStage(stageId: string, dir: -1 | 1): Promise<JobStage[]>;
  uploadPlan(file: File): Promise<void>;
  answer(planId: string, answers: Record<string, string>): Promise<void>;
  refreshPlan(): Promise<{ runs: PlanRun[]; plan: PlanRow | null }>;
  backHref: string;
}
