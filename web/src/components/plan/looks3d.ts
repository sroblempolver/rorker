// Small pictures drawn once and shared by the 3D models: a sky the glass and metal reflect, wood grain,
// a fabric weave, a stone counter. Each is a canvas made on first use, so nothing is downloaded.
import * as THREE from "three";

const made = new Map<string, THREE.Texture>();
function once(name: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, setup?: (t: THREE.Texture) => void) {
  let t = made.get(name);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d")!, w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    setup?.(t);
    t.userData.shared = true;
    made.set(name, t);
  }
  return t;
}
const seeded = (n: number) => { let s = n; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

/** A soft sky over a far tree line and the ground: what windows, steel and gloss reflect. */
export const skyEnv = () => once("sky", 512, 256, (g, W, H) => {
  const sky = g.createLinearGradient(0, 0, 0, H / 2);
  sky.addColorStop(0, "#6f9cc8"); sky.addColorStop(0.75, "#c6d9e8"); sky.addColorStop(1, "#eef2f2");
  g.fillStyle = sky; g.fillRect(0, 0, W, H / 2);
  const r = seeded(7);
  g.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < 14; i++) { const x = r() * W, y = H * (0.12 + r() * 0.25); g.beginPath(); g.ellipse(x, y, 20 + r() * 50, 5 + r() * 9, 0, 0, Math.PI * 2); g.fill(); }
  // the tree line and the houses across the street along the horizon
  g.fillStyle = "#7d8a78";
  for (let x = 0; x < W; x += 4) { const h = 4 + Math.abs(Math.sin(x * 0.05) * 7) + r() * 4; g.fillRect(x, H / 2 - h, 4, h); }
  const ground = g.createLinearGradient(0, H / 2, 0, H);
  ground.addColorStop(0, "#b9bdb6"); ground.addColorStop(0.3, "#8e938a"); ground.addColorStop(1, "#5d6058");
  g.fillStyle = ground; g.fillRect(0, H / 2, W, H / 2);
}, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping; });

/** Wood grain running up the texture (white, multiplied by the wood's own colour). */
export const woodGrain = () => once("grain", 128, 256, (g, W, H) => {
  g.fillStyle = "#e9e3da"; g.fillRect(0, 0, W, H);
  const r = seeded(11);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, wob = 2 + r() * 5, a = 0.05 + r() * 0.12;
    g.strokeStyle = `rgba(70,45,25,${a})`; g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    for (let y = 0; y <= H; y += 8) g.lineTo(x + Math.sin(y * 0.02 + i) * wob, y);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 6; i++) g.fillRect(r() * W, 0, 4 + r() * 10, H);
});

/** A close weave for upholstery, rugs and bedding. */
export const weave = () => once("weave", 64, 64, (g, W, H) => {
  g.fillStyle = "#e6e6e6"; g.fillRect(0, 0, W, H);
  const r = seeded(3);
  for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; g.fillRect(0, y, W, 1); }
  for (let x = 0; x < W; x += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; g.fillRect(x, 0, 1, H); }
}, (t) => t.repeat.set(4, 4));

/** Speckled stone for counters and hearths. */
export const stone = () => once("stoneTop", 128, 128, (g, W, H) => {
  g.fillStyle = "#dcdcdc"; g.fillRect(0, 0, W, H);
  const r = seeded(5);
  for (let i = 0; i < 900; i++) { const v = Math.floor(r() * 255); g.fillStyle = `rgba(${v},${v},${v},${0.15 + r() * 0.25})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
}, (t) => t.repeat.set(2, 2));
