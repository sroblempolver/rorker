// Copies the assistant's instructions and tool list (and the object catalogue) into the Supabase edge
// functions, so the hosted preview's assistants talk exactly like the app's: node preview/build-function.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
await esbuild.build({
  stdin: { contents: 'export { instructions, TOOLS } from "@/lib/assistant/core";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", target: "es2022", platform: "neutral", mainFields: ["module", "main"],
  outfile: path.join(root, "../supabase/functions/assistant/core.js"),
  alias: { "@": path.join(root, "src") },
  banner: { js: "// Generated from web/src/lib/assistant/core.ts by web/preview/build-function.mjs. Do not edit." },
});
console.log("supabase/functions/assistant/core.js");
// the New project assistant gets the same catalogue of objects
await esbuild.build({
  stdin: { contents: 'export { OBJECT_KINDS, catalogBrief } from "@/lib/plan/catalog";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", target: "es2022", platform: "neutral", mainFields: ["module", "main"],
  outfile: path.join(root, "../supabase/functions/new-project/catalog.js"),
  alias: { "@": path.join(root, "src") },
  banner: { js: "// Generated from web/src/lib/plan/catalog.ts by web/preview/build-function.mjs. Do not edit." },
});
console.log("supabase/functions/new-project/catalog.js");
