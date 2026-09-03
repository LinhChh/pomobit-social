/**
 * Local proof-of-concept for the Ken Burns MVP Reel. Not a test, not run in CI —
 * it renders one full-length clip to output/ so you can actually watch the pan
 * and check the music mix before trusting renderReel() in the pipeline.
 *
 *   node scripts/reel-poc.js
 *   node scripts/reel-poc.js "Your own hook text here" 12
 *
 * On macOS `open output/reel-poc.mp4` afterwards.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReel, DEFAULT_DURATION_SEC, resolveFfmpeg } from "../src/reel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const text = process.argv[2] ?? "What's the ONE habit you've been trying to build for months?";
const durationSec = Number(process.argv[3]) || DEFAULT_DURATION_SEC;
const outPath = path.join(__dirname, "..", "output", "reel-poc.mp4");

console.log(`ffmpeg: ${resolveFfmpeg()}`);
console.log(`Rendering ${durationSec}s reel → ${outPath}`);
console.time("render");
await renderReel({ text, outPath, durationSec });
console.timeEnd("render");
console.log("Done. Watch it and sanity-check the pan + audio fades.");
