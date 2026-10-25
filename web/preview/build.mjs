// Builds the standalone preview into one HTML file: node preview/build.mjs [out.html]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const out = process.argv[2] || path.join(here, "dist", "index.html");
fs.mkdirSync(path.join(here, "dist"), { recursive: true });

const js = await esbuild.build({
  entryPoints: [path.join(here, "main.tsx")], bundle: true, minify: true, write: false, format: "iife", target: "es2020",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, loader: { ".json": "json" },
  alias: { "@": path.join(root, "src"), "next/navigation": path.join(here, "shims/navigation.ts"), "next/link": path.join(here, "shims/link.tsx") },
});
const cssFile = path.join(here, "dist", "styles.css");
execFileSync(path.join(root, "node_modules/.bin/tailwindcss"), ["-i", path.join(here, "styles.css"), "-o", cssFile, "--minify"], { cwd: root, stdio: "inherit" });
const css = fs.readFileSync(cssFile, "utf8");
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<title>Rorker Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Chakra+Petch:wght@500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${code}</script>
`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + " KB");
