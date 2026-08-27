# Pomobit Social Automation — Implementation Plan (Node.js)

> Đưa file này cho Claude Code để triển khai. Repo riêng, tách biệt hoàn toàn khỏi `pomobit-web`.

## Mục tiêu

Tự động hoá việc đăng bài lên Facebook Page Pomobit theo lịch content 4 tuần đã lên
sẵn: render ảnh (infographic/quote-card), đăng qua Facebook Graph API, chạy tự động
bằng GitHub Actions cron vào Thứ 2 / Thứ 4 / Thứ 6, 19h giờ Việt Nam. Bài dạng video
hoặc cần dữ liệu thật (testimonial, số liệu milestone) phải được flag rõ để không bị
tự đăng nhầm nội dung placeholder.

## Kiến trúc tổng quan

```
content/calendar.json         # Nguồn dữ liệu duy nhất: lịch 4 tuần
src/renderImage.js            # Render ảnh PNG từ text (infographic/quote-card)
src/postToFacebook.js         # Đọc lịch của "hôm nay", render ảnh, gọi Graph API
src/index.js                  # Entry point: parse CLI args (--date, --dry-run), gọi postToFacebook
.github/workflows/scheduled-post.yml  # Cron trigger
assets/fonts/                 # Font bundled sẵn (không phụ thuộc máy CI)
.env.example                  # Mẫu biến môi trường, KHÔNG commit .env thật
README.md                     # Hướng dẫn setup Facebook App + secrets
package.json
```

## Tech stack đề xuất

- **Node.js 20+**, ESM (`"type": "module"` trong package.json)
- Render ảnh: `@napi-rs/canvas` (khuyên dùng — không cần build native toolchain phức
  tạp như `node-canvas`, chạy tốt trên GitHub Actions ubuntu-latest). Alternative:
  `sharp` + SVG template nếu muốn style linh hoạt hơn qua SVG text.
- Gọi Graph API: dùng `fetch` built-in của Node 20+ (không cần thêm package HTTP)
- CLI args: `node:util` `parseArgs` (built-in, không cần thêm dependency như yargs)
- Đọc `.env` khi chạy local: `dotenv` (chỉ dùng lúc dev, GitHub Actions dùng Secrets
  trực tiếp qua `env:` trong workflow, không cần dotenv trong CI)
- Timezone: `Intl.DateTimeFormat` với `timeZone: "Asia/Ho_Chi_Minh"` (built-in, không
  cần thêm package như date-fns-tz nếu chỉ cần lấy ngày hôm nay theo giờ VN)

## Task breakdown

### 1. `content/calendar.json`

Copy nguyên lịch 4 tuần bên dưới (mục "Nội dung lịch 4 tuần"). Mỗi post có:
`date`, `pillar`, `format` (`infographic` | `quote_card` | `text` | `video` |
`photo_text`), `caption`, và tuỳ format: `top_text`+`bottom_text` (infographic)
hoặc `quote_text` (quote_card). Field `status`: `"draft"` (sẵn sàng đăng tự động),
`"manual_needed"` (video, cần quay tay), `"needs_review"` (cần điền số liệu/testimonial
thật trước khi đăng).

### 2. `src/renderImage.js`

Hai hàm chính, canvas vuông 1080x1080 (chuẩn FB feed):

- `renderInfographic({ topText, bottomText, outPath })` — layout 2 khối so sánh,
  có đường kẻ ngang chia đôi, label nhỏ "NOT THE PROBLEM" / "THE REAL ANSWER" phía
  trên mỗi khối, brand name "POMOBIT" ở đầu trang. Nền be ấm (`#f5ede0`), chữ nâu
  đậm (`#3d2914`) cho khối trên, màu accent cam đất (`#c45a3c`) cho khối dưới.
- `renderQuoteCard({ quoteText, outPath })` — quote lớn giữa khung, wrap nhiều dòng
  tự động theo chiều rộng canvas, brand name nhỏ ở đáy.
- Helper wrap text: đo `ctx.measureText(...).width`, tách dòng khi vượt max width
  (canvas 2D context có sẵn `measureText`, không cần thư viện ngoài).
- `renderPostImage(post)` — dispatch theo `post.format`, trả về path ảnh hoặc `null`
  nếu format không cần render (text/video/photo_text).

### 3. `src/postToFacebook.js`

- Đọc `content/calendar.json`, tìm post có `date` khớp hôm nay (theo giờ VN, hoặc
  `--date` override từ CLI).
- Nếu `status` là `manual_needed`/`needs_review` → in cảnh báo, KHÔNG gọi API.
- Nếu có ảnh → `POST https://graph.facebook.com/v21.0/{FB_PAGE_ID}/photos` với
  `multipart/form-data` (field `source` = file ảnh, `caption` = text, `access_token`).
- Nếu không có ảnh (pillar `engagement`, format `text`) →
  `POST https://graph.facebook.com/v21.0/{FB_PAGE_ID}/feed` với `message` + `access_token`.
- `--dry-run`: chỉ render ảnh + log ra, không gọi API thật.

### 4. `.github/workflows/scheduled-post.yml`

```yaml
on:
  schedule:
    - cron: "0 12 * * 1,3,5"   # 12:00 UTC = 19:00 giờ VN, Thứ 2/4/6
  workflow_dispatch: {}         # test thủ công qua nút "Run workflow"
jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: node src/index.js
        env:
          FB_PAGE_ID: ${{ secrets.FB_PAGE_ID }}
          FB_PAGE_ACCESS_TOKEN: ${{ secrets.FB_PAGE_ACCESS_TOKEN }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: rendered-images
          path: output/
          if-no-files-found: ignore
```

### 5. Font

Bundle sẵn 1 font open-source (vd DejaVu Sans, hoặc tải Poppins/Montserrat Bold từ
fonts.google.com) vào `assets/fonts/`, load bằng `GlobalFonts.registerFromPath(...)`
của `@napi-rs/canvas` — không phụ thuộc font cài sẵn trên máy chạy CI.

### 6. README.md — nội dung cần có

- Cách tạo Meta Developer App (developers.facebook.com → My Apps → Create App →
  loại "Business"). Vì là page của chính chủ tài khoản nên **không cần chờ Meta App
  Review** — app ở chế độ Development là đủ để gọi API cho page mình quản lý.
- Cách lấy Page Access Token dài hạn qua Graph API Explorer:
  1. Graph API Explorer → chọn app → thêm quyền `pages_manage_posts`,
     `pages_read_engagement`, `pages_show_list` → Generate Access Token (short-lived).
  2. Exchange sang long-lived: `GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-token}`.
  3. Dùng long-lived user token gọi `GET /me/accounts?access_token={token}` → lấy
     `access_token` của page (không tự hết hạn) + `id` của page.
- Cách add secrets vào GitHub: Settings → Secrets and variables → Actions →
  `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`.
- Lệnh test local: `npm install`, `node src/index.js --date 2026-08-31 --dry-run`.
- Cách thêm lịch tháng sau: sửa `content/calendar.json`, không cần sửa code.

## Nội dung lịch 4 tuần (dán thẳng vào content/calendar.json, đổi format sang cấu trúc JS)

**Tuần 1**
- 2026-08-31 · educational_hook · infographic · top: "MULTITASKING" / bottom: "PRODUCTIVE PROCRASTINATION" · caption: "Multitasking isn't productivity. It's productive procrastination. Your brain can't actually do two focused things at once, it just switches back and forth, paying a tax every time. One task, one timer, one win at a time. That's the whole idea behind Pomobit."
- 2026-09-02 · relatable · quote_card · quote: "Your to-do list isn't guilt-tripping you. It's just badly designed." · caption thêm: "A wall of 30 unsorted tasks isn't a plan, it's anxiety with bullet points. Pomobit breaks it down into sessions you can actually start."
- 2026-09-04 · feature_demo · video · status: manual_needed · caption: "Here's exactly how a Pomobit session works, start to finish."

**Tuần 2**
- 2026-09-07 · educational_hook · infographic · top: "WILLPOWER" / bottom: "YOUR ENVIRONMENT" · caption: "Willpower isn't the problem. Your environment is. You don't need more discipline, you need fewer decisions to make when your focus is already low."
- 2026-09-09 · engagement · text · caption: "What's the ONE habit you've been trying to build for months? Drop it below 👇"
- 2026-09-11 · behind_the_scenes · photo_text · caption: "Why I built Pomobit (and the mistake that taught me the most)." · cần ảnh thật, status: needs_review nếu chưa có ảnh

**Tuần 3**
- 2026-09-14 · educational_hook · infographic · top: "MOTIVATION" / bottom: "THE 2-MINUTE RULE" · caption: "The 2-minute rule that beats motivation every time. Don't wait to feel ready. Commit to 2 minutes."
- 2026-09-16 · relatable · quote_card · quote: "Burnout isn't from working too hard. It's from never truly stopping." · caption thêm: "The break isn't optional, it's part of the work."
- 2026-09-18 · feature_demo · video · status: manual_needed · caption: "That feeling when your habit streak hits a new milestone."

**Tuần 4**
- 2026-09-21 · educational_hook · infographic · top: "YOUR PHONE" / bottom: "ABSENCE OF A PLAN" · caption: "Your focus killer isn't your phone. It's the absence of a plan."
- 2026-09-23 · engagement_or_testimonial · status: needs_review · placeholder: thay bằng testimonial thật nếu có phản hồi tốt từ user outreach, nếu chưa có thì lặp lại format engagement như tuần 2
- 2026-09-25 · milestone · photo_text · status: needs_review · caption: "One month back into building Pomobit's community, here's what we've learned so far." · cần điền số liệu thật trước khi đăng

## Acceptance criteria

- [ ] `node src/index.js --date 2026-08-31 --dry-run` render đúng ảnh infographic, in caption, không gọi API
- [ ] Post `manual_needed`/`needs_review` bị skip kèm cảnh báo rõ ràng, không đăng placeholder
- [ ] Workflow chạy được thủ công qua `workflow_dispatch` trên GitHub Actions
- [ ] Ảnh render ra đúng 1080x1080, đọc được chữ, không bị tràn khung ở caption dài nhất trong lịch
- [ ] README đủ để một người chưa từng tạo Meta Developer App làm theo được từ đầu tới lúc đăng bài thật thành công