import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTodayVN, findPostForDate, runScheduledPost } from "../src/postToFacebook.js";

/** Writes `entries` to a fresh temp calendar.json and returns its path. */
async function makeCalendarFile(entries) {
  const dir = await mkdtemp(join(tmpdir(), "pomobit-cal-"));
  const filePath = join(dir, "calendar.json");
  await writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`);
  return filePath;
}

const okFetch = async () => ({ ok: true, json: async () => ({ id: "1", post_id: "1_1" }) });

test("getTodayVN returns a YYYY-MM-DD string", () => {
  assert.match(getTodayVN(), /^\d{4}-\d{2}-\d{2}$/);
});

test("findPostForDate returns the post matching the given date", () => {
  const calendar = [
    { date: "2026-08-31", pillar: "educational_hook" },
    { date: "2026-09-02", pillar: "relatable" },
  ];
  assert.deepEqual(findPostForDate(calendar, "2026-09-02"), { date: "2026-09-02", pillar: "relatable" });
});

test("findPostForDate returns null when no post matches", () => {
  const calendar = [{ date: "2026-08-31", pillar: "educational_hook" }];
  assert.equal(findPostForDate(calendar, "2026-12-25"), null);
});

test("runScheduledPost skips a post with status \"posted\" without calling the Facebook API", async () => {
  const calendar = [{ date: "2026-08-31", pillar: "educational_hook", format: "infographic", status: "posted" }];
  const result = await runScheduledPost({ date: "2026-08-31", calendar });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "posted");
});

test("runScheduledPost still skips manual_needed and needs_review as before", async () => {
  const calendar = [
    { date: "2026-09-04", pillar: "feature_demo", format: "video", status: "manual_needed" },
    { date: "2026-09-11", pillar: "behind_the_scenes", format: "photo_text", status: "needs_review" },
  ];
  const manualResult = await runScheduledPost({ date: "2026-09-04", calendar });
  assert.equal(manualResult.skipped, true);
  assert.equal(manualResult.reason, "manual_needed");

  const reviewResult = await runScheduledPost({ date: "2026-09-11", calendar });
  assert.equal(reviewResult.skipped, true);
  assert.equal(reviewResult.reason, "needs_review");
});

test("runScheduledPost still renders and dry-runs a draft post as before", async () => {
  const calendar = [
    {
      date: "2026-09-09",
      pillar: "engagement",
      format: "text",
      status: "draft",
      caption: "What's the ONE habit you've been trying to build?",
    },
  ];
  const result = await runScheduledPost({ date: "2026-09-09", calendar, dryRun: true });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "dry_run");
});

const draftTextEntry = {
  date: "2026-09-09",
  pillar: "engagement",
  format: "text",
  status: "draft",
  caption: "What's the ONE habit you've been trying to build?",
};

test("runScheduledPost writes status \"posted\" back to the calendar file after a successful post", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", okFetch);
  const calendarPath = await makeCalendarFile([draftTextEntry]);

  const result = await runScheduledPost({
    date: "2026-09-09",
    calendarPath,
    pageId: "PAGE",
    accessToken: "TOKEN",
  });

  assert.equal(result.skipped, false);
  assert.equal(fetchMock.mock.callCount(), 1);
  const written = JSON.parse(await readFile(calendarPath, "utf-8"));
  assert.equal(written[0].status, "posted");
});

test("runScheduledPost does not mark posted on --dry-run", async () => {
  const calendarPath = await makeCalendarFile([draftTextEntry]);

  await runScheduledPost({ date: "2026-09-09", calendarPath, dryRun: true });

  const written = JSON.parse(await readFile(calendarPath, "utf-8"));
  assert.equal(written[0].status, "draft");
});

test("runScheduledPost does not mark posted when the entry is skipped", async () => {
  const calendarPath = await makeCalendarFile([
    { date: "2026-09-04", pillar: "feature_demo", format: "video", status: "manual_needed", caption: "x" },
  ]);

  await runScheduledPost({ date: "2026-09-04", calendarPath, pageId: "PAGE", accessToken: "TOKEN" });

  const written = JSON.parse(await readFile(calendarPath, "utf-8"));
  assert.equal(written[0].status, "manual_needed");
});

test("runScheduledPost does not mark posted when the Graph API returns an error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    json: async () => ({ error: { message: "bad token" } }),
  }));
  const calendarPath = await makeCalendarFile([draftTextEntry]);

  await assert.rejects(
    runScheduledPost({ date: "2026-09-09", calendarPath, pageId: "PAGE", accessToken: "TOKEN" })
  );

  const written = JSON.parse(await readFile(calendarPath, "utf-8"));
  assert.equal(written[0].status, "draft");
});

test("runScheduledPost publishes a text entry as a rendered photo, not a plain feed message", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", okFetch);
  const calendarPath = await makeCalendarFile([{ ...draftTextEntry, cardText: "One task. One timer." }]);

  await runScheduledPost({ date: "2026-09-09", calendarPath, pageId: "PAGE", accessToken: "TOKEN" });

  assert.equal(fetchMock.mock.callCount(), 1);
  assert.match(fetchMock.mock.calls[0].arguments[0], /\/PAGE\/photos$/);
});

const reelEntry = {
  date: "2026-09-16",
  pillar: "engagement",
  format: "reel",
  status: "draft",
  cardText: "What's the ONE habit you've been trying to build?",
  caption: "Drop it below 👇",
  durationSec: 2,
};

test("runScheduledPost --dry-run renders a reel video and logs the path without calling the API", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", okFetch);
  const calendar = [reelEntry];
  const result = await runScheduledPost({ date: "2026-09-16", calendar, dryRun: true });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "dry_run");
  assert.match(result.imagePath, /\.mp4$/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("runScheduledPost does not publish a reel yet — it renders then skips with reason reel_unsupported", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", okFetch);
  const calendar = [reelEntry];
  const result = await runScheduledPost({
    date: "2026-09-16",
    calendar,
    pageId: "PAGE",
    accessToken: "TOKEN",
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "reel_unsupported");
  assert.match(result.imagePath, /\.mp4$/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

const carouselEntry = {
  date: "2026-09-28",
  pillar: "educational_hook",
  format: "carousel",
  status: "draft",
  slides: [{ text: "Step one." }, { text: "Step two." }, { text: "Step three." }],
  caption: "3 steps to actually finish your to-do list.",
};

test("runScheduledPost --dry-run renders a carousel (all slides) and logs without calling the API", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", okFetch);
  const calendar = [carouselEntry];
  const result = await runScheduledPost({ date: "2026-09-28", calendar, dryRun: true });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "dry_run");
  assert.ok(Array.isArray(result.imagePath));
  assert.equal(result.imagePath.length, 3);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("runScheduledPost publishes a carousel by uploading each slide unpublished then creating one feed post with attached_media", async (t) => {
  let photoCallIndex = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/photos")) {
      photoCallIndex += 1;
      return { ok: true, json: async () => ({ id: `photo-${photoCallIndex}` }) };
    }
    return { ok: true, json: async () => ({ id: "1", post_id: "1_1" }) };
  });
  const calendarPath = await makeCalendarFile([carouselEntry]);

  const result = await runScheduledPost({ date: "2026-09-28", calendarPath, pageId: "PAGE", accessToken: "TOKEN" });

  assert.equal(result.skipped, false);
  assert.equal(fetchMock.mock.callCount(), 4); // 3 unpublished photo uploads + 1 feed post

  for (const call of fetchMock.mock.calls.slice(0, 3)) {
    assert.match(call.arguments[0], /\/PAGE\/photos$/);
    assert.equal(call.arguments[1].body.get("published"), "false");
  }

  const feedCall = fetchMock.mock.calls[3];
  assert.match(feedCall.arguments[0], /\/PAGE\/feed$/);
  const feedBody = feedCall.arguments[1].body;
  assert.equal(feedBody.get("message"), carouselEntry.caption);
  assert.equal(feedBody.get("attached_media[0]"), JSON.stringify({ media_fbid: "photo-1" }));
  assert.equal(feedBody.get("attached_media[1]"), JSON.stringify({ media_fbid: "photo-2" }));
  assert.equal(feedBody.get("attached_media[2]"), JSON.stringify({ media_fbid: "photo-3" }));

  const written = JSON.parse(await readFile(calendarPath, "utf-8"));
  assert.equal(written[0].status, "posted");
});

test("re-running the same day skips the already-posted entry without a duplicate Facebook call", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", okFetch);
  const calendarPath = await makeCalendarFile([draftTextEntry]);

  await runScheduledPost({ date: "2026-09-09", calendarPath, pageId: "PAGE", accessToken: "TOKEN" });
  const second = await runScheduledPost({ date: "2026-09-09", calendarPath, pageId: "PAGE", accessToken: "TOKEN" });

  assert.equal(second.skipped, true);
  assert.equal(second.reason, "posted");
  assert.equal(fetchMock.mock.callCount(), 1);
});
