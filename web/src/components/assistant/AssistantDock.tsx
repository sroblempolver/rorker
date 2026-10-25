"use client";
// The assistant on screens with no job open (all jobs): it can still find and change any job.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Assistant } from "./Assistant";
import { askServer } from "./client";

export function AssistantDock() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return <Assistant send={askServer} context={{ where: "the all-jobs list" }} onChanged={() => router.refresh()} open={open} setOpen={setOpen} wide />;
}
