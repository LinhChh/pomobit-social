# Pomobit Social — Claude Code Instructions

## Project
Node.js 20+, ESM (`"type": "module"`), plain JavaScript. CLI script that renders
post images (`@napi-rs/canvas`) and posts them to a Facebook Page via the Graph
API. Runs on a GitHub Actions cron schedule — there is no Express/HTTP server and
no database (Supabase or otherwise); `content/calendar.json` is the only data store.
GitHub repo: `LinhChh/pomobit-social`

## Test setup
- Runner: Node's built-in `node:test` (no extra dependency needed for a project
  this size)
- Command: `npm test` (run once), `npm run test:watch` (dev loop)
- Convention: `src/foo.js` → `test/foo.test.js`
- Run a single file: `node --test test/foo.test.js`

## TDD workflow
Tickets được quản lý trên GitHub Issues tại `LinhChh/pomobit-social`.

**Khi tạo issue mới (nhờ Claude):**
Mô tả yêu cầu bằng tiếng Việt hoặc tiếng Anh, Claude sẽ:
1. Soạn title, summary, behavior checklist, và notes
2. Hỏi xác nhận trước khi tạo
3. Chạy `gh issue create --repo LinhChh/pomobit-social --title "..." --body "..."` để tạo issue
4. Trả về link issue vừa tạo

Title không bắt buộc prefix `feat:`/`fix:`/`chore:` (các issue hiện có trong repo
này không dùng prefix) — có thể thêm nếu muốn nhất quán với `pomobit-api`, nhưng
không bắt buộc.

Template Claude dùng:
```
## Summary
<mô tả tính năng / bug>

## Behavior
- [ ] <test case — mỗi bullet sẽ thành 1 it('...') trong node:test>

## Notes
<ghi chú kỹ thuật nếu có>
```

**Ví dụ:**
> User: "Tạo issue cho việc bỏ qua post đã đăng rồi khi chạy lại workflow cùng ngày"

Claude sẽ soạn và tạo:
```
Title: Skip re-posting when a post already went out today

## Summary
Nếu workflow bị trigger 2 lần trong cùng 1 ngày (vd retry thủ công), không được
đăng trùng bài lên Facebook Page.

## Behavior
- [ ] Nếu đã có log/marker cho thấy post của ngày hôm nay đã đăng thành công, bỏ qua và log cảnh báo
- [ ] Nếu chưa đăng, chạy như bình thường

## Notes
Cần quyết định nơi lưu marker (file trong output/, hoặc check qua Graph API).
```

**Khi bắt đầu task mới:**
1. Đọc issue bằng lệnh: `gh issue view <NUMBER>`
2. Tạo branch mới từ `develop`: `git checkout develop && git pull && git checkout -b feature/<NUMBER>-<short-desc>`
   (ví dụ: `feature/12-skip-duplicate-post`)
3. Map từng bullet trong **Behavior** thành `it('...')` test cases (dùng `test()`/`describe()` của `node:test`)
4. Chạy `npm run test:watch` → xác nhận red
5. Implement code tối thiểu để pass
6. Chạy `npm test` → xác nhận không có regression
7. Commit và push branch lên remote
8. Tạo PR bằng `gh pr create --base develop --title "<title>" --body "..."`
   - PR body link tới issue bằng `Refs #<NUMBER>` (KHÔNG dùng `Closes/Fixes` để issue không tự đóng khi merge)
9. Comment tóm tắt các thay đổi lên issue/PR bằng `gh issue comment <NUMBER> --body "..."`
10. **KHÔNG tự động close issue** — user sẽ manual trigger việc close khi đã manual test xong

**Lệnh hay dùng:**
```bash
gh issue list                    # xem issues đang mở
gh issue view <NUMBER>           # đọc ticket
gh pr create --base develop ...  # tạo PR
gh issue comment <NUMBER> --body "" # comment thay đổi lên issue
gh issue close <NUMBER>          # CHỈ chạy khi user yêu cầu close
node --test test/renderImage.test.js  # chạy 1 file test
node src/index.js --date 2026-08-31 --dry-run  # xem thử 1 post mà không gọi API thật
```

## Mocking conventions
- **Facebook Graph API (`fetch`)**: mock native `fetch` trực tiếp, không cần thư
  viện ngoài (Node 20+ có `fetch` built-in nên `jest-fetch-mock`/`nock` là không
  cần thiết). Ví dụ:
  ```js
  import { mock } from "node:test";

  mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ id: "123456789" }),
  }));
  ```
  Nhớ `mock.reset()` (hoặc gọi trong `afterEach`) để không rò rỉ mock giữa các test.
- **Filesystem (render ảnh)**: các test cho `renderImage.js` nên render ra một
  thư mục tạm (vd `node:fs/promises.mkdtemp`) thay vì `output/` thật, và assert
  trên việc file tồn tại + kích thước > 0, không cần so khớp pixel-by-pixel.
- **Ngày giờ (`getTodayVN`)**: các hàm phụ thuộc "hôm nay" (như
  `runScheduledPost`) nhận `date` qua tham số/CLI override thay vì đọc `Date.now()`
  trực tiếp trong logic nghiệp vụ — test bằng cách truyền `date` cố định, không
  cần mock `Date`.

## Key architectural notes
- **`content/calendar.json` là single source of truth** cho lịch đăng bài. Mỗi
  entry có `date`, `pillar`, `format` (`infographic` | `quote_card` | `text` |
  `video` | `photo_text`), `caption`, và `status`.
- **`status`**: `"draft"` (sẵn sàng đăng tự động) | `"manual_needed"` (cần quay
  video, đăng tay) | `"needs_review"` (cần điền số liệu/ảnh thật trước khi đăng).
  **Không bao giờ tự đăng nội dung placeholder** — `manual_needed`/`needs_review`
  luôn bị skip kèm cảnh báo (`src/postToFacebook.js`).
- **Timezone**: mọi logic "hôm nay" dùng giờ Việt Nam (`Asia/Ho_Chi_Minh`) qua
  `Intl.DateTimeFormat`, không dùng `Date` theo giờ máy chạy (GitHub Actions chạy
  UTC).
- **Ảnh** luôn render 1080x1080 PNG (chuẩn FB feed) bằng `@napi-rs/canvas`, font
  bundle sẵn trong `assets/fonts/` để không phụ thuộc font cài trên máy CI.
- **Gọi Graph API** bằng `fetch` built-in, không thêm HTTP client. Có ảnh → `POST
  /{page-id}/photos` (multipart); không ảnh → `POST /{page-id}/feed`.
- **Graph API version** hiện tại: `v26.0` (hardcode trong
  `src/postToFacebook.js`), bump định kỳ theo changelog của Meta khi version cũ
  bị retire.
