import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CALENDAR_PATH = path.join(__dirname, "..", "content", "calendar.json");
const MODEL = "claude-opus-5";

const BRAND_VOICE_SYSTEM_PROMPT = `You write Facebook posts for Pomobit, a focus/productivity timer app.
Voice: direct, a little contrarian, no corporate tone, no emojis, no hashtags.
- educational_hook posts contrast a common myth against the real cause (see examples: "Multitasking isn't productivity, it's productive procrastination"; "Willpower isn't the problem, your environment is").
- relatable posts are one short, punchy quote that names a shared frustration, then a caption that adds context.
- engagement posts are a single open-ended question inviting comments, no preamble.`;

const PILLAR_FORMATS = {
  educational_hook: "infographic",
  relatable: "quote_card",
  engagement: "text",
};

const CONTENT_TOOLS = {
  infographic: {
    name: "emit_infographic_content",
    description: "Emit the generated infographic post content.",
    input_schema: {
      type: "object",
      properties: {
        topText: { type: "string", description: "Short label for the top block, the myth (e.g. 'MULTITASKING')" },
        bottomText: { type: "string", description: "Short label for the bottom block, the real cause" },
        caption: { type: "string", description: "Full Facebook caption expanding on the contrast" },
      },
      required: ["topText", "bottomText", "caption"],
      additionalProperties: false,
    },
  },
  quote_card: {
    name: "emit_quote_card_content",
    description: "Emit the generated quote-card post content.",
    input_schema: {
      type: "object",
      properties: {
        quoteText: { type: "string", description: "Short, punchy quote (one sentence)" },
        caption: { type: "string", description: "Full Facebook caption, starts with the quote then adds context" },
      },
      required: ["quoteText", "caption"],
      additionalProperties: false,
    },
  },
  text: {
    name: "emit_text_content",
    description: "Emit the generated plain-text engagement post content.",
    input_schema: {
      type: "object",
      properties: {
        caption: { type: "string", description: "A single open-ended question inviting comments" },
      },
      required: ["caption"],
      additionalProperties: false,
    },
  },
};

/**
 * Generates post content for the 3 pillars that don't depend on real
 * data/photos/video (educational_hook, relatable, engagement). Other pillars
 * (feature_demo, milestone, testimonials, behind_the_scenes) need real
 * evidence and must never be filled in by the model.
 */
export async function generatePostContent({ pillar, format, client = new Anthropic() }) {
  const expectedFormat = PILLAR_FORMATS[pillar];
  if (!expectedFormat || expectedFormat !== format) {
    throw new Error(
      `generatePostContent does not support pillar="${pillar}" format="${format}" — only ` +
        `educational_hook/infographic, relatable/quote_card, and engagement/text can be AI-generated.`
    );
  }

  const tool = CONTENT_TOOLS[format];
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: BRAND_VOICE_SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: `Write a new Pomobit Facebook post for the "${pillar}" content pillar.` }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) {
    throw new Error("Claude did not return the expected structured content.");
  }
  return toolUse.input;
}

/**
 * Merges AI-generated entries into the calendar. Always forces
 * status: "needs_review" — generated public-facing copy must be reviewed by
 * a human before it can be flipped to "draft" and auto-posted. Never
 * overwrites an entry that already exists for a given date.
 */
export function appendGeneratedEntries(calendar, newEntries) {
  const existingDates = new Set(calendar.map((entry) => entry.date));
  const toAdd = newEntries
    .filter((entry) => !existingDates.has(entry.date))
    .map((entry) => ({ ...entry, status: "needs_review" }));

  return [...calendar, ...toAdd].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generates content for each requested slot ({date, week, pillar, format}).
 * In --dry-run mode, prints the generated entries without touching the
 * calendar file.
 */
export async function runGenerateContent({ slots, client, dryRun = false, calendarPath = DEFAULT_CALENDAR_PATH }) {
  const generated = [];
  for (const slot of slots) {
    const content = await generatePostContent({ pillar: slot.pillar, format: slot.format, client });
    generated.push({ ...slot, ...content });
  }

  if (dryRun) {
    console.log(JSON.stringify(generated, null, 2));
    return { written: false, generated };
  }

  const calendar = JSON.parse(await readFile(calendarPath, "utf-8"));
  const merged = appendGeneratedEntries(calendar, generated);
  await writeFile(calendarPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  return { written: true, generated };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      slots: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  if (!values.slots) {
    console.error("Usage: node src/generateContent.js --slots <path-to-slots.json> [--dry-run]");
    process.exitCode = 1;
  } else {
    try {
      const slots = JSON.parse(await readFile(values.slots, "utf-8"));
      await runGenerateContent({ slots, dryRun: values["dry-run"] });
    } catch (error) {
      console.error("Failed to generate content:", error.message);
      process.exitCode = 1;
    }
  }
}
