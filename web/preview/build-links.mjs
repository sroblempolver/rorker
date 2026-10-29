// Copies the link rules (what crew and clients may see and change) into the `build` edge function, so
// the server and the page use exactly the same rules: node preview/build-links.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
await esbuild.build({
  stdin: {
    contents: `export { fromRecords } from "@/lib/cloud/records";
export { clientBuys, clientNote, clientPhotos, clientPinIds, clientView, companyOf, crewPinIds, crewWork, findLink, linkPhoto, photoJobIds } from "@/lib/cloud/links";
export { clientBilling, forClient } from "@/lib/billing/clientGuard";
export { linkLive } from "@/lib/share";
export { cleanPlaces } from "@/lib/plan/tags";
export { teamFor } from "@/lib/cloud/team";`,
    resolveDir: root, loader: "ts",
  },
  bundle: true, format: "esm", target: "es2022", platform: "neutral",
  outfile: path.join(root, "../supabase/functions/build/core.js"),
  alias: { "@": path.join(root, "src") },
  banner: { js: "// Generated from web/src/lib (cloud/, share.ts, billing/clientGuard.ts) by web/preview/build-links.mjs. Do not edit." },
});
console.log("supabase/functions/build/core.js");
