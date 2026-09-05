import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderTextCard, renderCarouselImages, renderPostImage, textCardContent } from "../src/renderImage.js";

async function tempDir() {
  return mkdtemp(join(tmpdir(), "pomobit-img-"));
}

async function tempOut(name = "card.png") {
  return join(await tempDir(), name);
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
  await assert.rejects(renderPostImage({ date: "2026-09-04", format: "mystery_format" }));
});

test("renderCarouselImages renders one PNG per slide, named <prefix>-1.png.. in order", async () => {
  const outPathPrefix = join(await tempDir(), "2026-09-28");
  const slides = [{ text: "Step one." }, { text: "Step two." }, { text: "Step three." }];

  const paths = await renderCarouselImages({ slides, outPathPrefix });

  assert.deepEqual(paths, [
    `${outPathPrefix}-1.png`,
    `${outPathPrefix}-2.png`,
    `${outPathPrefix}-3.png`,
  ]);
  for (const p of paths) {
    const info = await stat(p);
    assert.ok(info.size > 0);
  }
});

test("renderCarouselImages throws when there are fewer than 2 or more than 5 slides", async () => {
  const outPathPrefix = join(await tempDir(), "2026-09-28");
  await assert.rejects(renderCarouselImages({ slides: [{ text: "Only one." }], outPathPrefix }));
  await assert.rejects(
    renderCarouselImages({
      slides: Array.from({ length: 6 }, (_, i) => ({ text: `Slide ${i + 1}` })),
      outPathPrefix,
    })
  );
});

test("renderPostImage renders an array of PNGs for format 'carousel'", async () => {
  const paths = await renderPostImage({
    date: "2026-09-28",
    format: "carousel",
    slides: [{ text: "Step one." }, { text: "Step two." }],
  });
  assert.ok(Array.isArray(paths));
  assert.equal(paths.length, 2);
  assert.match(paths[0], /2026-09-28-1\.png$/);
  assert.match(paths[1], /2026-09-28-2\.png$/);
});
