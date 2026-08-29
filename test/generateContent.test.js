import { test, mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { generatePostContent, appendGeneratedEntries, runGenerateContent } from "../src/generateContent.js";

function makeMockClient(toolInput) {
  return {
    messages: {
      create: mock.fn(async () => ({
        content: [{ type: "tool_use", name: "emit", input: toolInput }],
      })),
    },
  };
}

test("generatePostContent returns topText/bottomText/caption for educational_hook/infographic", async () => {
  const client = makeMockClient({ topText: "FOCUS", bottomText: "SYSTEMS", caption: "A real caption." });
  const result = await generatePostContent({ pillar: "educational_hook", format: "infographic", client });
  assert.equal(result.topText, "FOCUS");
  assert.equal(result.bottomText, "SYSTEMS");
  assert.ok(result.caption.length > 0);
});

test("generatePostContent returns quoteText/caption for relatable/quote_card", async () => {
  const client = makeMockClient({ quoteText: "A short quote.", caption: "A real caption." });
  const result = await generatePostContent({ pillar: "relatable", format: "quote_card", client });
  assert.ok(result.quoteText.length > 0);
  assert.ok(result.caption.length > 0);
});

test("generatePostContent returns only caption for engagement/text", async () => {
  const client = makeMockClient({ caption: "What's the one habit you've been trying to build?" });
  const result = await generatePostContent({ pillar: "engagement", format: "text", client });
  assert.deepEqual(Object.keys(result), ["caption"]);
});

test("generatePostContent calls Claude with the default model when none is specified", async () => {
  const client = makeMockClient({ caption: "What's blocking your focus today?" });
  await generatePostContent({ pillar: "engagement", format: "text", client });
  assert.equal(client.messages.create.mock.calls[0].arguments[0].model, "claude-opus-5");
});

test("generatePostContent calls Claude with a caller-specified model", async () => {
  const client = makeMockClient({ caption: "What's blocking your focus today?" });
  await generatePostContent({ pillar: "engagement", format: "text", client, model: "claude-sonnet-5" });
  assert.equal(client.messages.create.mock.calls[0].arguments[0].model, "claude-sonnet-5");
});

test("runGenerateContent forwards a caller-specified model to every generated slot", async () => {
  const client = makeMockClient({ caption: "What's blocking your focus today?" });
  const slots = [
    { date: "2026-10-05", week: 5, pillar: "engagement", format: "text" },
    { date: "2026-10-07", week: 5, pillar: "engagement", format: "text" },
  ];
  await runGenerateContent({ slots, client, dryRun: true, model: "claude-haiku-4-5" });
  assert.equal(client.messages.create.mock.calls.length, 2);
  for (const call of client.messages.create.mock.calls) {
    assert.equal(call.arguments[0].model, "claude-haiku-4-5");
  }
});

test("generatePostContent throws for pillar/format combos that need real data (not AI-generatable)", async () => {
  const client = makeMockClient({});
  await assert.rejects(
    () => generatePostContent({ pillar: "milestone", format: "photo_text", client }),
    /does not support/
  );
  assert.equal(client.messages.create.mock.calls.length, 0);
});

test("generatePostContent propagates errors from the Claude API instead of returning fake content", async () => {
  const client = {
    messages: {
      create: mock.fn(async () => {
        throw new Error("Anthropic API error: 500 Internal Server Error");
      }),
    },
  };
  await assert.rejects(
    () => generatePostContent({ pillar: "engagement", format: "text", client }),
    /Anthropic API error/
  );
});

test("appendGeneratedEntries inserts new entries sorted by date and forces status needs_review", () => {
  const calendar = [{ date: "2026-08-31", pillar: "educational_hook", status: "draft" }];
  const newEntries = [
    { date: "2026-09-07", pillar: "educational_hook", status: "draft" },
    { date: "2026-09-02", pillar: "relatable" },
  ];
  const merged = appendGeneratedEntries(calendar, newEntries);
  assert.deepEqual(
    merged.map((e) => e.date),
    ["2026-08-31", "2026-09-02", "2026-09-07"]
  );
  assert.equal(merged.find((e) => e.date === "2026-09-07").status, "needs_review");
  assert.equal(merged.find((e) => e.date === "2026-09-02").status, "needs_review");
});

test("appendGeneratedEntries does not overwrite an entry that already exists for that date", () => {
  const calendar = [{ date: "2026-08-31", pillar: "educational_hook", caption: "original" }];
  const newEntries = [{ date: "2026-08-31", pillar: "educational_hook", caption: "ai-generated" }];
  const merged = appendGeneratedEntries(calendar, newEntries);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].caption, "original");
});

test("runGenerateContent with dryRun true generates content without writing to the calendar file", async () => {
  const client = makeMockClient({ caption: "What's blocking your focus today?" });
  const slots = [{ date: "2026-10-05", week: 5, pillar: "engagement", format: "text" }];
  const result = await runGenerateContent({
    slots,
    client,
    dryRun: true,
    calendarPath: "/nonexistent/should-not-be-touched.json",
  });
  assert.equal(result.written, false);
  assert.equal(result.generated[0].caption, "What's blocking your focus today?");
});

test("runGenerateContent (not dry-run) reads the calendar, appends the entry, and writes it back", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pomobit-calendar-"));
  const calendarPath = path.join(dir, "calendar.json");
  await writeFile(calendarPath, JSON.stringify([{ date: "2026-08-31", pillar: "educational_hook", status: "draft" }]));

  const client = makeMockClient({ caption: "What's blocking your focus today?" });
  const slots = [{ date: "2026-10-05", week: 5, pillar: "engagement", format: "text" }];
  const result = await runGenerateContent({ slots, client, dryRun: false, calendarPath });

  assert.equal(result.written, true);
  const written = JSON.parse(await readFile(calendarPath, "utf-8"));
  assert.equal(written.length, 2);
  const newEntry = written.find((e) => e.date === "2026-10-05");
  assert.equal(newEntry.status, "needs_review");
  assert.equal(newEntry.caption, "What's blocking your focus today?");
});
