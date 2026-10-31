// Builds rorker.com into one HTML file plus icons: node site/build.mjs [out-dir]
// The page bundles the app's own 3D house (src/components/plan/Plan3D.tsx) on the sample drawing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const out = path.resolve(process.argv[2] || path.join(here, "dist"));
fs.mkdirSync(out, { recursive: true });

const js = await esbuild.build({
  entryPoints: [path.join(here, "main.tsx")], bundle: true, minify: true, write: false, format: "iife", target: "es2020",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, loader: { ".json": "json", ".svg": "text" },
  alias: { "@": path.join(root, "src") },
});
const css = fs.readFileSync(path.join(here, "site.css"), "utf8");
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const title = "Rorker: run every job from above";
const desc = "Job software for contractors. Drop in the drawing and get the house in 3D. Pin the work where it goes, tag your crew, ask it anything, and watch the job move.";
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="apple-touch-icon.png"><meta name="theme-color" content="#121315">
<meta property="og:type" content="website"><meta property="og:site_name" content="Rorker"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="https://rorker.com/"><meta property="og:image" content="https://rorker.com/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="https://rorker.com/og.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@600;700;800;900&family=Big+Shoulders+Stencil:wght@800;900&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>${css}</style>
</head><body>
<div id="root"></div>
<noscript><p style="padding:40px;color:#f0ece3;font-family:sans-serif">Rorker: job software for contractors. Turn on JavaScript to see the live house, or open the app at <a href="https://build.rorker.com/" style="color:#ff6a1f">build.rorker.com</a>.</p></noscript>
<script>${code}</script>
</body></html>
`;
fs.writeFileSync(path.join(out, "index.html"), html);
const brand = path.join(root, "public/brand");
for (const [from, to] of [["favicon.svg", "favicon.svg"], ["app-icon-180.png", "apple-touch-icon.png"], ["rorker-horizontal-orange-1200.png", "logo-1200.png"]]) fs.copyFileSync(path.join(brand, from), path.join(out, to));
fs.copyFileSync(path.join(root, "src/app/favicon.ico"), path.join(out, "favicon.ico"));
if (fs.existsSync(path.join(here, "og.png"))) fs.copyFileSync(path.join(here, "og.png"), path.join(out, "og.png"));
console.log(path.join(out, "index.html"), (html.length / 1024).toFixed(0) + " KB");

// the 9:16 reels, each a page rendered to MP4 by site/reel-render.mjs: the 15-second voice reel and the
// 1-minute build-stages film
for (const [name, title] of [["reel", "Rorker voice reel"], ["film", "Rorker: drawing to house"]]) {
  const built = await esbuild.build({
    entryPoints: [path.join(here, `${name}.tsx`)], bundle: true, minify: true, write: false, format: "iife", target: "es2020",
    jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, loader: { ".json": "json", ".svg": "text" },
    alias: { "@": path.join(root, "src") },
  });
  fs.writeFileSync(path.join(out, `${name}.html`), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=540"><title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@600;700;800;900&family=Big+Shoulders+Stencil:wght@800;900&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>${fs.readFileSync(path.join(here, `${name}.css`), "utf8")}</style></head><body><div id="root"></div>
<script>${built.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script></body></html>
`);
}
