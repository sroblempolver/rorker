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
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', __ASSISTANT_FUNCTION__: JSON.stringify(process.env.ASSISTANT_FUNCTION || "assistant"), __BUILD__: JSON.stringify(new Date().toISOString().slice(5, 16).replace("T", " ") + " UTC") }, loader: { ".json": "json" },
  alias: { "@": path.join(root, "src"), "next/navigation": path.join(here, "shims/navigation.ts"), "next/link": path.join(here, "shims/link.tsx") },
});
const cssFile = path.join(here, "dist", "styles.css");
execFileSync(path.join(root, "node_modules/.bin/tailwindcss"), ["-i", path.join(here, "styles.css"), "-o", cssFile, "--minify"], { cwd: root, stdio: "inherit" });
const css = fs.readFileSync(cssFile, "utf8");
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Rorker</title>
<link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="apple-touch-icon.png"><meta name="theme-color" content="#17181b">
<meta name="description" content="Run your jobs: plans, tasks and photos for contractors and their crews.">
<meta property="og:type" content="website"><meta property="og:site_name" content="Rorker"><meta property="og:title" content="Rorker"><meta property="og:description" content="Run your jobs: plans, tasks and photos for contractors and their crews."><meta property="og:url" content="https://sroblempolver.github.io/rorker/"><meta property="og:image" content="https://sroblempolver.github.io/rorker/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Rorker"><meta name="twitter:description" content="Run your jobs: plans, tasks and photos for contractors and their crews."><meta name="twitter:image" content="https://sroblempolver.github.io/rorker/og.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@600;700;800&family=Big+Shoulders+Stencil:wght@800&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${code}</script>
`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + " KB");
