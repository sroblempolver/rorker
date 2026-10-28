"use client";
// The app's own screens in the Go to box (Ctrl+K), plus the box itself and its button for the top bar.
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { GoToButton, GoToHost, useGoTo, type GoItem } from "./GoTo";

export function AppGoTo() {
  const router = useRouter();
  const items = useMemo<GoItem[]>(() => [
    { id: "page:jobs", group: "Go to", label: "All jobs", run: () => router.push("/jobs") },
    { id: "page:new", group: "Go to", label: "New job", sub: "from a drawing, PDF or photo", run: () => router.push("/jobs/new") },
    { id: "page:team", group: "Go to", label: "Team", run: () => router.push("/settings/team") },
    { id: "page:company", group: "Go to", label: "Company settings", run: () => router.push("/settings") },
    { id: "page:stages", group: "Go to", label: "Stage templates", run: () => router.push("/settings/stages") },
  ], [router]);
  useGoTo("app", items);
  return <><GoToButton /><GoToHost /></>;
}
