// Copies the assistant's instructions and tool list into the Supabase edge function, so the hosted
// preview's assistant talks exactly like the app's: node preview/build-function.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
await esbuild.build({
  stdin: { contents: 'export { instructions, TOOLS } from "@/lib/assistant/core";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", target: "es2022", platform: "neutral",
  outfile: path.join(root, "../supabase/functions/assistant/core.js"),
  alias: { "@": path.join(root, "src") },
  banner: { js: "// Generated from web/src/lib/assistant/core.ts by web/preview/build-function.mjs. Do not edit." },
});
console.log("supabase/functions/assistant/core.js");
