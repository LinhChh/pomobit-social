import { test } from "node:test";
import assert from "node:assert/strict";
import { getTodayVN, findPostForDate } from "../src/postToFacebook.js";

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
