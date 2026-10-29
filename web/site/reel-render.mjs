// Renders the voice reel to MP4, frame by frame, with the page's clock stepped by hand so every frame is
// exact: node site/reel-render.mjs [out.mp4]. Needs the built site (npm run site), Playwright and ffmpeg.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// Playwright may be installed globally rather than in this package
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const out = path.resolve(process.argv[2] || path.join(dist, "rorker-voice-reel.mp4"));
const FPS = 30, LENGTH = 15000;
const frames = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));

const server = http.createServer((req, res) => {
  const f = path.join(dist, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "reel.html");
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", f.endsWith(".html") ? "text/html" : "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await page.clock.install({ time: 0 });
// hold the clock still, so time only moves when a frame is stepped (slow software rendering must not leak in)
await page.clock.pauseAt(1000);
await page.goto(`http://localhost:${port}/reel.html`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.clock.runFor(50);
const total = Math.round((LENGTH / 1000) * FPS);
for (let i = 0; i < total; i++) {
  await page.clock.runFor(1000 / FPS);
  await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
  if (i % 30 === 0) console.log(`frame ${i}/${total}`);
}
await browser.close();
server.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", out], { stdio: "inherit" });
fs.rmSync(frames, { recursive: true, force: true });
console.log(out);
