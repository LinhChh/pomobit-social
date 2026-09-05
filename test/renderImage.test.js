import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  COLORS,
  renderInfographic,
  renderQuoteCard,
  renderTextCard,
  renderPostImage,
  textCardContent,
} from "../src/renderImage.js";

async function tempOut(name = "card.png") {
  const dir = await mkdtemp(join(tmpdir(), "pomobit-img-"));
  return join(dir, name);
}

/** Reads a single pixel's color out of a rendered PNG, as `#RRGGBB`. */
async function readPixel(pngPath, x, y) {
  const img = await loadImage(pngPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

test("COLORS uses the Pomobit app palette (navy text, green accent, white background) instead of the old cream/brown theme", () => {
  assert.equal(COLORS.background, "#FFFFFF");
  assert.equal(COLORS.textPrimary, "#111828");
  assert.equal(COLORS.accent, "#309652");
});

test("renderInfographic, renderQuoteCard, and renderTextCard share the same background color from COLORS", async () => {
  const infographicPath = await tempOut("infographic.png");
  await renderInfographic({ topText: "Willpower", bottomText: "Structure", outPath: infographicPath });

  const quotePath = await tempOut("quote.png");
  await renderQuoteCard({ quoteText: "Small steps compound.", outPath: quotePath });

  const textPath = await tempOut("text.png");
  await renderTextCard({ text: "What time of day do you focus best?", outPath: textPath });

  // Corner pixel: no renderer draws anything there, so it's a solid read of
  // the background fill with no anti-aliasing to account for.
  const [infographicBg, quoteBg, textBg] = await Promise.all([
    readPixel(infographicPath, 10, 10),
    readPixel(quotePath, 10, 10),
    readPixel(textPath, 10, 10),
  ]);

  assert.equal(infographicBg, COLORS.background);
  assert.equal(quoteBg, COLORS.background);
  assert.equal(textBg, COLORS.background);
});

test("renderTextCard writes a non-empty PNG to the given path", async () => {
  const outPath = await tempOut();
  const result = await renderTextCard({ text: "What time of day do you actually focus best?", outPath });
  assert.equal(result, outPath);
  const info = await stat(outPath);
  assert.ok(info.size > 0);
});

test("renderPostImage renders an image for format 'text' instead of returning null", async () => {
  const imagePath = await renderPostImage({ date: "2026-09-09", format: "text", caption: "A question?" });
  assert.ok(imagePath);
  assert.match(imagePath, /2026-09-09\.png$/);
  const info = await stat(imagePath);
  assert.ok(info.size > 0);
});

test("textCardContent uses cardText when present, else falls back to caption", () => {
  assert.equal(textCardContent({ cardText: "short hook", caption: "a much longer caption" }), "short hook");
  assert.equal(textCardContent({ caption: "a much longer caption" }), "a much longer caption");
});

test("renderPostImage renders an mp4 (not a static image) for format 'reel'", async () => {
  const mediaPath = await renderPostImage({
    date: "2026-09-16",
    format: "reel",
    cardText: "One task. One timer.",
    durationSec: 2,
  });
  assert.ok(mediaPath);
  assert.match(mediaPath, /2026-09-16\.mp4$/);
  assert.doesNotMatch(mediaPath, /\.png$/);
  const info = await stat(mediaPath);
  assert.ok(info.size > 0);
});

test("renderPostImage renders a multi-beat mp4 for format 'reel' with a script", async () => {
  const mediaPath = await renderPostImage({
    date: "2026-09-18",
    format: "reel",
    script: [
      { text: "One task.", durationSec: 1.5 },
      { text: "One timer.", durationSec: 1.5 },
    ],
  });
  assert.ok(mediaPath);
  assert.match(mediaPath, /2026-09-18\.mp4$/);
  const info = await stat(mediaPath);
  assert.ok(info.size > 0);
});

test("renderPostImage still returns null for video and photo_text", async () => {
  assert.equal(await renderPostImage({ date: "2026-09-04", format: "video" }), null);
  assert.equal(await renderPostImage({ date: "2026-09-11", format: "photo_text" }), null);
});

test("renderPostImage throws for an unknown format", async () => {
  await assert.rejects(renderPostImage({ date: "2026-09-04", format: "carousel" }));
});
