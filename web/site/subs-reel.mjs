// Records the 15-second subs-and-links reel from the real app, frame by frame:
//   node site/subs-reel.mjs <app url> <photo.jpg> <out.mp4> [peek times in s, comma separated]
// On the sample data: add a sub on the Team page, tag them on a task, copy their link, open what they see,
// send a photo and mark it done, then back on your side the task is done with their photo in it.
// Between scenes the page is set up off camera (a cut). The camera is a CSS transform on the app's root, the page
// clock is held still and stepped one frame at a time, and the cursor finds each button on the page as it goes.
// With peek times it only saves those frames as PNGs next to out, to check the script quickly.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const [url, photo, outArg, peekArg] = process.argv.slice(2);
if (!outArg) { console.error("node site/subs-reel.mjs <app url> <photo.jpg> <out.mp4> [peek times]"); process.exit(1); }
const out = path.resolve(outArg);
const peek = peekArg ? peekArg.split(",").map(Number) : null;
const FPS = 30, LENGTH = 15, W = 810, H = 1440;
const symbol = fs.readFileSync(path.join(here, "../public/brand/symbol-orange.svg"), "utf8");
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 4 / 3 });
page.setDefaultTimeout(60000);

// --- what's on screen -------------------------------------------------------------------------------
const sub = () => page.locator("button").filter({ hasText: /^sub$/i }).last();
const luisLink = () => page.locator(`button[title^="Luis Ortega's link"]`);
const T = {
  name: () => page.locator('input[placeholder="Full name"]').last(),
  trade: () => page.locator('input[placeholder^="Title or trade (Site"]'),
  sub,
  add: () => page.getByRole("button", { name: "Add to team" }),
  change: () => page.getByRole("button", { name: "Change", exact: true }),
  luisChip: () => page.locator("button").filter({ hasText: "Luis Ortega" }).first(),
  tagDone: () => page.locator("button").filter({ hasText: /^Done$/ }).nth(1),
  copy: luisLink,
  seeIt: () => page.locator(`button[title^="Luis Ortega's link"] + button`),
  addPhoto: () => page.getByRole("button", { name: "Add a photo", exact: true }),
  markDone: () => page.getByRole("button", { name: "Mark done", exact: true }),
};
// let the page settle off camera: time moves on, nothing is recorded
const settle = async (ms) => { for (let k = 0; k < ms / 100; k++) { await page.clock.runFor(100); await page.waitForTimeout(60); } };
const scroller = (sel) => page.evaluate((sel) => {
  let e = document.querySelector(sel);
  while (e && !(/(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight)) e = e.parentElement;
  return e ? (window.__rkScroll = e, true) : false;
}, sel);

// --- the script -------------------------------------------------------------------------------------
// camera: [time, zoom, centre x, centre y] in page px; the window is kept on the page
const CAM = [
  [0, 1, 405, 720], [0.5, 1.5, 300, 1180], [1.5, 1.5, 300, 1180], [1.9, 1.5, 510, 1200], [2.75, 1.5, 510, 1200],
  [2.76, 1, 405, 720], [4.55, 1.06, 405, 900],
  [4.56, 1, 405, 720], [6.0, 1, 405, 720], [8.4, 1.15, 405, 1100], [10.35, 1.15, 405, 1100],
  [10.36, 1, 405, 720], [13, 1.08, 405, 1000],
];
const EVENTS = [
  // the Team page: a new sub in a few seconds
  [0.15, "move", T.name, 0.45], [0.62, "click"], [0.7, "type", "Luis Ortega", 0.6],
  [1.35, "move", T.trade, 0.3], [1.7, "click"], [1.76, "type", "Plumbing", 0.35],
  [2.1, "move", T.sub, 0.22], [2.34, "click"], [2.38, "move", T.add, 0.2], [2.6, "click"],
  // cut: the toilet upstairs on the job, and tag them on it
  [2.76, "cut", async () => {
    await page.evaluate(() => { location.hash = "#/job/hadley"; }); await settle(3000);
    await page.getByText("Set the upstairs toilet").first().click(); await settle(1500);
  }],
  [2.8, "move", T.change, 0.3], [3.12, "click"], [3.16, "move", T.luisChip, 0.25], [3.43, "click"],
  [3.47, "move", T.tagDone, 0.22], [3.71, "click"], [3.75, "move", T.copy, 0.3], [4.07, "click"],
  [4.15, "move", T.seeIt, 0.25], [4.42, "click"],
  // cut: what the sub sees on their link
  [4.56, "cut", async () => { await settle(3500); }],
  // their bathroom in 3D, tipped down to a side view so they see exactly where it is
  [5.4, "move", [430, 560], 0.6], [6.1, "down"], [6.12, "move", [480, 430], 1.4], [7.6, "up"],
  [8.3, "move", T.addPhoto, 0.6], [9.0, "click"], [9.08, "photo"], [9.4, "move", T.markDone, 0.35], [9.85, "click"],
  // cut: back on your side, the task is done with their photo in it
  [10.36, "cut", async () => {
    await page.getByText("Back to the app").first().click(); await settle(3000);
    await page.locator("button").filter({ hasText: /^Pins/i }).first().click(); await settle(600);
    await page.locator("button").filter({ hasText: /^All$/ }).first().click(); await settle(600);
    await page.getByText("Set the upstairs toilet").first().click(); await settle(1500);
  }],
];
const END = 12.9;

// --- setup -------------------------------------------------------------------------------------------
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
await page.getByText("Or look around on sample data first").click(); await page.waitForTimeout(5000);
await page.getByText("Team", { exact: true }).first().click(); await page.waitForTimeout(2500);
// the add form near the bottom, the team above it
await scroller('input[placeholder="Full name"]');
await page.evaluate(() => { const s = window.__rkScroll, f = document.querySelector('input[placeholder="Full name"]'); s.scrollTop += f.getBoundingClientRect().top - 1160; });
await page.evaluate(({ symbol }) => {
  const css = document.createElement("style");
  css.textContent = `
    #root { transform-origin: 0 0; will-change: transform; }
    .rk-cursor { position: fixed; left: 0; top: 0; z-index: 99999; pointer-events: none; width: 34px; height: 34px; filter: drop-shadow(0 3px 6px rgba(0,0,0,.55)); }
    .rk-ring { position: fixed; z-index: 99998; pointer-events: none; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; border: 3px solid #ff6a1f; opacity: 0; }
    .rk-flash { position: fixed; inset: 0; z-index: 99996; background: #121315; opacity: 0; pointer-events: none; }
    .rk-end { position: fixed; inset: 0; z-index: 99997; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(18,19,21,.92); color: #f0ece3; opacity: 0; pointer-events: none; }
    .rk-end .mark { width: 170px; line-height: 0; margin-bottom: 44px; } .rk-end .mark svg { width: 100%; height: auto; }
    .rk-end h2 { font: 900 124px/.88 "Big Shoulders Stencil", "Big Shoulders", sans-serif; text-transform: uppercase; margin: 0 0 50px; }
    .rk-end .url { font: 800 44px/1 "Big Shoulders", sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #ff6a1f; border: 3px solid #ff6a1f; padding: 16px 32px; border-radius: 4px; }`;
  document.head.append(css);
  document.body.insertAdjacentHTML("beforeend", `<div class="rk-ring"></div><div class="rk-flash"></div>
    <svg class="rk-cursor" viewBox="0 0 24 24"><path d="M4 2l15 11.2-6.6.9 3.9 7.4-3 1.5-3.8-7.5L4 20z" fill="#fff" stroke="#121315" stroke-width="1.4" stroke-linejoin="round"/></svg>
    <div class="rk-end"><span class="mark">${symbol}</span><h2>Add a sub.<br>Send a link.</h2><div class="url">rorker.com</div></div>`);
}, { symbol });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1000);

// --- recording ---------------------------------------------------------------------------------------
const camAt = (t) => {
  let k = CAM.findIndex((c) => c[0] > t);
  const [z, x, y] = k < 0 ? CAM.at(-1).slice(1) : k === 0 ? CAM[0].slice(1) : (() => {
    const [t0, ...a] = CAM[k - 1], [t1, ...b] = CAM[k], e = ease((t - t0) / (t1 - t0));
    return a.map((v, j) => v + (b[j] - v) * e);
  })();
  const vw = W / z, vh = H / z;
  return [z, Math.min(W - vw, Math.max(0, x - vw / 2)), Math.min(H - vh, Math.max(0, y - vh / 2))];
};
let cur = [W + 60, H - 200], seg = null, typing = null, lastRing = -9, lastCut = -9;
const done = new Set();
const frames = fs.mkdtempSync(path.join(os.tmpdir(), "subs-reel-"));
const total = LENGTH * FPS;
for (let i = 0; i < total; i++) {
  const t = i / FPS;
  let [z, cx, cy] = camAt(t);
  for (const ev of EVENTS) {
    const [at, what] = ev;
    if (done.has(ev) || t < at) continue;
    done.add(ev);
    if (what === "move") {
      if (Array.isArray(ev[2])) { seg = { t0: at, t1: at + ev[3], from: cur, to: ev[2] }; continue; }
      const box = await ev[2]().boundingBox({ timeout: 8000 }).catch(async (x) => { await page.screenshot({ path: out.replace(/\.mp4$/, "-missing.png") }); throw x; });
      // the box is on screen; the cursor lives in page px
      const to = [cx + (box.x + box.width / 2) / z, cy + (box.y + box.height / 2) / z];
      seg = { t0: at, t1: at + ev[3], from: cur, to };
    } else if (what === "click") { await page.mouse.click((cur[0] - cx) * z, (cur[1] - cy) * z); lastRing = at; }
    else if (what === "type") typing = { t0: at, text: ev[2], dur: ev[3], n: 0 };
    else if (what === "photo") await page.locator('input[aria-label="Photo"]').setInputFiles(photo);
    else if (what === "down") await page.mouse.down();
    else if (what === "up") await page.mouse.up();
    else if (what === "cut") {
      // off camera the page is seen whole, so every button can be reached
      await page.evaluate(() => { document.getElementById("root").style.transform = ""; });
      await ev[2]();
      lastCut = at;
      [z, cx, cy] = camAt(t);
      cur = [W + 60, H - 200]; seg = null;
    }
  }
  if (seg) { const k = ease((t - seg.t0) / (seg.t1 - seg.t0)); cur = seg.from.map((v, j) => v + (seg.to[j] - v) * k); }
  if (typing) {
    const want = Math.min(typing.text.length, Math.ceil(((t - typing.t0) / typing.dur) * typing.text.length));
    if (want > typing.n) { await page.keyboard.type(typing.text.slice(typing.n, want)); typing.n = want; }
    if (typing.n >= typing.text.length) typing = null;
  }
  const sx = (cur[0] - cx) * z, sy = (cur[1] - cy) * z;
  await page.mouse.move(sx, sy);
  const ring = Math.max(0, (t - lastRing) / 0.45);
  const end = ease((t - END) / 0.6);
  const flash = Math.max(0, 1 - (t - lastCut) / 0.25) * 0.85;
  await page.evaluate(({ z, cx, cy, sx, sy, ring, end, flash }) => {
    document.getElementById("root").style.transform = `translate(${-cx * z}px, ${-cy * z}px) scale(${z})`;
    document.querySelector(".rk-cursor").style.transform = `translate(${sx - 6}px, ${sy - 3}px)`;
    const r = document.querySelector(".rk-ring");
    r.style.left = `${sx}px`; r.style.top = `${sy}px`;
    r.style.opacity = ring < 1 ? String(1 - ring) : "0"; r.style.transform = `scale(${0.3 + ring})`;
    document.querySelector(".rk-flash").style.opacity = String(flash);
    document.querySelector(".rk-end").style.opacity = String(end);
  }, { z, cx, cy, sx, sy, ring, end, flash });
  await page.clock.runFor(1000 / FPS);
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
