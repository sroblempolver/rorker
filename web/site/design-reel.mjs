// Records the 15-second design-tool reel from the real app, frame by frame:
//   node site/design-reel.mjs <app url> <out.mp4> [peek times in s, comma separated]
// The app runs on its sample data (Edit plan on the Hadley Road house). A scripted cursor moves a wall, drops in a
// door, fills the kitchen with cabinets and opens the client's 3D view. The camera is a CSS transform on the app's
// root, so zoomed shots stay sharp. The page clock is held still and stepped one frame at a time.
// With peek times it only saves those frames as PNGs next to out, to check the script quickly.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const [url, outArg, peekArg] = process.argv.slice(2);
if (!outArg) { console.error("node site/design-reel.mjs <app url> <out.mp4> [peek times]"); process.exit(1); }
const out = path.resolve(outArg);
const peek = peekArg ? peekArg.split(",").map(Number) : null;
const FPS = 30, LENGTH = 15, W = 810, H = 1440;
const symbol = fs.readFileSync(path.join(here, "../public/brand/symbol-orange.svg"), "utf8");

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// camera: [time, zoom, left, top] of the page window that fills the frame
const CAM = [[0, 1, 0, 0], [1.0, 1, 0, 0], [1.9, 1.4, 0, 46], [8.0, 1.4, 0, 46], [8.7, 1, 0, 0], [9.6, 1, 0, 0], [10.4, 1.25, 81, 288]];
// cursor waypoints in page px: [time, x, y]
const PATH = [[0, 860, 1300], [1.5, 400, 600], [2.3, 155, 445], [2.55, 155, 445], [2.8, 67, 453], [3.5, 17, 453],
  [3.9, 17, 453], [4.4, 255, 84], [5.0, 255, 84], [5.4, 105, 394], [6.0, 105, 394], [6.35, 540, 84], [6.7, 540, 84],
  [7.1, 170, 396], [7.9, 170, 396], [8.6, 745, 166], [9.0, 745, 166], [9.5, 530, 716], [10.5, 530, 716], [11.8, 860, 1300]];
// what happens at each time (s): the kitchen gets bigger, a door, a wall of cabinets, then the client's view
const ACTIONS = [
  [2.4, "click"],
  [2.8, "down"], [3.5, "up"],
  [4.55, "selectDoor"],
  [5.45, "click"],
  [6.4, "click"],
  [7.15, "click"],
  [8.65, "click"],
  [9.55, "click"],
];
const lerpKeys = (keys, t) => {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, ...a] = keys[i - 1], [t1, ...b] = keys[i], k = ease((t - t0) / (t1 - t0));
    return a.map((v, j) => v + (b[j] - v) * k);
  }
  return keys.at(-1).slice(1);
};
// drags move in a straight line at an even pace, like a hand
const cursorAt = (t) => {
  if (t > 2.8 && t < 3.5) { const k = (t - 2.8) / 0.7; return [67 - 50 * (0.5 - 0.5 * Math.cos(Math.PI * k)), 453]; }
  return lerpKeys(PATH, t);
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 4 / 3 });
page.setDefaultTimeout(60000);
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
await page.getByText("Or look around on sample data first").click(); await page.waitForTimeout(6000);
await page.getByText("Edit plan", { exact: true }).first().click(); await page.waitForTimeout(8000);
// the live 3D under the plan the whole time, so every change shows in 3D as it's made
await page.getByText("3D", { exact: true }).first().click(); await page.waitForTimeout(5000);
await page.evaluate(() => {
  const box = document.querySelector("div.relative.min-h-\\[420px\\]");
  box.style.height = "500px"; box.style.minHeight = "0";
  let e = box;
  while (e && !(/(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight)) e = e.parentElement;
  (e || document.scrollingElement).scrollTop = 130;
});
await page.waitForTimeout(3000);
// the 3D cut away, seen from above and turned to match the plan, a little closer
await page.getByText("Walls up").first().click(); await page.waitForTimeout(2500);
const drag3d = async (x0, y0, x1, y1, button = "left") => {
  await page.mouse.move(x0, y0); await page.mouse.down({ button });
  for (let k = 1; k <= 10; k++) { await page.mouse.move(x0 + ((x1 - x0) * k) / 10, y0 + ((y1 - y0) * k) / 10); await page.waitForTimeout(60); }
  await page.mouse.up({ button }); await page.waitForTimeout(1500);
};
await drag3d(405, 900, 405, 1060);
await drag3d(400, 1000, 440, 1000);
await page.mouse.move(200, 960); await page.mouse.wheel(0, -250); await page.waitForTimeout(2500);
// slide it up and in, so the kitchen sits in the shot with the plan
await drag3d(300, 1100, 380, 920, "right");
await page.mouse.move(200, 850); await page.mouse.wheel(0, -200); await page.waitForTimeout(2500);
await page.evaluate(({ symbol }) => {
  const css = document.createElement("style");
  css.textContent = `
    #root { transform-origin: 0 0; will-change: transform; }
    .rk-cursor { position: fixed; left: 0; top: 0; z-index: 99999; pointer-events: none; width: 34px; height: 34px; filter: drop-shadow(0 3px 6px rgba(0,0,0,.55)); }
    .rk-ring { position: fixed; z-index: 99998; pointer-events: none; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; border: 3px solid #ff6a1f; opacity: 0; }
    .rk-end { position: fixed; inset: 0; z-index: 99997; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(18,19,21,.9); color: #f0ece3; opacity: 0; pointer-events: none; }
    .rk-end .mark { width: 170px; line-height: 0; margin-bottom: 44px; } .rk-end .mark svg { width: 100%; height: auto; }
    .rk-end h2 { font: 900 124px/.88 "Big Shoulders Stencil", "Big Shoulders", sans-serif; text-transform: uppercase; margin: 0 0 50px; }
    .rk-end .url { font: 800 44px/1 "Big Shoulders", sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #ff6a1f; border: 3px solid #ff6a1f; padding: 16px 32px; border-radius: 4px; }`;
  document.head.append(css);
  document.body.insertAdjacentHTML("beforeend", `<div class="rk-ring"></div>
    <svg class="rk-cursor" viewBox="0 0 24 24"><path d="M4 2l15 11.2-6.6.9 3.9 7.4-3 1.5-3.8-7.5L4 20z" fill="#fff" stroke="#121315" stroke-width="1.4" stroke-linejoin="round"/></svg>
    <div class="rk-end"><span class="mark">${symbol}</span><h2>Design it<br>on the house.</h2><div class="url">rorker.com</div></div>`);
}, { symbol });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1000);

const frames = fs.mkdtempSync(path.join(os.tmpdir(), "design-reel-"));
const total = LENGTH * FPS;
const done = new Set();
let lastRing = -9;
for (let i = 0; i < total; i++) {
  const t = i / FPS;
  const [z, cx, cy] = lerpKeys(CAM, t);
  const [px, py] = cursorAt(t);
  const sx = (px - cx) * z, sy = (py - cy) * z;
  for (const [at, what] of ACTIONS) {
    if (done.has(at) || t < at) continue;
    done.add(at);
    if (what === "selectDoor") await page.locator("select").filter({ hasText: "Doors & windows" }).first().selectOption({ label: "Door" });
    else if (what === "click") await page.mouse.click(sx, sy);
    else if (what === "escape") await page.keyboard.press("Escape");
    else if (what === "down") await page.mouse.down();
    else if (what === "up") await page.mouse.up();
    if (what !== "up" && what !== "escape") lastRing = at;
  }
  await page.mouse.move(sx, sy);
  const ring = Math.max(0, (t - lastRing) / 0.45);
  const end = ease((t - 13.1) / 0.6);
  await page.evaluate(({ z, cx, cy, sx, sy, ring, end }) => {
    document.getElementById("root").style.transform = `translate(${-cx * z}px, ${-cy * z}px) scale(${z})`;
    document.querySelector(".rk-cursor").style.transform = `translate(${sx - 6}px, ${sy - 3}px)`;
    const r = document.querySelector(".rk-ring");
    r.style.left = `${sx}px`; r.style.top = `${sy}px`;
    r.style.opacity = ring < 1 ? String(1 - ring) : "0"; r.style.transform = `scale(${0.3 + ring})`;
    document.querySelector(".rk-end").style.opacity = String(end);
  }, { z, cx, cy, sx, sy, ring, end });
  // the build plays as a time-lapse, so the house gets its walls and roof before the end card
  await page.clock.runFor((1000 / FPS) * (t >= 9.6 && t < 13.2 ? 3 : 1));
  if (peek && !peek.some((p) => Math.abs(p - t) < 0.5 / FPS)) continue;
  const file = peek ? out.replace(/\.mp4$/, `-${t.toFixed(1)}.png`) : path.join(frames, `f${String(i).padStart(5, "0")}.png`);
  await page.screenshot({ path: file, timeout: 0 });
  if (i % 60 === 0) console.log(`frame ${i}/${total}`);
}
await browser.close();
if (!peek) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "f%05d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", out], { stdio: "inherit" });
  fs.rmSync(frames, { recursive: true, force: true });
}
console.log(out);
