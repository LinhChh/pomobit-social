/**
 * Local proof-of-concept for the Ken Burns Reel. Not a test, not run in CI —
 * it renders one full-length clip to output/ so you can actually watch the pan
 * and check the music mix before trusting renderReel() in the pipeline.
 *
 *   node scripts/reel-poc.js
 *   node scripts/reel-poc.js "Your own hook text here" 12
 *   node scripts/reel-poc.js --calendar content/calendar-reels.json --date 2026-09-28
 *
 * The --calendar form renders a real entry as-is (single text or multi-beat
 * `script`, whichever the entry has) via the same renderPostImage() the
 * pipeline uses, ignoring `status` — it's a render smoke test, not a publish
 * check. On macOS, `open output/<file>` afterwards.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { renderReel, DEFAULT_DURATION_SEC, resolveFfmpeg } from "../src/reel.js";
import { renderPostImage } from "../src/renderImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    calendar: { type: "string" },
    date: { type: "string" },
  },
});

console.log(`ffmpeg: ${resolveFfmpeg()}`);
console.time("render");

if (values.calendar) {
  const calendar = JSON.parse(await readFile(values.calendar, "utf-8"));
  const post = values.date ? calendar.find((entry) => entry.date === values.date) : calendar[0];
  if (!post) {
    throw new Error(`No entry found in ${values.calendar}${values.date ? ` for date ${values.date}` : ""}`);
  }
  console.log(
    `Rendering ${values.calendar} entry for ${post.date}` +
      (post.script ? ` (${post.script.length}-beat script)` : " (single card)"),
  );
  const outPath = await renderPostImage(post);
  console.timeEnd("render");
  console.log(`Done → ${outPath}. Watch it and sanity-check the pan + audio fades.`);
} else {
  const text = positionals[0] ?? "What's the ONE habit you've been trying to build for months?";
  const durationSec = Number(positionals[1]) || DEFAULT_DURATION_SEC;
  const outPath = path.join(__dirname, "..", "output", "reel-poc.mp4");

  console.log(`Rendering ${durationSec}s reel → ${outPath}`);
  await renderReel({ text, outPath, durationSec });
  console.timeEnd("render");
  console.log("Done. Watch it and sanity-check the pan + audio fades.");
}
