// Mixes the build-stages film's sound onto the rendered picture:
//   node site/film-mix.mjs <film.mp4> <audio dir> <out.mp4>
// The audio dir holds the ElevenLabs files: vo.mp3 (the whole voiceover in one take), music.mp3 (60 s bed),
// whoosh.mp3, impact.mp3, nail.mp3 and blip.mp3. Each voiceover line is cut from the take and laid on the
// film's own beats (B in film.tsx), the music ducks under the voice, and the whole mix is levelled for phones.
import { execFileSync } from "node:child_process";
import path from "node:path";

const [film, dir, out] = process.argv.slice(2);
if (!out) { console.error("node site/film-mix.mjs <film.mp4> <audio dir> <out.mp4>"); process.exit(1); }

// [from, to] in the voiceover take (s), and where it lands in the film (s)
const LINES = [
  [0.0, 2.11, 1.0],    // Every job starts as a drawing.
  [2.77, 5.57, 3.5],   // Flat. Paper. Easy to misread.
  [6.73, 7.94, 7.7],   // Drop it into Rorker.
  [8.65, 12.78, 9.4],  // Every room. Every wall. Every door. Measured.
  [13.86, 15.09, 14.4], // Now watch it build.
  [16.25, 16.94, 18.1], // The slab.
  [18.01, 20.61, 23.2], // Framing. Studs at sixteen inches.
  [21.58, 22.21, 29.6], // Sheetrock.
  [23.30, 26.76, 34.1], // And the finished house. Roof, siding, trim.
  [27.84, 30.81, 39.6], // Step inside, and see exactly where the job is.
  [31.47, 34.75, 43.4], // Finished rooms turn green. Late work can't hide.
  [35.54, 39.84, 48.6], // Your crew, your client, and you. All looking at the same house.
  [40.73, 41.28, 54.6], // Rorker.
  [41.74, 43.76, 55.6], // See the job before it's built.
];
const range = (from, step, n) => Array.from({ length: n }, (_, i) => +(from + i * step).toFixed(3));
// sound effects: file, volume, times (s)
const SFX = [
  ["whoosh", 0.9, [6.9, 13.3, 21.9, 28.3, 33.3, 38.3, 47.3]],
  ["impact", 1.0, [7.6, 18.0, 29.5, 34.0, 54.5]],
  ["nail", 0.9, [23.0]],
  ["blip", 0.35, [...range(9.3, 0.32, 11), ...range(43.3, 0.38, 10)]],
];

const inputs = ["-i", film, "-i", path.join(dir, "vo.mp3"), "-i", path.join(dir, "music.mp3")];
const parts = [];
const voice = LINES.map(([a, b, at], i) => {
  parts.push(`[1:a]atrim=${Math.max(0, a - 0.06)}:${b + 0.18},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${(b + 0.18 - Math.max(0, a - 0.06) - 0.1).toFixed(3)}:d=0.1,adelay=${Math.round(at * 1000)}:all=1[v${i}]`);
  return `[v${i}]`;
});
parts.push(`${voice.join("")}amix=inputs=${voice.length}:normalize=0,apad=whole_dur=60,asplit=2[vo][key]`);
const fx = [];
SFX.forEach(([name, vol, times], s) => {
  inputs.push("-i", path.join(dir, `${name}.mp3`));
  const idx = 3 + s;
  parts.push(`[${idx}:a]asplit=${times.length}${times.map((_, j) => `[s${s}_${j}]`).join("")}`);
  times.forEach((at, j) => { parts.push(`[s${s}_${j}]volume=${vol},adelay=${Math.round(at * 1000)}:all=1[f${s}_${j}]`); fx.push(`[f${s}_${j}]`); });
});
parts.push(`${fx.join("")}amix=inputs=${fx.length}:normalize=0[fx]`);
// the music sits back and ducks while the narrator talks
parts.push(`[2:a]volume=0.55,afade=t=out:st=58.2:d=1.8[bed]`);
parts.push(`[bed][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`);
parts.push(`[vo]volume=1.6[voice]`);
parts.push(`[voice][duck][fx]amix=inputs=3:normalize=0,atrim=0:60,loudnorm=I=-14:TP=-1.5:LRA=11[mix]`);

execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[mix]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" });
console.log(out);
