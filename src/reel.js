import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { registerFonts, wrapText, drawWrappedText, BRAND } from "./renderImage.js";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reel theme, sampled from the Pomobit app icon/wordmark (the blue tomato
 * gradient + green leaf) rather than the cream/brown palette the static feed
 * cards use — Reels get their own brand-blue look.
 */
export const REEL_COLORS = {
  gradientTop: "#1596D6",
  gradientBottom: "#052F5C",
  text: "#FFFFFF",
  accentGreen: "#3BAA6B",
};

/** Reels are shot 1080×1920 — the full-screen 9:16 frame Facebook/Instagram expect. */
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

/** Default clip length. The MVP renders a single Ken Burns still, 8–12s is the sweet spot. */
export const DEFAULT_DURATION_SEC = 10;
const FPS = 30;

export const DEFAULT_AUDIO = path.join(
  __dirname,
  "..",
  "assets",
  "audio",
  "lunarboommusic-guqin-melody-564700.mp3",
);

/** Returns the bare command name if it resolves on PATH, else null. */
function commandOnPath(bin) {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(finder, [bin], { stdio: "ignore" });
    return bin;
  } catch {
    return null;
  }
}

/**
 * ubuntu-latest ships ffmpeg/ffprobe, so on CI we use the system binary; the
 * bundled `ffmpeg-static` / `ffprobe-static` builds are the fallback for local
 * machines (macOS without a brew install).
 */
export function resolveFfmpeg() {
  return commandOnPath("ffmpeg") ?? ffmpegStatic;
}

export function resolveFfprobe() {
  return commandOnPath("ffprobe") ?? ffprobeStatic.path;
}

/**
 * Renders the still that sits behind the Ken Burns move: a 1080×1920 version of
 * the brand text card, with the body copy auto-shrunk so it never leaves the
 * safe area.
 */
export async function renderVerticalCard({ text, outPath, width = REEL_WIDTH, height = REEL_HEIGHT }) {
  registerFonts();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, REEL_COLORS.gradientTop);
  bg.addColorStop(1, REEL_COLORS.gradientBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = REEL_COLORS.text;
  ctx.font = "600 40px 'Poppins SemiBold'";
  ctx.textAlign = "center";
  ctx.fillText(BRAND, width / 2, 150);

  ctx.strokeStyle = REEL_COLORS.accentGreen;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 54, 196);
  ctx.lineTo(width / 2 + 54, 196);
  ctx.stroke();

  // Vertical safe area for the body copy — leaves room for the caption/handles
  // that Reels overlay along the bottom edge.
  const topBound = height * 0.22;
  const bottomBound = height * 0.86;
  const maxTextWidth = width - 200;

  let fontSize = 76;
  let lineHeight = Math.round(fontSize * 1.32);
  let lines;
  while (fontSize > 34) {
    ctx.font = `600 ${fontSize}px 'Poppins SemiBold'`;
    lines = wrapText(ctx, text, maxTextWidth);
    if (lines.length * lineHeight <= bottomBound - topBound) break;
    fontSize -= 4;
    lineHeight = Math.round(fontSize * 1.32);
  }

  ctx.fillStyle = REEL_COLORS.text;
  ctx.font = `600 ${fontSize}px 'Poppins SemiBold'`;
  const startY = (topBound + bottomBound) / 2 - ((lines.length - 1) * lineHeight) / 2;
  drawWrappedText(ctx, text, { x: width / 2, y: startY, maxWidth: maxTextWidth, lineHeight });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, canvas.toBuffer("image/png"));
  return outPath;
}

/**
 * Builds the argv for the single ffmpeg call that turns a still + a music bed
 * into a Ken Burns Reel. Kept pure so it can be unit-tested without spawning
 * anything.
 */
export function buildReelFfmpegArgs({
  cardPath,
  audioPath,
  outPath,
  durationSec = DEFAULT_DURATION_SEC,
  fps = FPS,
}) {
  const frames = Math.round(durationSec * fps);
  const fadeOutStart = Math.max(0, durationSec - 1);
  // Upscale first so zoompan interpolates a big source (no shimmer), then let it
  // creep from 1.0 → 1.15 while holding the frame centred.
  const vf = [
    "scale=2160:3840",
    `zoompan=z='min(zoom+0.0004,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${REEL_WIDTH}x${REEL_HEIGHT}:fps=${fps}`,
    "format=yuv420p",
  ].join(",");

  return [
    "-y",
    "-loop",
    "1",
    "-i",
    cardPath,
    "-i",
    audioPath,
    "-vf",
    vf,
    "-t",
    String(durationSec),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-r",
    String(fps),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-af",
    `afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart}:d=1`,
    "-shortest",
    outPath,
  ];
}

/** Default crossfade between two script beats — short enough to stay unnoticed. */
export const DEFAULT_CROSSFADE_SEC = 0.4;

/** Builds one beat's per-input filter: upscale, Ken Burns zoom trimmed to its own duration, format. */
function buildBeatFilter(index, durationSec, fps) {
  const frames = Math.round(durationSec * fps);
  return [
    `[${index}:v]scale=2160:3840`,
    `zoompan=z='min(zoom+0.0004,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${REEL_WIDTH}x${REEL_HEIGHT}:fps=${fps}`,
    "format=yuv420p",
    `setsar=1[v${index}]`,
  ].join(",");
}

/**
 * Builds the argv for a multi-beat Reel: one still per script beat, each with
 * its own Ken Burns zoom sized to its `durationSec`, crossfaded together with
 * `xfade`, under one continuous music bed. A single beat just delegates to
 * `buildReelFfmpegArgs` — no transition needed.
 */
export function buildReelScriptFfmpegArgs({
  beats,
  audioPath,
  outPath,
  fps = FPS,
  crossfadeSec = DEFAULT_CROSSFADE_SEC,
}) {
  if (beats.length === 1) {
    return buildReelFfmpegArgs({
      cardPath: beats[0].cardPath,
      audioPath,
      outPath,
      durationSec: beats[0].durationSec,
      fps,
    });
  }

  const totalDurationSec =
    beats.reduce((sum, beat) => sum + beat.durationSec, 0) - crossfadeSec * (beats.length - 1);
  const fadeOutStart = Math.max(0, totalDurationSec - 1);
  const audioInputIndex = beats.length;

  const inputArgs = beats.flatMap((beat) => ["-loop", "1", "-i", beat.cardPath]);
  const perBeatFilters = beats.map((beat, i) => buildBeatFilter(i, beat.durationSec, fps));

  const xfadeFilters = [];
  let cumulative = beats[0].durationSec;
  let prevLabel = "v0";
  for (let i = 1; i < beats.length; i++) {
    const offset = cumulative - crossfadeSec;
    const outLabel = i === beats.length - 1 ? "vout" : `vx${i}`;
    xfadeFilters.push(
      `[${prevLabel}][v${i}]xfade=transition=fade:duration=${crossfadeSec}:offset=${offset.toFixed(3)}[${outLabel}]`,
    );
    cumulative = cumulative + beats[i].durationSec - crossfadeSec;
    prevLabel = outLabel;
  }

  const audioFilter = `[${audioInputIndex}:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=1[aout]`;
  const filterComplex = [...perBeatFilters, ...xfadeFilters, audioFilter].join(";");

  return [
    "-y",
    ...inputArgs,
    "-i",
    audioPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-t",
    totalDurationSec.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-r",
    String(fps),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-shortest",
    outPath,
  ];
}

/**
 * Renders a Ken Burns MVP Reel. With plain `text`, it's one 1080×1920 card, a
 * slow zoom/pan, and a royalty-free music bed faded in/out — all in a single
 * ffmpeg pass (no JS frame loop, so it is cheap enough for GitHub Actions).
 * With `script` (an array of `{ text, durationSec }` beats), it renders one
 * card per beat and crossfades them together under the same music bed.
 */
export async function renderReel({
  text,
  script,
  outPath,
  durationSec = DEFAULT_DURATION_SEC,
  audioPath = DEFAULT_AUDIO,
}) {
  await mkdir(path.dirname(outPath), { recursive: true });

  if (script && script.length > 0) {
    const beats = await Promise.all(
      script.map(async (beat, i) => {
        const cardPath = `${outPath}.beat${i}.png`;
        await renderVerticalCard({ text: beat.text, outPath: cardPath });
        return { cardPath, durationSec: beat.durationSec };
      }),
    );

    const args = buildReelScriptFfmpegArgs({ beats, audioPath, outPath });
    try {
      await execFileP(resolveFfmpeg(), args, { maxBuffer: 1024 * 1024 * 32 });
    } finally {
      await Promise.all(beats.map((beat) => rm(beat.cardPath, { force: true })));
    }
    return outPath;
  }

  const cardPath = `${outPath}.card.png`;
  await renderVerticalCard({ text, outPath: cardPath });

  const args = buildReelFfmpegArgs({ cardPath, audioPath, outPath, durationSec });
  try {
    await execFileP(resolveFfmpeg(), args, { maxBuffer: 1024 * 1024 * 32 });
  } finally {
    await rm(cardPath, { force: true });
  }
  return outPath;
}
