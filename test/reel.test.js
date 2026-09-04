import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReelFfmpegArgs,
  buildReelScriptFfmpegArgs,
  renderVerticalCard,
  renderReel,
  resolveFfprobe,
  REEL_WIDTH,
  REEL_HEIGHT,
} from "../src/reel.js";

const execFileP = promisify(execFile);
const AUDIO_BED = fileURLToPath(new URL("../assets/audio/bed.mp3", import.meta.url));

async function tempOut(name) {
  const dir = await mkdtemp(join(tmpdir(), "pomobit-reel-"));
  return join(dir, name);
}

/** Reads width/height out of a PNG's IHDR chunk. */
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function ffprobe(filePath) {
  const { stdout } = await execFileP(resolveFfprobe(), [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    filePath,
  ]);
  return JSON.parse(stdout);
}

test("buildReelFfmpegArgs defaults to a 10s clip (inside the 8-12s window)", () => {
  const args = buildReelFfmpegArgs({
    cardPath: "card.png",
    audioPath: "bed.mp3",
    outPath: "out.mp4",
  });
  const t = Number(args[args.indexOf("-t") + 1]);
  assert.ok(t >= 8 && t <= 12, `expected 8-12s, got ${t}`);
  assert.ok(args.includes("card.png"), "still frame input present");
  assert.ok(args.includes("bed.mp3"), "audio input present");
  assert.equal(args.at(-1), "out.mp4", "output path is last arg");
});

test("buildReelFfmpegArgs wires a centred Ken Burns zoom + audio fades + -shortest", () => {
  const args = buildReelFfmpegArgs({
    cardPath: "card.png",
    audioPath: "bed.mp3",
    outPath: "out.mp4",
    durationSec: 12,
  });
  const vf = args[args.indexOf("-vf") + 1];
  assert.match(vf, /zoompan=/);
  assert.match(vf, /s=1080x1920/);
  assert.match(vf, /format=yuv420p/);

  const af = args[args.indexOf("-af") + 1];
  assert.match(af, /afade=t=in:st=0/);
  assert.match(af, /afade=t=out:st=11:d=1/); // fades out over the last second

  assert.ok(args.includes("-shortest"));
});

test("renderVerticalCard writes a non-empty 1080x1920 PNG", async () => {
  const outPath = await tempOut("card.png");
  const result = await renderVerticalCard({
    text: "One task. One timer. One rep of the habit you're building.",
    outPath,
  });
  assert.equal(result, outPath);
  const info = await stat(outPath);
  assert.ok(info.size > 0);
  const { width, height } = pngSize(await readFile(outPath));
  assert.equal(width, REEL_WIDTH);
  assert.equal(height, REEL_HEIGHT);
});

test("renderVerticalCard shrinks long text so it stays inside the frame", async () => {
  const outPath = await tempOut("card.png");
  const longText =
    "Willpower isn't the problem, your environment is. You don't need more " +
    "discipline, you need fewer decisions to make when your focus is already " +
    "low, so build the ramp once and let it carry you every day after that.";
  await renderVerticalCard({ text: longText, outPath });
  const info = await stat(outPath);
  assert.ok(info.size > 0);
});

test("buildReelScriptFfmpegArgs with a single beat delegates to the plain single-card args", () => {
  const scriptArgs = buildReelScriptFfmpegArgs({
    beats: [{ cardPath: "beat0.png", durationSec: 5 }],
    audioPath: "bed.mp3",
    outPath: "out.mp4",
  });
  const plainArgs = buildReelFfmpegArgs({
    cardPath: "beat0.png",
    audioPath: "bed.mp3",
    outPath: "out.mp4",
    durationSec: 5,
  });
  assert.deepEqual(scriptArgs, plainArgs);
});

test("buildReelScriptFfmpegArgs with multiple beats wires per-beat inputs, xfade transitions, and a trimmed total duration", () => {
  const args = buildReelScriptFfmpegArgs({
    beats: [
      { cardPath: "beat0.png", durationSec: 3 },
      { cardPath: "beat1.png", durationSec: 4 },
      { cardPath: "beat2.png", durationSec: 2 },
    ],
    audioPath: "bed.mp3",
    crossfadeSec: 0.4,
    outPath: "out.mp4",
  });

  assert.ok(args.includes("beat0.png"), "first beat input present");
  assert.ok(args.includes("beat1.png"), "second beat input present");
  assert.ok(args.includes("beat2.png"), "third beat input present");
  assert.ok(args.includes("bed.mp3"), "audio input present");

  const filterComplex = args[args.indexOf("-filter_complex") + 1];
  assert.match(filterComplex, /zoompan=/);
  const xfadeCount = (filterComplex.match(/xfade=/g) || []).length;
  assert.equal(xfadeCount, 2, "one xfade per transition between 3 beats");
  assert.match(filterComplex, /afade=t=in:st=0/);

  assert.ok(args.includes("-map"), "explicit stream mapping present");
  assert.ok(args.includes("[vout]"));
  assert.ok(args.includes("[aout]"));

  // total = 3 + 4 + 2 - 2 * 0.4 crossfades = 8.2s
  const t = Number(args[args.indexOf("-t") + 1]);
  assert.ok(Math.abs(t - 8.2) < 0.01, `expected ~8.2s total, got ${t}`);

  assert.ok(args.includes("-shortest"));
  assert.equal(args.at(-1), "out.mp4");
});

test("renderReel produces a 1080x1920 mp4 with one video and one audio stream", async () => {
  const outPath = await tempOut("reel.mp4");
  const result = await renderReel({
    text: "What's the ONE habit you've been trying to build?",
    outPath,
    durationSec: 2,
    audioPath: AUDIO_BED,
  });
  assert.equal(result, outPath);
  const info = await stat(outPath);
  assert.ok(info.size > 0);

  const probe = await ffprobe(outPath);
  const video = probe.streams.filter((s) => s.codec_type === "video");
  const audio = probe.streams.filter((s) => s.codec_type === "audio");
  assert.equal(video.length, 1);
  assert.equal(audio.length, 1);
  assert.equal(video[0].width, REEL_WIDTH);
  assert.equal(video[0].height, REEL_HEIGHT);
  assert.ok(Math.abs(Number(probe.format.duration) - 2) < 0.5, `duration ${probe.format.duration}`);
});

test("renderReel with a script renders multiple beats crossfaded into one clip", async () => {
  const outPath = await tempOut("reel-script.mp4");
  const result = await renderReel({
    script: [
      { text: "One task.", durationSec: 1.5 },
      { text: "One timer.", durationSec: 1.5 },
    ],
    outPath,
    audioPath: AUDIO_BED,
  });
  assert.equal(result, outPath);
  const info = await stat(outPath);
  assert.ok(info.size > 0);

  const probe = await ffprobe(outPath);
  const video = probe.streams.filter((s) => s.codec_type === "video");
  const audio = probe.streams.filter((s) => s.codec_type === "audio");
  assert.equal(video.length, 1);
  assert.equal(audio.length, 1);
  assert.equal(video[0].width, REEL_WIDTH);
  assert.equal(video[0].height, REEL_HEIGHT);
  // 1.5 + 1.5 - 0.4s default crossfade = 2.6s
  assert.ok(Math.abs(Number(probe.format.duration) - 2.6) < 0.5, `duration ${probe.format.duration}`);
});

test("renderReel with a single-beat script behaves like the plain single-card path", async () => {
  const outPath = await tempOut("reel-script-single.mp4");
  await renderReel({
    script: [{ text: "Just one beat.", durationSec: 2 }],
    outPath,
    audioPath: AUDIO_BED,
  });
  const info = await stat(outPath);
  assert.ok(info.size > 0);

  const probe = await ffprobe(outPath);
  assert.ok(Math.abs(Number(probe.format.duration) - 2) < 0.5, `duration ${probe.format.duration}`);
});
