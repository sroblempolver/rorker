// Mixes a short reel's sound onto its rendered picture:
//   node site/reel-mix.mjs <picture.mp4> <audio dir> <mix.json> <out.mp4>
// mix.json says where everything lands (all times in seconds):
//   { "length": 15, "music": "music.mp3",
//     "lines": [["vo.mp3", from, to, at], ...],   // a line cut from a voiceover take, laid on the picture at `at`
//     "sfx": [["whoosh.mp3", volume, [times]], ...] }
// The music ducks under the voice, and the whole mix is levelled for phones.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [picture, dir, specFile, out] = process.argv.slice(2);
if (!out) { console.error("node site/reel-mix.mjs <picture.mp4> <audio dir> <mix.json> <out.mp4>"); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
const L = spec.length;

const inputs = ["-i", picture, "-i", path.join(dir, spec.music)];
const parts = [];
const add = (file) => { inputs.push("-i", path.join(dir, file)); return inputs.filter((x) => x === "-i").length - 1; };
const voice = spec.lines.map(([file, a, b, at], i) => {
  const s = Math.max(0, a - 0.06), e = b + 0.18;
  parts.push(`[${add(file)}:a]atrim=${s}:${e},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${(e - s - 0.1).toFixed(3)}:d=0.1,adelay=${Math.round(at * 1000)}:all=1[v${i}]`);
  return `[v${i}]`;
});
parts.push(`${voice.join("")}amix=inputs=${voice.length}:normalize=0,apad=whole_dur=${L},asplit=2[vo][key]`);
const fx = [];
spec.sfx.forEach(([file, vol, times], s) => {
  const idx = add(file);
  parts.push(`[${idx}:a]asplit=${times.length}${times.map((_, j) => `[s${s}_${j}]`).join("")}`);
  times.forEach((at, j) => { parts.push(`[s${s}_${j}]volume=${vol},adelay=${Math.round(at * 1000)}:all=1[f${s}_${j}]`); fx.push(`[f${s}_${j}]`); });
});
parts.push(`${fx.join("")}amix=inputs=${fx.length}:normalize=0,apad=whole_dur=${L}[fx]`);
parts.push(`[1:a]volume=0.55,apad=whole_dur=${L},afade=t=out:st=${L - 1.4}:d=1.4[bed]`);
parts.push(`[bed][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`);
parts.push(`[vo]volume=1.6[voice]`);
parts.push(`[voice][duck][fx]amix=inputs=3:normalize=0,atrim=0:${L},loudnorm=I=-14:TP=-1.5:LRA=11[mix]`);

execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[mix]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", String(L), "-movflags", "+faststart", out], { stdio: "inherit" });
console.log(out);
