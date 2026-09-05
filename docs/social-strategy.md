# Chiến lược xây dựng social cho Pomobit — Tình hình & Kế hoạch

_Cập nhật: 2026-09-05 (rev. 3 — confirmed bài đăng qua API không hiện trên wall)_

Tài liệu này chốt lại hiện trạng kênh Facebook của Pomobit, chẩn đoán vì sao
reach đang gần bằng 0, và định hướng đi tiếp. Nguồn dữ liệu: Meta Business Suite,
Graph API (`v26.0`), repo `LinhChh/pomobit-social`.

---

## 1. Hiện trạng

### Facebook Page "Pomobit"
| Chỉ số | Giá trị |
|---|---|
| Followers | **208** (gần như toàn bộ không hoạt động — xem mục 2) |
| Following | 8 |
| Reviews | 0 |
| Category | Software |
| Contact | hello@pomobit.com |
| Bio | "Master your focus with Pomobit! The habit tracker and Pomodoro Timer web app…" |

### Hệ thống đăng bài
- **Automation**: GitHub Actions cron — Thứ 2/4/6 lúc 11:00 và 16:00 giờ VN
  (repo `pomobit-social`). Không có server, không DB.
- **Nguồn nội dung**: `content/calendar.json` — lịch 4 tuần. Format:
  `infographic` / `quote_card` / `text` (đều render PNG 1080×1080),
  `video` / `photo_text` (cần media tay).
- **Đăng qua**: Graph API `POST /{page-id}/photos` (multipart).
- **Lịch sử chạy automation**: mới **4 lần** (28/8, 30/8, 31/8, 2/9). Chỉ 2 bài
  được đánh dấu `posted` trong calendar (31/8, 2/9).
- **Trước đó**: một loạt bài đăng tay 12/2025 → 07/01/2026 (caption dài, nhiều
  hashtag, có geo-tag `#texas #usa`), rồi **khoảng trống 7 tháng** (07/01 → 29/08)
  không đăng gì.

### Số liệu 2 bài gần nhất
| Bài | Ngày | Reach | Views | Viewers | Follows | Interactions |
|---|---|---|---|---|---|---|
| "Your to-do list isn't guilt-tripping you" | 02/09 | 2 | 5 | 2 | 0 | 2 |
| "Multitasking isn't productivity" | 29/08 | 2 | 19 | 2 | 0 | 2 |

### Đã xác minh
- **Graph API**: cả 2 bài tháng 9 `is_published: true`, `is_hidden: false`,
  `privacy: EVERYONE`. Bài đăng đúng, công khai, không bị ẩn — không phải lỗi code.
- **[CONFIRMED 2026-09-05, không còn là giả thuyết]** Bài đăng qua API **không
  hiện trên wall/feed khi xem bằng tài khoản Facebook khác (không phải admin)**
  — chỉ hiện trong tab "Photos", không hiện ở "Posts"/timeline chính. Test bằng
  bài carousel mới nhất (đăng qua `/feed` + `attached_media`, không phải
  `/photos` đơn thuần như trước) — vẫn bị y hệt, nên **không phải do endpoint
  `/photos` vs `/feed`**, cũng không phải do tài khoản admin xem khác tài khoản
  thường. Giả thuyết "cache của New Pages Experience + khoảng trống 7 tháng"
  trước đây (mở permalink trực tiếp thì bài vẫn hiện) có thể chỉ là một phần
  nguyên nhân — bài carousel này đăng **sau khi automation đã chạy đều đặn**
  (không còn khoảng trống 7 tháng), nếu vẫn bị thì nghi ngờ đây là hành vi mặc
  định của New Pages Experience với Page có ít tương tác/follower thật, không
  đơn thuần là cache tạm thời. Cần điều tra thêm — xem mục 6.
- **Page recommendation status: "Recommendable"** — "Your Page is now in lists
  where we suggest Pages to new people." → **Page KHÔNG bị flag**, không có án
  phạt phân phối. Đủ điều kiện được FB gợi ý tới người lạ.

---

## 2. Chẩn đoán: vì sao reach ~2

### Nguyên nhân chính — follower list là fake/chết
- 208 followers thật → reach organic bình thường phải **10–40**/bài.
- Reach = 2 nghĩa là ~206 followers **không bao giờ mở News Feed** → tài khoản mua,
  bot, hoặc follow-for-follow. Củng cố: tài khoản clone (có follow) đóng góp phần
  lớn 32% follower-views, tức follower "thật đang hoạt động" gần như chỉ có nó.
- **Tác hại chủ động (vòng xoáy chết)**: FB test bài mới bằng cách hiển thị cho
  một nhóm nhỏ followers. Nhóm đó toàn tài khoản chết → 0 tương tác → FB kết luận
  "nội dung kém" → cắt phân phối cả với người thật.

### Nguyên nhân phụ
1. **Khoảng trống 7 tháng** (01→08/2026) xoá sạch mọi đà và tín hiệu "page đang hoạt động".
2. **Ảnh tĩnh trên FB Page hầu như không có feed-push tới cold audience.**
   Business Suite cho thấy 68% views đến từ non-follower — nhưng tổng chỉ ~75
   views/tháng, tức ~51 non-follower views (~1,7/ngày). Phần lớn nhiều khả năng là
   **lượt xem từ tài khoản admin** (quản lý Page không tự follow), cộng chút ít từ
   **search / suggested / hashtag** (mấy bài link cũ 12/2025–01/2026 nhồi hashtag).
   Đây là nhiễu, không scale được bằng cách đăng thêm bài. FB **không** chủ động
   đẩy ảnh Page vào feed của người chưa biết Pomobit — đó là việc của Reels.
   _(Tài khoản clone của bạn có follow Page → lượt của nó tính vào 32% follower
   views, không phải non-follower.)_
3. **Không có seeding từ mạng lưới cá nhân** (ràng buộc: không mời được bạn bè
   like Page, không share được vào profile cá nhân).

_Không phải nguyên nhân_: Page **không bị FB flag** — Page recommendation status
là "Recommendable". Reach thấp thuần do 3 lý do trên, không phải án phạt.

---

## 3. Ràng buộc & quyết định đã chốt

| Chủ đề | Trạng thái |
|---|---|
| Mời bạn bè like Page | ❌ Không áp dụng được |
| Share bài vào profile cá nhân | ❌ Không áp dụng được |
| Đăng bài vào Group của người khác | ❌ Cần xin quyền admin group — không làm |
| Xây Group riêng | ✅ Muốn làm, nhưng là **bước 2** (sau khi Page có ~500 follower thật) |
| Thị trường mục tiêu | 🇬🇧 **Cộng đồng nói tiếng Anh trước**, 🇻🇳 Việt Nam sau |
| Ngân sách quảng cáo | ⏳ Chưa quyết |

---

## 4. Định hướng đi tiếp

### Ưu tiên 1 — FB/IG Reels, bản MVP "Ken Burns"
**Lý do**: đây là kênh organic **duy nhất** phát nội dung tới người *chưa follow*
mà không cần audience sẵn hoặc tiền. Ảnh tĩnh thì không.

**MVP = không dựng animation phức tạp.** Lấy card 1080×1920 render 1 lần, thêm
zoom/pan chậm (hiệu ứng Ken Burns) + nhạc CC0, xuất clip 8–12s bằng **một lệnh
ffmpeg** — không có vòng lặp render frame, rủi ro tài nguyên gần như bằng 0.
Thuật toán Reels vẫn coi là video → vẫn được đẩy tới non-follower. Mục tiêu bước
này là **test giả thuyết "Reels reach cold audience tốt hơn ảnh tĩnh"** trước khi
đầu tư thêm.

- **Issue [#17](https://github.com/LinhChh/pomobit-social/issues/17)** — Renderer
  Ken Burns: `ffmpeg -loop 1 -i card.png -i music.mp3 -vf "scale,zoompan" -t 10
  -shortest`. POC local trước → renderer + test clip 2s → `format: "reel"` trong
  `calendar.json`.
- **Issue [#18](https://github.com/LinhChh/pomobit-social/issues/18)** — Publish
  Reels lên Page qua `POST /{page-id}/video_reels` (resumable upload 3 bước).
- **Chạy trên GitHub Actions hiện tại** (ubuntu-latest có sẵn `ffmpeg`). Không
  chuyển hạ tầng ở bước này.
- Nâng cấp animation (`ffmpeg drawtext` text reveal + vòng timer Pomodoro) là
  **Phase 3**, chỉ làm nếu MVP cho tín hiệu tốt.

#### Kế hoạch test — volume & lịch
| | Nội dung | Tần suất | 4 tuần |
|---|---|---|---|
| **Reels (mới)** | Ken Burns trên card, 8–12s | 1/ngày, Thứ 2–6 (5/tuần) | 20 Reels |
| Ảnh tĩnh (giữ nguyên) | `calendar.json` hiện tại | Thứ 2/4/6 | baseline để so sánh |

- Tối thiểu **16 Reels** (Thứ 2/4/6 + Thứ 7 = 4/tuần) mới đủ đọc tín hiệu. Dưới
  ~10 thì chưa kết luận được gì; dưới ~4/tuần thì tài khoản trông inactive.
- Giờ đăng: 1 slot cố định, **không tối ưu giờ trong giai đoạn MVP**.
- **Không boost** trong suốt test.
- **Nút thắt nội dung**: 20 Reels cần ~20 câu ngắn, `calendar.json` mới có ~12.
  Cần batch-generate thêm ~15 one-liner/hook bằng `src/generateContent.js` →
  review → thêm entry `format: "reel"` (`status: draft`). Không lặp lại y nguyên
  1 câu.

#### Timeline
| Giai đoạn | Thời gian (dự kiến) | Việc |
|---|---|---|
| Build #17 + #18 | ~1 tuần (3/9 → ~10/9) | Renderer Ken Burns + đăng Reels |
| Chạy test Reels | ~4 tuần (~10/9 → ~8/10) | Automation tự đăng, gom số liệu |
| Checkpoint sớm | ~tuần 3 (~15 Reels) | Nếu Reels cũng chết 1 chữ số → dừng, pivot |
| Đánh giá gate | ~đầu/giữa 10/2026 | Quyết Phase 3 |

Việc nặng là **upfront** (code + soạn nội dung). Sau đó automation tự chạy, chỉ
vào xem analytics. Ảnh tĩnh M/W/F giữ nguyên — không "test" lại, chúng đã là
baseline (~1–2 non-follower reach).

#### Gate đánh giá
| Kết quả sau ~15–20 Reels | Kết luận |
|---|---|
| Median non-follower views/Reel **> ~30** VÀ ≥1 Reel **> 200 views** | Reels có tác dụng → sang Phase 3 (renderer `drawtext`) |
| Reels cũng kẹt 1 chữ số như ảnh tĩnh | Page bị FB quality-flag → cân nhắc lập Page mới sạch, hoặc pivot TikTok/IG/Pinterest |

Kỳ vọng: Reels ≥ 3–5× non-follower views của ảnh tĩnh.

#### Phương án hạ tầng (nếu CI đụng trần thật)
Không chuyển vội. Nếu MVP Ken Burns chạy xanh trên Actions → ở lại. Nếu đụng trần
tài nguyên khi nâng lên animation → migrate **VPS + crontab** (Hetzner ~$4/tháng,
persistent disk giải quyết luôn writeback `calendar.json`) hoặc **Cloud Run
Jobs**. Render.com cũng được nhưng vẫn phải xử lý writeback + mất `workflow_dispatch`.

### Ưu tiên 2 (pending research) — Pinterest
- Search-driven, pin sống nhiều tháng, reach tốt kể cả khi 0 follower.
- Định dạng card hiện có (quote/infographic) tái sử dụng gần như nguyên vẹn ở tỉ lệ 2:3.
- Cần: Pinterest Business account + API access. **Chưa tạo issue — đang research.**

### Giữ nguyên — automation ảnh tĩnh theo `calendar.json`
- **Vẫn chạy tiếp.** Chi phí ~0, giữ wall "sống" cho người mới ghé, tạo kho nội
  dung để về sau cắt thành Reels/pin.
- **KHÔNG** đánh giá tiến độ qua reach của các bài này (vanity metric giai đoạn này).
- **KHÔNG** boost các bài generic.

### Xử lý follower fake
- **Tuyệt đối không mua thêm follower** dưới mọi hình thức.
- Cân nhắc **remove followers fake thủ công** (Page Settings → Followers → Remove)
  — tedious, hiệu quả không chắc chắn phục hồi hoàn toàn.
- Chấp nhận follower-count không phải chỉ số dùng được lúc này; theo dõi
  **reach & views của Reels** thay thế.

### Group riêng — sau
- Group mới 0 thành viên → không ai tìm thấy. Page phải kéo người vào Group, không
  ngược lại.
- Khởi động khi Page có ~500 follower thật từ Reels/Pinterest, hoặc chạy ads
  "Join group".

---

## 5. Về thị trường tiếng Anh — lưu ý thực tế

- Non-follower views hiện có (68% của ~75/tháng) gần như toàn bộ là lượt xem từ
  tài khoản admin + chút ít search/hashtag, **không phải** tín hiệu tăng trưởng.
  Đừng lấy nó làm cơ sở để "đăng thêm ảnh".
- Niche productivity/Pomodoro trên FB **cạnh tranh rất gắt**, và cộng đồng trẻ
  (target chính của app) không ở FB nhiều — họ ở **TikTok, Instagram, Reddit,
  YouTube Shorts, Pinterest**.
- **Coi FB là surface hiện diện/uy tín, không phải kênh tăng trưởng chính.**
  Dồn công sức "khám phá" (discovery) vào **short-form video + Pinterest**.
- Caption tiếng Anh hiện tại ổn, đúng brand (Pomobit = Pomodoro + habit tracker,
  **không có tính năng streak** — giữ caption chính xác).
- Các bài cũ 12/2025–01/2026 có hashtag spam + geo-tag `#texas #usa` — không lặp lại kiểu đó.

---

## 6. Rủi ro & quyết định còn mở

| Vấn đề | Cần quyết |
|---|---|
| ~~Page bị FB quality-flag?~~ | ✅ **Đã xác minh: KHÔNG.** Page recommendation status = "Recommendable". Bỏ nhánh "lập Page mới" trừ khi Reels test cũng chết bất thường _và_ status đổi |
| **Bài đăng qua API không hiện trên wall khi xem bằng acc không phải admin** | ⚠️ **Confirmed 2026-09-05**, chưa rõ nguyên nhân gốc (không phải endpoint `/photos` vs `/feed`, không phải chỉ do admin session). Cần thử: đăng 1 bài **thủ công qua Meta Business Suite** (không qua API) rồi so sánh cùng cách xem bằng acc khác — nếu vẫn không hiện thì đây là vấn đề của Page (follower chết/reach thấp làm FB không phát tán), không phải vấn đề riêng của việc đăng qua API |
| Prune follower fake hay bỏ qua | Quyết sau khi thử remove ~20 account xem có dễ không |
| Ngân sách ads | Nếu có: $3–5 boost cho **1 Reel đã chứng minh tốt**, target VN/English + productivity, để seed ~30–60 follower thật |
| Nhạc cho video | Chọn 1 track CC0, ghi license trong `assets/audio/` (Issue #17) |
| Nội dung cho 20 Reels | `calendar.json` mới có ~12 entry — cần soạn thêm ~15 câu ngắn trước khi test |
| Pinterest API | Research: business account, quyền API, rate limit |

---

## 7. Next actions

**Trước khi build:**
- [x] Kiểm tra bằng acc Facebook khác (không phải admin) — **confirmed**: bài
      đăng qua API không hiện trên wall/feed, chỉ hiện ở "Photos" (2026-09-05,
      xem mục 1 & 6). Không phải chỉ là cache tạm thời như giả thuyết ban đầu.
- [ ] Đăng thử 1 bài **thủ công qua Meta Business Suite** (không qua API), so
      sánh cùng acc test — xác định đây là vấn đề Page (reach/follower) hay
      vấn đề riêng của đường đăng qua API
- [ ] Soạn ~15 câu one-liner/hook cho Reels → thêm entry `format: "reel"` vào `calendar.json`

**Build (~1 tuần):**
- [ ] **Issue #17** — renderer Ken Burns MVP — `/start-issue 17`
- [ ] **Issue #18** — publish Reels qua Graph API — sau #17
- [ ] Bump lịch cron lên 5 ngày/tuần (Thứ 2–6) cho Reels

**Test (~4 tuần, ~10/9 → ~8/10):**
- [ ] Automation đăng 16–20 Reels, giữ ảnh tĩnh M/W/F làm baseline
- [ ] Không boost
- [ ] Checkpoint tuần 3 (~15 Reels): Reels chết 1 chữ số → dừng, pivot

**Đánh giá (đầu/giữa 10/2026):**
- [ ] Median non-follower views/Reel > ~30 và ≥1 Reel > 200 → Phase 3 (renderer `drawtext`)
- [ ] Không → quyết lập Page mới hay pivot nền tảng

**Song song:**
- [ ] Research Pinterest API → tạo issue nếu khả thi
- [ ] Thử remove 10–20 follower fake, đánh giá độ khả thi
- [ ] Quyết ngân sách ads
