# Pomobit Social Automation

Automates posting Pomobit's 4-week content calendar to its Facebook Page: renders
infographic/quote-card images, posts via the Facebook Graph API, and runs on a
GitHub Actions cron schedule (Mon/Wed/Fri, with a primary run at 11:00 and a
fallback at 16:00 Vietnam time). Posts that need a real video or real data
(testimonials, milestone numbers) are flagged so they are never auto-published as
placeholder content.

## How it works

- `content/calendar.json` is the single source of truth for the schedule. Each
  entry has a `date`, `pillar`, `format` (`infographic` / `quote_card` / `text` /
  `video` / `photo_text`), a `caption`, and a `status`:
  - `draft` — ready to auto-post.
  - `manual_needed` — needs a real video, must be posted by hand.
  - `needs_review` — needs real data/photo filled in before it can post.
  - `posted` — already published; skipped. Set automatically after a successful
    post (and committed back to `content/calendar.json`), so a delayed or retried
    workflow run the same day never double-posts.
- `src/renderImage.js` renders 1080x1080 PNGs for `infographic` and `quote_card`
  posts using `@napi-rs/canvas`, with fonts bundled in `assets/fonts/` so
  rendering doesn't depend on fonts installed on the CI machine.
- `src/postToFacebook.js` finds today's post (Vietnam time, or `--date` override),
  skips anything `manual_needed`/`needs_review`/`posted` with a log line, calls the
  Graph API (`POST /{page-id}/photos` when there's an image, `POST /{page-id}/feed`
  for plain-text posts), then flips the entry to `posted` in the calendar file.
- `.github/workflows/scheduled-post.yml` runs it on a cron schedule (primary +
  fallback), commits the `posted` status back to the repo, and can also be
  triggered manually with an optional `date` input.

## 1. Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps**
   → **Create App**.
2. Choose the **Business** app type.
3. Since this app only posts to a Facebook Page you personally manage, you do
   **not** need Meta App Review — leaving the app in **Development** mode is
   enough to call the API for your own page.

## 2. Get a long-lived Page Access Token

1. Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/),
   select your app, and add these permissions: `pages_manage_posts`,
   `pages_read_engagement`, `pages_show_list`. Click **Generate Access Token**
   to get a short-lived **user** token.
2. Exchange it for a long-lived user token (find `{app-id}`/`{app-secret}` under
   **App settings → Basic** in the app dashboard):
   ```
   GET https://graph.facebook.com/v26.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &fb_exchange_token={short-lived-user-token}
   ```
3. Use the long-lived user token to get your Page's access token (Page tokens
   obtained this way don't expire):
   ```
   GET https://graph.facebook.com/v26.0/me/accounts?access_token={long-lived-user-token}
   ```
   The response includes each Page you manage with its `id` (this is
   `FB_PAGE_ID`) and its own `access_token` (this is `FB_PAGE_ACCESS_TOKEN`).

   **If this returns an empty `data: []`**, the Page is likely owned by a
   Business Portfolio rather than your personal account, so it won't show up
   under `/me/accounts`. Generate the token again with the extra
   `business_management` permission, then use:
   ```
   GET https://graph.facebook.com/v26.0/me/businesses?access_token={long-lived-user-token}
   GET https://graph.facebook.com/v26.0/{business-id}/owned_pages?fields=id,name,access_token&access_token={long-lived-user-token}
   ```
   (Graph API version numbers bump roughly every 3 months and old ones retire
   after ~2 years — check [developers.facebook.com/docs/graph-api/changelog](https://developers.facebook.com/docs/graph-api/changelog)
   for the current version if these calls start failing.)

## 3. Add GitHub Secrets

In the repo: **Settings → Secrets and variables → Actions → New repository
secret**, and add:

- `FB_PAGE_ID`
- `FB_PAGE_ACCESS_TOKEN`

## 4. Local development

```bash
npm install
cp .env.example .env   # fill in FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN for real posting

# Render + preview a post without calling the Facebook API:
node src/index.js --date 2026-08-31 --dry-run

# Post today's scheduled entry for real (requires .env or exported env vars):
node src/index.js

# Post a specific date for real:
node src/index.js --date 2026-08-31
```

Rendered images are written to `output/` (gitignored).

## 5. Running on GitHub Actions

The workflow runs automatically on the cron schedule — a primary run at 04:00 UTC
(11:00 VN) and a fallback at 09:00 UTC (16:00 VN) on Mon/Wed/Fri. GitHub often
delays scheduled runs by hours, so the schedule is deliberately early: a run that
slips past 17:00 UTC is already the next day in Vietnam time and would find no
post. The fallback covers the primary run being dropped entirely; the first run
to succeed flips the entry to `posted` (committed back to the repo), so the
second run is a no-op.

It can also be triggered manually from the **Actions** tab → **Scheduled Facebook
Post** → **Run workflow**, with an optional **date** input (`YYYY-MM-DD`) to
publish a specific day instead of today. Rendered images are uploaded as a
workflow artifact for inspection.

## 6. Adding next month's calendar

Just edit `content/calendar.json` — no code changes needed. Add new entries with
the same shape as the existing ones, and set `status: "draft"` once the content
is ready to go out automatically.

For the pillars that don't need real data — `educational_hook` (infographic),
`relatable` (quote_card), `engagement` (text) — you can draft the caption with
Claude instead of writing it by hand:

```bash
# slots.json: an array of { "date", "week", "pillar", "format" } — no content yet
node src/generateContent.js --slots slots.json --dry-run   # preview only
node src/generateContent.js --slots slots.json             # appends to content/calendar.json

# Defaults to claude-sonnet-5. Set ANTHROPIC_MODEL in .env to change the
# default, or override for a single run with --model:
node src/generateContent.js --slots slots.json --model claude-opus-5 --dry-run
```

Generated entries always land with `status: "needs_review"` — read them over
for tone/accuracy and flip to `"draft"` yourself before they can auto-post.
Pillars that need real photos/video/data (`feature_demo`, `milestone`,
testimonials, `behind_the_scenes`) aren't supported here — see the README's
`.env.example` for the `ANTHROPIC_API_KEY` this needs.

## Project structure

```
content/calendar.json                  # Single source of truth: 4-week schedule
src/renderImage.js                     # Renders PNGs from text (infographic/quote-card)
src/postToFacebook.js                  # Reads today's post, renders image, calls Graph API
src/index.js                           # CLI entry point (--date, --dry-run)
.github/workflows/scheduled-post.yml   # Cron trigger
assets/fonts/                          # Bundled fonts (no CI machine dependency)
.env.example                           # Env var template — do not commit a real .env
```
