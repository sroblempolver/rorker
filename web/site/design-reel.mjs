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
const CAM = process.env.NOZOOM ? [[0, 1, 0, 0]] : [[0, 1, 0, 0], [1.3, 1, 0, 0], [2.2, 1.5, 40, 170], [8.1, 1.5, 40, 170], [8.9, 1, 0, 0]];
// cursor waypoints in page px: [time, x, y]
const PATH = [[0, 860, 1300], [1.6, 600, 700], [2.4, 450, 400], [2.8, 450, 400], [2.95, 222, 431], [3.65, 170, 431],
  [4.2, 170, 431], [4.6, 255, 214], [5.0, 255, 214], [5.35, 112, 522], [6.1, 112, 522], [6.45, 540, 214], [6.8, 540, 214],
  [7.2, 190, 524], [8.0, 190, 524], [8.5, 402, 250], [8.7, 402, 250], [9.0, 745, 297], [9.4, 745, 297],
  [10.0, 530, 798], [11.5, 530, 798], [12.6, 860, 1300]];
// what happens at each time (s)
const ACTIONS = [
  [2.55, "click"],
  [2.95, "down"], [3.65, "up"],
  [4.62, "selectDoor"],
  [5.38, "click"],
  [6.47, "click"],
  [7.22, "click"],
  [8.52, "click"],
  [9.02, "click"],
  [10.02, "click"],
];
const SCROLL = [[9.1, 0], [9.9, 440]]; // the editor's own scroll, to bring the 3D view up under the plan
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
  if (t > 2.95 && t < 3.65) { const k = (t - 2.95) / 0.7; return [222 - 52 * (0.5 - 0.5 * Math.cos(Math.PI * k)), 431]; }
  return lerpKeys(PATH, t);
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 4 / 3 });
page.setDefaultTimeout(60000);
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
await page.getByText("Or look around on sample data first").click(); await page.waitForTimeout(6000);
await page.getByText("Edit plan", { exact: true }).first().click(); await page.waitForTimeout(8000);
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
  // the editor scrolls inside its own box; remember it for the 3D shot
  const canvasless = [...document.querySelectorAll("*")].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 50; });
  window.__rkScroller = canvasless.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement;
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
  const scroll = lerpKeys(SCROLL, t)[0];
  const ring = Math.max(0, (t - lastRing) / 0.45);
  const end = ease((t - 13.1) / 0.6);
  await page.evaluate(({ z, cx, cy, sx, sy, scroll, ring, end, t }) => {
    document.getElementById("root").style.transform = `translate(${-cx * z}px, ${-cy * z}px) scale(${z})`;
    if (t >= 9.1) window.__rkScroller.scrollTop = scroll;
    document.querySelector(".rk-cursor").style.transform = `translate(${sx - 6}px, ${sy - 3}px)`;
    const r = document.querySelector(".rk-ring");
    r.style.left = `${sx}px`; r.style.top = `${sy}px`;
    r.style.opacity = ring < 1 ? String(1 - ring) : "0"; r.style.transform = `scale(${0.3 + ring})`;
    document.querySelector(".rk-end").style.opacity = String(end);
  }, { z, cx, cy, sx, sy, scroll, ring, end, t });
  // the build plays as a time-lapse, so the house gets its walls and roof before the end card
  await page.clock.runFor((1000 / FPS) * (t >= 10 && t < 13.2 ? 3 : 1));
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
