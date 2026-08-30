import { test } from "node:test";
import assert from "node:assert/strict";
import { getTodayVN, findPostForDate, runScheduledPost } from "../src/postToFacebook.js";

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
