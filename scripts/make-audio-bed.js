/**
 * Regenerates assets/audio/bed.mp3 — the synthesized CC0 placeholder music bed
 * used by Reels until a real royalty-free track is dropped in. Not part of the
 * test suite or CI; run by hand:
 *
 *   node scripts/make-audio-bed.js
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFfmpeg } from "../src/reel.js";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "assets", "audio", "bed.mp3");
const SECONDS = 16;

// A slow four-note pad (A1 / E2 / A2 / C#3) with tremolo, a low-pass, and a
// short echo — calm, unobtrusive, loops without an obvious seam.
const notes = [110, 164.81, 220, 277.18];
const inputs = notes.flatMap((f) => ["-f", "lavfi", "-i", `sine=frequency=${f}:duration=${SECONDS}`]);
const mix = `${notes.map((_, i) => `[${i}]`).join("")}amix=inputs=${notes.length}:normalize=0,` +
  "volume=0.22,tremolo=f=0.15:d=0.35,lowpass=f=900," +
  "aformat=channel_layouts=stereo,aecho=0.8:0.7:60:0.35";

await execFileP(resolveFfmpeg(), [
  "-hide_banner",
  "-y",
  ...inputs,
  "-filter_complex",
  mix,
  "-t",
  String(SECONDS),
  "-c:a",
  "libmp3lame",
  "-b:a",
  "128k",
  "-ar",
  "44100",
  OUT,
]);

console.log(`Wrote ${OUT}`);
