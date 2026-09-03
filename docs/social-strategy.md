# Chiến lược xây dựng social cho Pomobit — Tình hình & Kế hoạch

_Cập nhật: 2026-09-03_

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

### Đã xác minh qua Graph API
- Cả 2 bài tháng 9: `is_published: true`, `is_hidden: false`, `privacy: EVERYONE`.
  **Bài đăng đúng, công khai, không bị ẩn — không phải lỗi code.**
- Việc không thấy bài trong tab "Posts" (kể cả tài khoản admin) là do
  **cache của New Pages Experience** + khoảng trống 7 tháng làm feed module kẹt
  anchor. Grid "Photos" update nhanh hơn nên chỉ thấy ảnh. Mở permalink trực tiếp
  thì bài hiện bình thường.

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
4. Page 8 tháng tuổi + 0 review + 200+ follower fake = hồ sơ dễ bị FB gắn nhãn
   "low quality".

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

### Ưu tiên 1 — FB/IG Reels (video dọc)
**Lý do**: đây là kênh organic **duy nhất** phát nội dung tới người *chưa follow*
mà không cần audience sẵn hoặc tiền. Ảnh tĩnh thì không.

- **Issue [#17](https://github.com/LinhChh/pomobit-social/issues/17)** — Render
  video dọc 1080×1920 từ nội dung card (`@napi-rs/canvas` → `ffmpeg` qua
  `ffmpeg-static`), text reveal từng dòng + vòng timer Pomodoro + nhạc
  royalty-free bundle sẵn.
- **Issue [#18](https://github.com/LinhChh/pomobit-social/issues/18)** — Publish
  Reels lên Page qua `POST /{page-id}/video_reels` (resumable upload 3 bước).
- **Nhịp mục tiêu**: 1 Reel/ngày sau khi renderer xong. Kỳ vọng: sau 10–20 Reels
  có 1–2 cái đạt vài trăm view.

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
| Page hiện tại có bị FB quality-flag không | Theo dõi reach Reels 2–3 tuần đầu; nếu Reels cũng chết bất thường → cân nhắc lập Page mới sạch |
| Prune follower fake hay bỏ qua | Quyết sau khi thử remove ~20 account xem có dễ không |
| Ngân sách ads | Nếu có: $3–5 boost cho **1 Reel đã chứng minh tốt**, target VN/English + productivity, để seed ~30–60 follower thật |
| Nhạc cho video | Chọn 1 track CC0, ghi license trong `assets/audio/` (Issue #17) |
| Pinterest API | Research: business account, quyền API, rate limit |

---

## 7. Next actions

- [ ] Làm **Issue #17** (renderer video) — `/start-issue 17`
- [ ] Làm **Issue #18** (publish Reels) — sau #17
- [ ] Kiểm tra tab "Posts" bằng incognito/mobile để xác nhận chỉ là cache
- [ ] Thử remove 10–20 follower fake, đánh giá độ khả thi
- [ ] Research Pinterest API → tạo issue nếu khả thi
- [ ] Sau 3 tuần chạy Reels: review reach/views, quyết định có giữ Page này hay lập mới
- [ ] Quyết ngân sách ads
