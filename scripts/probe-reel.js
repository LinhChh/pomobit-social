/**
 * ffprobe summary for a rendered reel/image — duration + stream types, so you
 * don't need an inline `node -e` snippet to sanity-check a render (e.g. that
 * the audio track actually made it into the file).
 *
 *   node scripts/probe-reel.js output/2026-09-07.mp4
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveFfprobe } from "../src/reel.js";

const execFileP = promisify(execFile);

export async function probeMedia(filePath) {
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

export function formatProbeSummary(filePath, probe) {
  const lines = [`File: ${filePath}`, `Duration: ${probe.format.duration}s`];
  for (const stream of probe.streams) {
    const dims = stream.width ? ` ${stream.width}x${stream.height}` : "";
    lines.push(`- ${stream.codec_type}: ${stream.codec_name}${dims}`);
  }
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/probe-reel.js <path-to-media>");
    process.exit(1);
  }
  const probe = await probeMedia(filePath);
  console.log(formatProbeSummary(filePath, probe));
}
