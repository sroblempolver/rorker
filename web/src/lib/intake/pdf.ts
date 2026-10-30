// PDF plans, read in the browser before they go to the New project assistant. A PDF sent as it is gets
// looked at as a whole page at a modest size, so a plan that fills a fifth of the sheet (a terrace of six
// townhouses, say) arrives as a smudge. Here each page is drawn with pdf.js, cut down to where the
// drawing actually is, and sent sharp: one overview of the drawing area plus close-up tiles when it is
// long and thin or big, each tile saying where it sits in the overview. Several plans on one sheet (a
// ground and a first floor) are found and cut out one by one. Text the PDF still has as text
// goes along as labels with their positions, since a picture can't be searched.
//
// A full drawing set (cover, floor plans, elevations, sections, schedules, notes; often 10 to 60 pages)
// is read whole: every page's title text says what it is, floor plans get the sharp treatment first,
// elevations and sections one picture each (for heights), and schedules and notes go as their text
// (door and window sizes, ceiling heights), which is exact and costs no pictures.
type PdfJs = typeof import("pdfjs-dist");
type Page = Awaited<ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>>;

export interface PdfImage { name: string; url: string; note: string; closeUp?: boolean }

const EDGE = 2400;     // long side of every picture sent (the model reads up to about 2576 px and 3.75 MP)
const AREA = 3.6e6;
const SCAN = 1600;     // long side of the quick render used to find the drawing on the page
const MAX_PAGES = 80, MAX_IMAGES = 20;
/** what the assistant reads a note at most (the function cuts each note there) */
const NOTE_MAX = 19000;

let lib: Promise<PdfJs> | null = null;
/** pdf.js, loaded only when a PDF is added. Its worker runs on the page (a PDF or two is quick enough). */
function pdfjs(): Promise<PdfJs> {
  lib ??= (async () => {
    const [m, w] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs")]);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = w;
    return m;
  })();
  return lib;
}

async function draw(page: Page, scale: number, box: [number, number, number, number]) {
  const [x0, y0, x1, y1] = box;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((x1 - x0) * scale));
  c.height = Math.max(1, Math.round((y1 - y0) * scale));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  const vp = page.getViewport({ scale, offsetX: -x0 * scale, offsetY: -y0 * scale });
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return c;
}

// whichever is smaller: a clean drawing packs best as PNG, a busy one as JPEG (still sharp at 0.85)
const picture = (c: HTMLCanvasElement) => {
  const png = c.toDataURL("image/png"), jpg = c.toDataURL("image/jpeg", 0.85);
  return png.length <= jpg.length ? png : jpg;
};

type Box = [number, number, number, number];

/** Runs of a histogram with real ink in them (more than a stray line's worth), as [from, to] index pairs. */
function runs(a: Uint32Array, min: number, gap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1, last = -1;
  a.forEach((n, i) => {
    if (n <= min) return;
    if (start >= 0 && i - last > gap) { out.push([start, last]); start = i; }
    if (start < 0) start = i;
    last = i;
  });
  if (start >= 0) out.push([start, last]);
  return out;
}

/**
 * The drawings on a page, in page units (points, y down): one box per plan when several are laid out on
 * one sheet (a ground and a first floor one above the other), each with a small margin. Small bits, such
 * as a title under a plan, join the drawing nearest them.
 */
async function drawings(page: Page): Promise<Box[]> {
  const vp = page.getViewport({ scale: 1 });
  const s = SCAN / Math.max(vp.width, vp.height);
  const c = await draw(page, s, [0, 0, vp.width, vp.height]);
  const { data, width: W, height: H } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) ink[i] = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < 225 ? 1 : 0;
  const hist = (x0: number, y0: number, x1: number, y1: number, alongX: boolean) => {
    const h = new Uint32Array(alongX ? x1 - x0 + 1 : y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ink[y * W + x]) h[alongX ? x - x0 : y - y0]++;
    return h;
  };
  const split = (x0: number, y0: number, x1: number, y1: number, alongX: boolean): Box[] => {
    const span = alongX ? x1 - x0 : y1 - y0, cross = alongX ? y1 - y0 : x1 - x0;
    // a stray line crossing the gap between two plans leaves only a few dots in a row; a plan leaves many
    const h = hist(x0, y0, x1, y1, alongX);
    const parts = runs(h, Math.max(3, cross * 0.004, Math.max(...h) * 0.04), Math.max(4, span * 0.012));
    const big = parts.filter(([a, b]) => b - a > span * 0.08);
    if (!big.length) return [[x0, y0, x1, y1]];
    const merged = big.map(([a, b]) => [a, b] as [number, number]);
    for (const [a, b] of parts.filter((p) => !big.includes(p))) {
      const near = merged.reduce((m, q) => (Math.min(Math.abs(q[0] - b), Math.abs(a - q[1])) < Math.min(Math.abs(m[0] - b), Math.abs(a - m[1])) ? q : m));
      near[0] = Math.min(near[0], a); near[1] = Math.max(near[1], b);
    }
    return merged.map(([a, b]) => (alongX ? [x0 + a, y0, x0 + b, y1] : [x0, y0 + a, x1, y0 + b]) as Box);
  };
  // trim each to its own ink, so a plan's box isn't stretched by stray lines elsewhere on the sheet
  const trim = ([x0, y0, x1, y1]: Box): Box => {
    const xs = runs(hist(x0, y0, x1, y1, true), Math.max(1, (y1 - y0) * 0.004), W), ys = runs(hist(x0, y0, x1, y1, false), Math.max(1, (x1 - x0) * 0.004), H);
    return xs.length && ys.length ? [x0 + xs[0][0], y0 + ys[0][0], x0 + xs[0][1], y0 + ys[0][1]] : [x0, y0, x1, y1];
  };
  const boxes = split(0, 0, W - 1, H - 1, false).flatMap((b) => split(b[0], b[1], b[2], b[3], true)).map(trim);
  return boxes.slice(0, 6).map(([x0, y0, x1, y1]) => {
    const pad = 0.015 * Math.max(x1 - x0, y1 - y0);
    return [Math.max(0, (x0 - pad) / s), Math.max(0, (y0 - pad) / s), Math.min(vp.width, (x1 + 1 + pad) / s), Math.min(vp.height, (y1 + 1 + pad) / s)];
  });
}

/** How to cut a drawing into close-ups: along a long thin one, 2 x 2 otherwise. */
function tiles(box: Box): Box[] {
  const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
  const aspect = Math.max(w, h) / Math.min(w, h);
  const across = aspect > 1.8 ? Math.min(4, Math.ceil(aspect / 1.1)) : 2;
  const down = aspect > 1.8 ? 1 : 2;
  const [nx, ny] = w >= h ? [across, down] : [down, across];
  const ox = (w / nx) * 0.08, oy = (h / ny) * 0.08; // a little overlap so nothing is cut on a seam
  const out: Box[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    out.push([Math.max(x0, x0 + (i * w) / nx - ox), Math.max(y0, y0 + (j * h) / ny - oy), Math.min(x1, x0 + ((i + 1) * w) / nx + ox), Math.min(y1, y0 + ((j + 1) * h) / ny + oy)]);
  return out;
}

export type SheetKind = "plan" | "elevation" | "section" | "site" | "roof" | "schedule" | "notes" | "cover" | "detail" | "unknown";
const KIND_WORDS: [SheetKind, RegExp][] = [
  ["schedule", /\b(DOOR|WINDOW|FINISH|ROOM|FIXTURE|LIGHTING)S?\s+SCHEDULE|SCHEDULE OF/],
  ["site", /\b(SITE|PLOT)\s+PLAN\b/],
  ["roof", /\bROOF\s+(FRAMING\s+)?PLAN\b/],
  ["plan", /\b(FLOOR|GROUND|FIRST|SECOND|THIRD|MAIN|UPPER|LOWER|BASEMENT|LOFT|ATTIC|DIMENSION|FURNITURE|LAYOUT|PROPOSED|EXISTING)\s+(FLOOR\s+)?PLAN|\bLEVEL\s+\d+\s+PLAN|\bFLOOR\s+LAYOUT|\bPLAN\s+VIEW/],
  ["elevation", /\bELEVATIONS?\b/],
  ["section", /\b(BUILDING|WALL|CROSS|LONGITUDINAL)?\s*SECTIONS?\b/],
  ["detail", /\bDETAILS?\b/],
  ["notes", /\b(GENERAL|STRUCTURAL|CONSTRUCTION)\s+NOTES|SPECIFICATIONS?\b|\bLEGEND\b/],
  ["cover", /\b(COVER\s+SHEET|SHEET\s+INDEX|DRAWING\s+(LIST|INDEX)|TITLE\s+SHEET)\b/],
];
const KIND_NAME: Record<SheetKind, string> = {
  plan: "floor plan", elevation: "elevations", section: "sections", site: "site plan", roof: "roof plan",
  schedule: "schedules", notes: "notes and specifications", cover: "cover / sheet index", detail: "details", unknown: "drawing",
};

/** What a sheet is, from the words on it: the kinds it mentions, most likely first (a floor plan wins ties). */
export function sheetKinds(text: string): SheetKind[] {
  const t = text.toUpperCase().replace(/\s+/g, " ");
  const hits = KIND_WORDS.map(([k, re]) => ({ k, n: (t.match(new RegExp(re.source, "g")) ?? []).length })).filter((h) => h.n > 0);
  const rank: SheetKind[] = ["plan", "elevation", "section", "schedule", "site", "roof", "notes", "detail", "cover"];
  hits.sort((a, b) => b.n - a.n || rank.indexOf(a.k) - rank.indexOf(b.k));
  const ks = hits.map((h) => h.k);
  // a cover's sheet index names every other kind of sheet: it's still the cover
  if (ks.includes("cover")) return ["cover", ...ks.filter((k) => k !== "cover")];
  // a floor plan sheet often also says "section" (section marks) or "details": still a floor plan
  if (ks.includes("plan")) return ["plan", ...ks.filter((k) => k !== "plan")];
  return ks.length ? ks : ["unknown"];
}

/** A page's text as lines, top to bottom, with the cells of a row (a schedule's columns) joined by " | ". */
function pageLines(items: { str: string; x: number; y: number; h: number }[]): string {
  const rows: { y: number; h: number; cells: { x: number; s: string }[] }[] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y)) {
    const r = rows.find((q) => Math.abs(q.y - it.y) < Math.max(2, Math.min(q.h, it.h) * 0.5));
    if (r) r.cells.push({ x: it.x, s: it.str }); else rows.push({ y: it.y, h: it.h, cells: [{ x: it.x, s: it.str }] });
  }
  return rows.map((r) => r.cells.sort((a, b) => a.x - b.x).map((c) => c.s).join(" | ")).join("\n");
}

/**
 * Reads a PDF: a whole drawing set or a single sheet. Floor plans come back as sharp pictures of just the
 * drawing (with close-ups when big), elevations and sections as one picture each, schedules and notes as
 * their text in the notes. `budget` is how many pictures this file may use.
 */
export async function readPdf(buf: ArrayBuffer, name: string, budget = MAX_IMAGES): Promise<PdfImage[]> {
  const { getDocument } = await pdfjs();
  const doc = await getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const total = doc.numPages, pages = Math.min(total, MAX_PAGES);
  const max = Math.min(budget, MAX_IMAGES);
  // 1. what every page is, from its words (quick: no drawing yet)
  const sheets: { n: number; kinds: SheetKind[]; lines: string; words: number }[] = [];
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const items = (await page.getTextContent()).items.flatMap((it) => {
      if (!("str" in it) || !it.str.trim()) return [];
      const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
      return [{ str: it.str.trim(), x, y, h: Math.abs(it.transform[3]) || 8 }];
    });
    const lines = pageLines(items);
    sheets.push({ n, kinds: sheetKinds(lines), lines, words: items.length });
    page.cleanup();
  }
  // 2. which pages get pictures: floor plans first (sharp, with close-ups), then one each for elevations,
  // sections and the site; a page with no words (drawn as lines, or a scan) could be anything, so it's
  // looked at like a plan
  const pictured = (k: SheetKind) => k === "plan" || k === "unknown";
  const onePic = (k: SheetKind) => k === "elevation" || k === "section" || k === "site" || k === "roof";
  const planPages = sheets.filter((p) => pictured(p.kinds[0]));
  const extra = sheets.filter((p) => onePic(p.kinds[0]));
  // keep room for the elevations (heights) and a section; plans get the rest
  const reserve = Math.min(extra.length, planPages.length ? Math.max(1, Math.min(4, max - planPages.length * 2)) : max);
  let left = max - reserve;
  const out: PdfImage[] = [];
  const used = new Map<number, string>();
  const shoot = async (n: number, closeUps: boolean, cap: number) => {
    const page = await doc.getPage(n);
    const full = page.getViewport({ scale: 1 });
    const text = await page.getTextContent();
    const kind = KIND_NAME[sheets[n - 1].kinds[0]];
    const where = total > 1 ? `page ${n} of ${total} of ${name} (${kind})` : name;
    // a one-picture sheet (elevations, a section) is sent whole: all its drawings in one picture
    const found = await drawings(page);
    const boxes: [number, number, number, number][] = closeUps ? found.slice(0, 6) : found.length ? [[
      Math.min(...found.map((b) => b[0])), Math.min(...found.map((b) => b[1])), Math.max(...found.map((b) => b[2])), Math.max(...found.map((b) => b[3])),
    ]] : [];
    const start = out.length;
    for (const [k, box] of boxes.entries()) {
      if (out.length - start >= cap) break;
      const [x0, y0, x1, y1] = box;
      const edge = closeUps ? EDGE : 2000;
      const s = edge / Math.max(x1 - x0, y1 - y0);
      const view = await draw(page, s, box);
      const px = (x: number, y: number) => [Math.round((x - x0) * s), Math.round((y - y0) * s)];
      // text the PDF still has as text, placed in this drawing's pixels
      const labels = text.items.flatMap((it) => {
        if (!("str" in it) || !it.str.trim()) return [];
        const [x, y] = full.convertToViewportPoint(it.transform[4], it.transform[5]);
        if (x < x0 || x > x1 || y < y0 || y > y1) return [];
        const [a, b] = px(x, y);
        return [`"${it.str.trim().slice(0, 60)}" at (${a}, ${b})`];
      }).slice(0, 300);
      const share = Math.round((100 * (x1 - x0) * (y1 - y0)) / (full.width * full.height));
      // the room left is shared between this drawing and the ones after it on the sheet
      const room = Math.floor((cap - (out.length - start)) / (boxes.length - k));
      const cuts = closeUps ? tiles(box).slice(0, Math.max(0, room - 1)) : [];
      const id = boxes.length > 1 ? `drawing ${k + 1} of the ${boxes.length} on ${where}` : `the drawing on ${where}`;
      const frame = boxes.length > 1 ? `D${n}.${k + 1}` : `D${n}`;
      out.push({
        name: `${name} p${n}${boxes.length > 1 ? ` d${k + 1}` : ""}`, url: picture(view),
        note: `Overview of ${id} (frame ${frame}): cut out of the sheet (it covers about ${share}% of the sheet) and drawn sharp, ${view.width} x ${view.height} px. `
          + `Its pixels are frame ${frame}: x right, y down, top-left is (0, 0).${cuts.length ? ` ${cuts.length} close-ups of it follow; read the details (walls, doors, fixtures, small text) from them.` : ""} `
          + (labels.length ? `Text in the PDF, with where it sits in ${frame} pixels: ${labels.join("; ")}.` : "The PDF has no text here (its words are drawn as lines), so read the words off the pictures."),
      });
      for (const [i, t] of cuts.entries()) {
        const ts = Math.min(EDGE / Math.max(t[2] - t[0], t[3] - t[1]), Math.sqrt(AREA / ((t[2] - t[0]) * (t[3] - t[1])))), z = ts / s;
        const [a, b] = px(t[0], t[1]), [c, d] = px(t[2], t[3]);
        out.push({
          name: `${name} p${n}${boxes.length > 1 ? ` d${k + 1}` : ""} close-up ${i + 1}`, url: picture(await draw(page, ts, t)),
          closeUp: true,
          note: `Close-up ${i + 1} of ${cuts.length} of frame ${frame}: covers ${frame} pixels x ${a} to ${c}, y ${b} to ${d}, drawn ${z.toFixed(2)}x bigger. Close-up pixel (tx, ty) is ${frame} pixel (${a} + tx / ${z.toFixed(3)}, ${b} + ty / ${z.toFixed(3)}).`,
        });
      }
    }
    page.cleanup();
    const got = out.length - start;
    if (got) used.set(n, got === 1 ? `picture ${start + 1}` : `pictures ${start + 1} to ${out.length}`);
  };
  // the plans: each one an overview and close-ups while there's room, the rest an overview only
  for (const [i, p] of planPages.entries()) {
    if (left <= 0) break;
    const later = planPages.length - i - 1;
    // one plan sheet (often two floors on it) may use most of the room; in a set, five each
    const cap = Math.max(1, Math.min(planPages.length === 1 ? 12 : 5, left - later));
    const before = out.length;
    await shoot(p.n, cap > 1, cap);
    left -= out.length - before;
  }
  // the one-picture pages get the reserve and whatever the plans didn't use
  left = max - out.length;
  for (const p of extra) {
    if (left <= 0) break;
    const before = out.length;
    await shoot(p.n, false, 1);
    left -= out.length - before;
  }
  await doc.destroy();
  if (!out.length) return out;
  // 3. the set's index, and the words of the pages that aren't pictures (schedules, notes, cover)
  if (total > 1) {
    const index = sheets.map((p) => `p${p.n} ${KIND_NAME[p.kinds[0]]}${p.kinds.length > 1 ? ` (also ${p.kinds.slice(1, 3).map((k) => KIND_NAME[k]).join(", ")})` : ""}: ${used.get(p.n) ?? (p.words ? "its text is below" : "not sent (no text, and the pictures went to the plans)")}`);
    const more = total > pages ? ` Only the first ${pages} of ${total} pages were read.` : "";
    const head = `${name} is a drawing set of ${total} pages.${more} What each page is (from its title text) and where it went: ${index.join("; ")}. `
      + "Build the rooms from the floor plans. Take heights (ceilings, floor to floor, window sills and heads) from the elevations and sections, "
      + "and door and window sizes from the schedules, when they're there; they beat the usual sizes.";
    out[0].note = `${head}\n\n${out[0].note}`;
    const texts = sheets.filter((p) => !used.has(p.n) && p.words).map((p) => `Text of page ${p.n} (${KIND_NAME[p.kinds[0]]}):\n${p.lines.slice(0, 8000)}`);
    // spread over the overviews' notes (close-ups can be dropped when the upload is too big); each note
    // is read up to NOTE_MAX characters
    const hosts = out.filter((o) => !o.closeUp);
    let i = 0;
    for (const t of texts) {
      while (i < hosts.length && hosts[i].note.length + t.length + 2 > NOTE_MAX) i++;
      if (i >= hosts.length) break;
      hosts[i].note += `\n\n${t}`;
    }
  }
  return out;
}
