// Gets uploads ready for the New project assistant, in the browser: photos and scans are shrunk to a
// sensible size, PDFs are drawn as sharp pictures of just the drawing (see pdf.ts), DXF drawings are drawn as a picture with a known scale (so the
// assistant can measure in millimetres) plus their text labels. DWG can't be read here yet.
import { readDxf } from "./dxf";
import { readPdf } from "./pdf";

export type IntakePart =
  | { kind: "image"; name: string; media_type: "image/jpeg" | "image/png"; data: string; note?: string }
  | { kind: "pdf"; name: string; data: string };

export interface Prepared { parts: IntakePart[]; notes: string[]; previews: { name: string; url: string }[]; source: { kind: string; filename: string } }

const MAX_PX = 1600, DXF_PX = 2000, MAX_PDF = 9 * 1024 * 1024, MAX_TOTAL = 12 * 1024 * 1024;

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromDataUrl = (u: string) => u.slice(u.indexOf(",") + 1);

async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_PX / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

function drawDxf(text: string) {
  const d = readDxf(text);
  const [x0, y0, x1, y1] = d.bounds;
  const s = Math.max(x1 - x0, y1 - y0) / DXF_PX; // mm per pixel
  const c = document.createElement("canvas");
  c.width = Math.ceil((x1 - x0) / s);
  c.height = Math.ceil((y1 - y0) / s);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#000";
  g.lineWidth = 1;
  g.beginPath();
  for (const l of d.lines) l.forEach(([x, y], i) => (i ? g.lineTo((x - x0) / s, (y - y0) / s) : g.moveTo((x - x0) / s, (y - y0) / s)));
  g.stroke();
  g.fillStyle = "#c00";
  for (const t of d.texts) {
    g.font = `${Math.max(9, Math.min(28, t.height / s))}px sans-serif`;
    g.fillText(t.text, (t.at[0] - x0) / s, (t.at[1] - y0) / s);
  }
  const labels = d.texts.slice(0, 300).map((t) => `"${t.text}" at (${Math.round(t.at[0] - x0)}, ${Math.round(t.at[1] - y0)})`).join("; ");
  const note = `This picture is an AutoCAD drawing drawn to scale: 1 pixel = ${s.toFixed(1)} mm, so pixel (px, py) is (px*${s.toFixed(1)}, py*${s.toFixed(1)}) mm in the drawing's own frame (x right, y down, top-left is 0,0). The whole picture is ${Math.round(x1 - x0)} x ${Math.round(y1 - y0)} mm. Give every coordinate in mm in that frame. Text labels in the drawing (red in the picture), with where they sit in mm: ${labels || "none"}.`;
  return { url: c.toDataURL("image/png"), note };
}

export async function prepareFiles(files: File[]): Promise<Prepared> {
  const parts: IntakePart[] = [];
  const notes: string[] = [];
  const previews: Prepared["previews"] = [];
  let total = 0;
  let source = { kind: "notes", filename: "" };
  for (const f of files.slice(0, 8)) {
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    try {
      if (ext === "dwg") { notes.push(`${f.name}: DWG files can't be opened in the preview yet. Save it as DXF or PDF from AutoCAD and add that instead.`); continue; }
      let part: IntakePart;
      if (ext === "dxf") {
        const { url, note } = drawDxf(await f.text());
        part = { kind: "image", name: f.name, media_type: "image/png", data: fromDataUrl(url), note };
        previews.push({ name: f.name, url });
      } else if (ext === "pdf" || f.type === "application/pdf") {
        if (f.size > MAX_PDF) { notes.push(`${f.name} is too big for the preview (over 9 MB). Try a smaller export or photos of the pages.`); continue; }
        const buf = await f.arrayBuffer();
        // drawn here when pdf.js can; sent as it is when it can't (the assistant then sees whole pages)
        const pics = await readPdf(buf.slice(0), f.name).catch((e) => { console.warn("pdf", e); return []; });
        if (pics.length) {
          const add = pics.map((p): IntakePart => ({ kind: "image", name: p.name, media_type: p.url.startsWith("data:image/png") ? "image/png" : "image/jpeg", data: fromDataUrl(p.url), note: p.note }));
          const size = add.reduce((n, p) => n + p.data.length, 0);
          if (total + size <= MAX_TOTAL) {
            total += size;
            parts.push(...add);
            previews.push({ name: f.name, url: pics[0].url });
            if (!source.filename) source = { kind: "pdf", filename: f.name };
            continue;
          }
        }
        part = { kind: "pdf", name: f.name, data: b64(buf) };
      } else if (f.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) {
        const url = await shrink(f);
        part = { kind: "image", name: f.name, media_type: "image/jpeg", data: fromDataUrl(url) };
        previews.push({ name: f.name, url });
      } else { notes.push(`${f.name}: I can read AutoCAD (DXF), PDF and photos.`); continue; }
      total += part.data.length;
      if (total > MAX_TOTAL) { notes.push(`${f.name} was left out: that's more than the preview can send at once.`); break; }
      parts.push(part);
      if (!source.filename) source = { kind: ext === "dxf" ? "dxf" : part.kind, filename: f.name };
    } catch (e) {
      notes.push(`${f.name}: ${e instanceof Error ? e.message : "couldn't be read."}`);
    }
  }
  return { parts, notes, previews, source };
}
