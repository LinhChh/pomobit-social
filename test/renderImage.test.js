import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderTextCard, renderPostImage, textCardContent } from "../src/renderImage.js";

async function tempOut(name = "card.png") {
  const dir = await mkdtemp(join(tmpdir(), "pomobit-img-"));
  return join(dir, name);
}

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

test("renderPostImage still returns null for video and photo_text", async () => {
  assert.equal(await renderPostImage({ date: "2026-09-04", format: "video" }), null);
  assert.equal(await renderPostImage({ date: "2026-09-11", format: "photo_text" }), null);
});

test("renderPostImage throws for an unknown format", async () => {
  await assert.rejects(renderPostImage({ date: "2026-09-04", format: "carousel" }));
});
