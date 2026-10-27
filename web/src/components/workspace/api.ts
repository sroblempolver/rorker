// What the job workspace needs from the outside world. The app wires it to server actions; the
// standalone preview wires it to memory, so the same screens run in both.
import type { AssistantSend } from "@/components/assistant/Assistant";
import type { ClientStart } from "@/components/billing/MoneyPanel";
import type { Billing, Brand } from "@/lib/billing/types";
import type { MaterialLine, MaterialsApi, MaterialsJob } from "@/lib/materials/types";
import type { ElementEdit, ElementState, ItemInput, Job, JobItem, JobStage, Member, Pin, PinComment, PinInput, PinStatus, PlanRow, PlanRun, ShareLink, ShareLinkInput, StageStatus } from "@/lib/data/types";

export interface WorkspaceData {
  job: Job;
  plan: PlanRow | null;
  stages: JobStage[];
  pins: Pin[];
  items: JobItem[];
  edits: Record<string, ElementEdit>;
  states: ElementState[];
  runs: PlanRun[];
  members: Member[];
  /** the signed-in person's team row, for "tagged to me" */
  me: string | null;
  aiAvailable: boolean;
  /** 3D views are a premium feature; false shows the 2D plan only */
  can3d?: boolean;
  /** admins can send no-sign-in links to the job */
  canShare?: boolean;
  /** quotes, invoices and payments for this job; left out, the Money tab is hidden */
  billing?: Billing;
  /** how the company looks on documents the client gets */
  brand?: Brand;
  /** the company's payout account is connected, so clients can pay online */
  payoutsConnected?: boolean;
  /** open on the Money tab (coming back from the client's page) */
  startOnMoney?: boolean;
  /** the materials list: lines on every job this person can see, and those jobs (to split an add) */
  materials?: { lines: MaterialLine[]; jobs: MaterialsJob[] };
}

export interface WorkspaceApi {
  setElementState(elementId: string, status: ElementState["status"] | null): Promise<void>;
  saveElementEdit(elementId: string, data: ElementEdit | null): Promise<void>;
  createItem(input: ItemInput): Promise<JobItem>;
  updateItem(itemId: string, input: Partial<ItemInput>): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
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
  listShareLinks?(): Promise<ShareLink[]>;
  createShareLink?(input: ShareLinkInput): Promise<ShareLink>;
  revokeShareLink?(linkId: string): Promise<void>;
  /** a tagged person's own link: all their tasks for this company, on every job; the same link every time */
  personLink?(memberId: string): Promise<ShareLink>;
  /** the full address of a link, to copy */
  shareUrl?(token: string): string;
  /** the preview has no second page: show what the link shows, right here */
  openShare?(token: string, pinId?: string): void;
  /** the Rorker assistant (chat + voice); left out, the Ask button is hidden */
  ask?: AssistantSend;
  /** the assistant changed something: fetch the job again (a new `data` prop follows) */
  afterAssistant?: () => void;
  /** money for the job: every change to quotes, invoices or payments goes out through save */
  money?: {
    save(b: Billing): void;
    /** show what the client sees on their link */
    openClient?(start: ClientStart): void;
    connectPayouts(): Promise<void>;
  };
  /** the materials list; left out, the Buy tab is hidden */
  materials?: MaterialsApi;
  /** open the shopping run across every job */
  openShopping?: () => void;
}
