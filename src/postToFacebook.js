import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPostImage } from "./renderImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CALENDAR_PATH = path.join(__dirname, "..", "content", "calendar.json");
const GRAPH_API_VERSION = "v26.0";

/** Returns today's date as YYYY-MM-DD in Asia/Ho_Chi_Minh timezone. */
export function getTodayVN() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export async function loadCalendar(calendarPath = CALENDAR_PATH) {
  const raw = await readFile(calendarPath, "utf-8");
  return JSON.parse(raw);
}

export function findPostForDate(calendar, date) {
  return calendar.find((post) => post.date === date) ?? null;
}

/**
 * Re-reads the calendar file and flips the entry for `date` to
 * status: "posted", so a late-firing or retried workflow run in the same
 * day won't publish the same post twice.
 */
async function markAsPosted(calendarPath, date) {
  const calendar = await loadCalendar(calendarPath);
  const entry = calendar.find((post) => post.date === date);
  if (!entry || entry.status === "posted") return;
  entry.status = "posted";
  await writeFile(calendarPath, `${JSON.stringify(calendar, null, 2)}\n`);
}

async function postPhoto({ pageId, accessToken, imagePath, caption }) {
  const imageBuffer = await readFile(imagePath);
  const form = new FormData();
  form.append("source", new Blob([imageBuffer], { type: "image/png" }), path.basename(imagePath));
  form.append("caption", caption);
  form.append("access_token", accessToken);

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`, {
    method: "POST",
    body: form,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Facebook Graph API error (photos): ${JSON.stringify(body)}`);
  }
  return body;
}

async function postFeedMessage({ pageId, accessToken, message }) {
  const params = new URLSearchParams({ message, access_token: accessToken });

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`, {
    method: "POST",
    body: params,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Facebook Graph API error (feed): ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Finds the post scheduled for `date` (or today in VN time if omitted),
 * renders its image if needed, and posts it to the configured Facebook Page.
 * Skips posts flagged manual_needed/needs_review instead of publishing placeholder content.
 * After a successful post, flips the entry's status to "posted" in the calendar
 * file so a duplicate run the same day is a no-op.
 */
export async function runScheduledPost({
  date,
  dryRun = false,
  pageId,
  accessToken,
  calendar,
  calendarPath,
} = {}) {
  const targetDate = date ?? getTodayVN();
  const resolvedPath = calendarPath ?? CALENDAR_PATH;
  const activeCalendar = calendar ?? (await loadCalendar(resolvedPath));
  // Only write status back when we own a real file: either an explicit path, or
  // the default file we just loaded. An in-memory calendar is the caller's to persist.
  const writebackPath = calendar && !calendarPath ? null : resolvedPath;
  const post = findPostForDate(activeCalendar, targetDate);

  if (!post) {
    console.log(`No post scheduled for ${targetDate}. Nothing to do.`);
    return { skipped: true, reason: "no_post_scheduled", date: targetDate };
  }

  console.log(`Found post for ${targetDate}: pillar="${post.pillar}" format="${post.format}" status="${post.status}"`);

  if (post.status === "posted") {
    console.log(`Post for ${targetDate} has already been posted. Skipping.`);
    return { skipped: true, reason: "posted", date: targetDate, post };
  }

  if (post.status === "manual_needed" || post.status === "needs_review") {
    console.warn(
      `⚠️  Post for ${targetDate} has status "${post.status}" and will NOT be auto-posted.\n` +
        `   ${post.note ?? "Review the content before posting manually."}`
    );
    return { skipped: true, reason: post.status, date: targetDate, post };
  }

  const imagePath = await renderPostImage(post);
  if (imagePath) {
    console.log(`Rendered ${post.format === "reel" ? "video" : "image"}: ${imagePath}`);
  }

  if (dryRun) {
    console.log("--dry-run enabled: skipping Facebook API call.");
    console.log(`Caption:\n${post.caption}`);
    return { skipped: true, reason: "dry_run", date: targetDate, post, imagePath };
  }

  if (post.format === "reel") {
    console.warn(
      `⚠️  Reel for ${targetDate} was rendered (${imagePath}) but is NOT auto-published — ` +
        `posting Reels via the Graph API is not implemented yet (see #18). Upload it manually.`
    );
    return { skipped: true, reason: "reel_unsupported", date: targetDate, post, imagePath };
  }

  if (!pageId || !accessToken) {
    throw new Error("FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN are required to post (or use --dry-run).");
  }

  const result = imagePath
    ? await postPhoto({ pageId, accessToken, imagePath, caption: post.caption })
    : await postFeedMessage({ pageId, accessToken, message: post.caption });

  console.log("Posted to Facebook:", result);

  if (writebackPath) {
    await markAsPosted(writebackPath, targetDate);
    console.log(`Marked ${targetDate} as posted in ${path.basename(writebackPath)}.`);
  }

  return { skipped: false, date: targetDate, post, imagePath, result };
}
