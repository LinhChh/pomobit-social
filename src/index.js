import { parseArgs } from "node:util";
import "dotenv/config";
import { runScheduledPost } from "./postToFacebook.js";

const { values } = parseArgs({
  options: {
    date: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

try {
  await runScheduledPost({
    date: values.date,
    dryRun: values["dry-run"],
    pageId: process.env.FB_PAGE_ID,
    accessToken: process.env.FB_PAGE_ACCESS_TOKEN,
  });
} catch (error) {
  console.error("Failed to run scheduled post:", error.message);
  process.exitCode = 1;
}
