"use client";
// The company's staff and who is looking, for anything in the job workspace that tags or shows people.
import { createContext, useContext } from "react";
import type { Member } from "@/lib/data/types";

export const TeamContext = createContext<{ members: Member[]; me: string | null }>({ members: [], me: null });
export const useTeam = () => useContext(TeamContext);
