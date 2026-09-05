import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReel } from "./reel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "..", "assets", "fonts");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

const SIZE = 1080;
export const BRAND = "POMOBIT";

export const COLORS = {
  background: "#f5ede0",
  darkBrown: "#3d2914",
  accentOrange: "#c45a3c",
};

let fontsRegistered = false;

export function registerFonts() {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Poppins-Regular.ttf"), "Poppins");
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Poppins-SemiBold.ttf"), "Poppins SemiBold");
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Poppins-Bold.ttf"), "Poppins Bold");
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Poppins-ExtraBold.ttf"), "Poppins ExtraBold");
  fontsRegistered = true;
}

/**
 * Wraps text to fit within maxWidth, splitting on word boundaries.
 * Relies on canvas 2D's built-in measureText, no external dependency needed.
 */
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function drawWrappedText(ctx, text, { x, y, maxWidth, lineHeight, align = "center" }) {
  const lines = wrapText(ctx, text, maxWidth);
  ctx.textAlign = align;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight);
  });
  return lines.length;
}

async function writePng(canvas, outPath) {
  await mkdir(path.dirname(outPath), { recursive: true });
  const buffer = canvas.toBuffer("image/png");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outPath, buffer);
  return outPath;
}

function drawBrand(ctx, color) {
  ctx.fillStyle = color;
  ctx.font = "600 32px 'Poppins SemiBold'";
  ctx.textAlign = "center";
  ctx.fillText(BRAND, SIZE / 2, 80);
}

export async function renderInfographic({ topText, bottomText, outPath }) {
  registerFonts();
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Brand header
  drawBrand(ctx, COLORS.darkBrown);

  const halfHeight = SIZE / 2;
  const maxTextWidth = SIZE - 160;

  // Top block: "NOT THE PROBLEM"
  ctx.fillStyle = COLORS.darkBrown;
  ctx.font = "600 30px 'Poppins SemiBold'";
  ctx.textAlign = "center";
  ctx.fillText("NOT THE PROBLEM", SIZE / 2, halfHeight / 2 - 60);

  ctx.font = "800 72px 'Poppins ExtraBold'";
  drawWrappedText(ctx, topText, {
    x: SIZE / 2,
    y: halfHeight / 2 + 20,
    maxWidth: maxTextWidth,
    lineHeight: 84,
  });

  // Divider line
  ctx.strokeStyle = COLORS.darkBrown;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, halfHeight);
  ctx.lineTo(SIZE - 80, halfHeight);
  ctx.stroke();

  // Bottom block: "THE REAL ANSWER"
  ctx.fillStyle = COLORS.accentOrange;
  ctx.font = "600 30px 'Poppins SemiBold'";
  ctx.textAlign = "center";
  ctx.fillText("THE REAL ANSWER", SIZE / 2, halfHeight + halfHeight / 2 - 40);

  ctx.font = "800 72px 'Poppins ExtraBold'";
  drawWrappedText(ctx, bottomText, {
    x: SIZE / 2,
    y: halfHeight + halfHeight / 2 + 40,
    maxWidth: maxTextWidth,
    lineHeight: 84,
  });

  return writePng(canvas, outPath);
}

export async function renderQuoteCard({ quoteText, outPath }) {
  registerFonts();
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = COLORS.accentOrange;
  ctx.font = "800 140px 'Poppins ExtraBold'";
  ctx.textAlign = "center";
  ctx.fillText("“", SIZE / 2, 260);

  ctx.fillStyle = COLORS.darkBrown;
  ctx.font = "600 56px 'Poppins SemiBold'";
  const maxTextWidth = SIZE - 200;
  const lineHeight = 68;
  const lines = wrapText(ctx, quoteText, maxTextWidth);
  const startY = SIZE / 2 - ((lines.length - 1) * lineHeight) / 2;
  drawWrappedText(ctx, quoteText, {
    x: SIZE / 2,
    y: startY,
    maxWidth: maxTextWidth,
    lineHeight,
  });

  ctx.font = "600 28px 'Poppins SemiBold'";
  ctx.fillStyle = COLORS.darkBrown;
  ctx.textAlign = "center";
  ctx.fillText(BRAND, SIZE / 2, SIZE - 70);

  return writePng(canvas, outPath);
}

export async function renderTextCard({ text, outPath }) {
  registerFonts();
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawBrand(ctx, COLORS.darkBrown);

  // Short accent rule under the brand — distinguishes this from the quote card,
  // which leads with a large quotation mark instead.
  ctx.strokeStyle = COLORS.accentOrange;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(SIZE / 2 - 44, 112);
  ctx.lineTo(SIZE / 2 + 44, 112);
  ctx.stroke();

  ctx.fillStyle = COLORS.darkBrown;
  ctx.font = "600 60px 'Poppins SemiBold'";
  const maxTextWidth = SIZE - 200;
  const lineHeight = 78;
  const lines = wrapText(ctx, text, maxTextWidth);
  const startY = SIZE / 2 - ((lines.length - 1) * lineHeight) / 2;
  drawWrappedText(ctx, text, {
    x: SIZE / 2,
    y: startY,
    maxWidth: maxTextWidth,
    lineHeight,
  });

  return writePng(canvas, outPath);
}

/**
 * Renders a 2-5 slide carousel: one 1080×1080 PNG per slide, reusing the
 * `renderTextCard` layout, named `<outPathPrefix>-1.png`.. in slide order.
 */
export async function renderCarouselImages({ slides, outPathPrefix }) {
  if (!Array.isArray(slides) || slides.length < 2 || slides.length > 5) {
    throw new Error(`Carousel format requires 2-5 slides, got ${slides?.length ?? 0}`);
  }

  const paths = [];
  for (let i = 0; i < slides.length; i++) {
    const outPath = `${outPathPrefix}-${i + 1}.png`;
    await renderTextCard({ text: slides[i].text, outPath });
    paths.push(outPath);
  }
  return paths;
}

/** The text to render on a `text` post's image: `cardText` if set, else the caption. */
export function textCardContent(post) {
  return post.cardText ?? post.caption;
}

/**
 * Dispatches rendering based on post.format. Returns the output media path
 * (a `.png` for the single-image feed formats, a `.mp4` for `reel`, an array
 * of `.png` paths for `carousel`), or null for the two formats that carry
 * manually-produced media instead (video/photo_text).
 */
export async function renderPostImage(post) {
  const outPath = path.join(OUTPUT_DIR, `${post.date}.png`);

  switch (post.format) {
    case "reel":
      return renderReel({
        text: post.cardText ?? post.quoteText ?? post.caption,
        script: post.script,
        outPath: path.join(OUTPUT_DIR, `${post.date}.mp4`),
        durationSec: post.durationSec,
        audioPath: post.audio
          ? path.join(__dirname, "..", post.audio)
          : undefined,
      });
    case "infographic":
      return renderInfographic({
        topText: post.topText,
        bottomText: post.bottomText,
        outPath,
      });
    case "quote_card":
      return renderQuoteCard({
        quoteText: post.quoteText,
        outPath,
      });
    case "text":
      return renderTextCard({
        text: textCardContent(post),
        outPath,
      });
    case "carousel":
      return renderCarouselImages({
        slides: post.slides,
        outPathPrefix: path.join(OUTPUT_DIR, post.date),
      });
    case "video":
    case "photo_text":
      return null;
    default:
      throw new Error(`Unknown post format: ${post.format}`);
  }
}
