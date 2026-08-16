# Thiết kế Cloudflare D1 và quản trị câu hỏi

Ngày: 2026-08-16

## Mục tiêu

Chuyển nguồn dữ liệu chính của trang đố vui từ mảng JavaScript trong HTML sang Cloudflare D1, đồng thời cung cấp trang quản trị để thêm, sửa, ẩn/hiện và xoá câu hỏi. Website chính chạy trên Cloudflare Worker ở gói Free; GitHub Pages và 180 câu hiện có trong HTML được giữ làm phương án dự phòng.

Đây là giai đoạn 1 của nền tảng lưu trữ phía server. Giai đoạn này không triển khai lưu ảnh, tài khoản người dùng hoặc lịch sử chơi.

## Kiến trúc triển khai

- GitHub tiếp tục là nơi lưu mã nguồn.
- Cloudflare Worker phục vụ static assets, API và trang quản trị trên cùng origin `*.workers.dev`.
- Cloudflare D1 lưu dữ liệu câu hỏi và dữ liệu giới hạn đăng nhập quản trị.
- Drizzle quản lý schema, migration và truy vấn database.
- GitHub Pages tiếp tục được deploy như hiện tại và tự dùng dữ liệu HTML dự phòng vì không có API server.
- Không dùng CORS cho website chính vì frontend và API cùng origin.

Cloudflare D1 được Worker truy cập qua binding `DB`, theo mô hình chính thức tại https://developers.cloudflare.com/d1/get-started/.

## Schema D1

### Bảng `questions`

- `id`: integer, primary key, tự tăng.
- `topic`: text, bắt buộc; một trong `dongvat`, `tunhien`, `toanhoc`, `domeo`, `vanhoa`.
- `age`: text, bắt buộc; một trong `de`, `vua`, `kho`.
- `tag`: text, bắt buộc; `đố vui` hoặc `đố mẹo`.
- `question_text`: text, bắt buộc và duy nhất sau khi chuẩn hoá khoảng trắng.
- `option_a`, `option_b`, `option_c`, `option_d`: text, bắt buộc.
- `correct_index`: integer, bắt buộc; từ 0 đến 3.
- `explanation`: text, bắt buộc.
- `is_active`: integer boolean, mặc định 1.
- `created_at`: integer Unix timestamp, bắt buộc.
- `updated_at`: integer Unix timestamp, bắt buộc.

Tạo index cho `is_active`, `(topic, age, is_active)` và unique index cho nội dung câu hỏi đã chuẩn hoá. Việc chuẩn hoá dùng một cột `normalized_question` được tính trong application trước khi ghi.

### Bảng `admin_login_attempts`

- `client_key`: text primary key; SHA-256 của địa chỉ IP kết hợp với secret salt.
- `failed_count`: integer.
- `window_started_at`: integer Unix timestamp.
- `blocked_until`: integer Unix timestamp hoặc null.

Dữ liệu cũ hơn 24 giờ được xoá trong các lần đăng nhập tiếp theo, không cần cron job ở giai đoạn 1.

## API công khai

### `GET /api/questions`

- Chỉ trả câu có `is_active = 1`.
- Response có `id`, `topic`, `age`, `tag`, `q`, `opts`, `correct` và `explain`, tương thích với cấu trúc trang hiện tại.
- Response dùng `Cache-Control: public, max-age=60, s-maxage=300`.
- Worker Cache API lưu response tối đa 5 phút.
- Mỗi thao tác thêm, sửa, ẩn/hiện hoặc xoá câu hỏi sẽ xoá cache API.

Không thêm API công khai để ghi dữ liệu.

## API quản trị

- `POST /api/admin/login`: kiểm tra mật khẩu và tạo phiên.
- `POST /api/admin/logout`: xoá cookie phiên.
- `GET /api/admin/questions`: danh sách tất cả câu hỏi, gồm cả câu bị ẩn.
- `POST /api/admin/questions`: thêm câu hỏi.
- `PUT /api/admin/questions/:id`: cập nhật toàn bộ câu hỏi.
- `PATCH /api/admin/questions/:id/status`: ẩn hoặc xuất bản câu hỏi.
- `DELETE /api/admin/questions/:id`: xoá câu hỏi sau bước xác nhận trên giao diện.

Mọi API ghi dữ liệu kiểm tra phiên quản trị, header `Origin` cùng origin, kiểu dữ liệu, enum, bốn đáp án, `correct_index` và nội dung trùng.

## Xác thực quản trị

- Một tài khoản quản trị dùng chung trong giai đoạn 1.
- Cloudflare Secrets lưu `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`, `ADMIN_SESSION_SECRET` và `LOGIN_ATTEMPT_SALT`.
- Mật khẩu được kiểm tra bằng PBKDF2-SHA-256 qua Web Crypto; không lưu mật khẩu thuần trong code, Git hoặc D1.
- Phiên là token có thời hạn được ký HMAC-SHA-256, lưu trong cookie `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, hết hạn sau 8 giờ.
- Sau 5 lần sai trong 15 phút, `client_key` bị khoá 15 phút.
- Response đăng nhập sai luôn dùng thông báo chung, không tiết lộ nguyên nhân chi tiết.

## Trang quản trị

Trang `/admin` gồm:

- Form đăng nhập và nút đăng xuất.
- Bảng danh sách có tìm kiếm, lọc chủ đề, độ tuổi và trạng thái.
- Form thêm/sửa có đầy đủ nội dung, bốn đáp án, đáp án đúng và lời giải thích.
- Nút ẩn/hiện và xoá; xoá yêu cầu xác nhận.
- Hiển thị lỗi validation ngay tại form và thông báo kết quả thao tác.
- Không đưa secret hoặc thông tin D1 vào JavaScript phía trình duyệt.

## Luồng tải câu hỏi và fallback

1. Trang đố vui hiển thị trạng thái đang tải và gọi `GET /api/questions` với timeout 5 giây.
2. Chấp nhận dữ liệu API khi response thành công, mảng không rỗng và mọi phần tử có cấu trúc hợp lệ.
3. Nếu request timeout, lỗi mạng, HTTP lỗi, response rỗng hoặc dữ liệu sai cấu trúc, dùng 180 câu trong HTML.
4. Khi dùng fallback, hiển thị nhãn nhỏ `Đang dùng dữ liệu dự phòng` và cho phép người dùng chơi bình thường.
5. Dữ liệu fallback giữ nguyên 180 câu ban đầu; thay đổi qua trang quản trị không tự đồng bộ vào HTML.

## Migration dữ liệu

- Migration đầu tiên tạo hai bảng và các index.
- Seed chuyển đúng 180 câu hiện có từ HTML vào `questions`.
- Seed có thể chạy lặp lại an toàn dựa trên `normalized_question` và không tạo bản ghi trùng.
- Sau khi seed, đối chiếu tổng số 180 và phân bổ 36 câu cho mỗi chủ đề, 12 câu cho mỗi cặp chủ đề/độ tuổi.
- Mảng 180 câu trong HTML được đổi tên thành dữ liệu fallback nhưng không bị xoá.

## Phát hành và chuyển đổi

1. Tạo D1 trên Cloudflare Free và gắn binding `DB`.
2. Cấu hình bốn Cloudflare Secrets.
3. Chạy migration và seed trên D1 production.
4. Deploy Worker cùng static assets lên `*.workers.dev`.
5. Rà soát API đọc, đăng nhập quản trị, CRUD, cache invalidation và fallback.
6. Bàn giao URL Cloudflare làm địa chỉ chính.
7. Giữ workflow GitHub Pages hiện tại làm bản dự phòng.

Không cần mua tên miền. Theo bảng giá hiện tại, Workers Free có 100.000 request/ngày; D1 Free có 5 triệu dòng đọc/ngày, 100.000 dòng ghi/ngày và 5 GB lưu trữ. Tham khảo https://developers.cloudflare.com/workers/platform/pricing/ và https://developers.cloudflare.com/d1/platform/pricing/.

## Xử lý lỗi

- API công khai lỗi: trả response JSON có mã lỗi; frontend chuyển sang fallback.
- D1 trả rỗng: frontend xem là lỗi dữ liệu và chuyển sang fallback.
- API quản trị lỗi validation: HTTP 400 với lỗi theo trường.
- Chưa đăng nhập hoặc phiên hết hạn: HTTP 401 và giao diện quay về form đăng nhập.
- Sai origin: HTTP 403.
- Trùng nội dung: HTTP 409.
- Không tìm thấy câu hỏi: HTTP 404.
- Lỗi D1 hoặc lỗi ngoài dự kiến: HTTP 500 với thông báo chung; chi tiết chỉ ghi trong Worker logs.

## Giới hạn giai đoạn 1

Chưa triển khai:

- Cloudflare R2 và upload ảnh.
- Bảng media hoặc metadata ảnh.
- Tài khoản người dùng.
- Đồng bộ người dùng giữa thiết bị.
- Lịch sử chơi, điểm số hoặc tiến độ phía server.
- Đồng bộ tự động dữ liệu fallback trong HTML.

Các phần này sẽ có đặc tả và migration riêng ở giai đoạn sau.

## Rà soát trước khi bàn giao

Không bổ sung test tự động theo yêu cầu. Thực hiện rà soát schema, migration, seed, API, xác thực, CRUD, fallback, build local và deploy Cloudflare trước khi bàn giao.

## Tiêu chí hoàn thành

- Cloudflare URL tải trang chủ và trang đố vui thành công.
- Trang đố vui dùng dữ liệu D1 khi API hoạt động.
- Trang đố vui dùng đủ 180 câu HTML khi API thất bại.
- Quản trị viên đăng nhập và thực hiện được thêm, sửa, ẩn/hiện, xoá.
- Thay đổi dữ liệu xuất hiện trong API công khai sau khi cache bị xoá.
- Không có secret trong Git hoặc bundle trình duyệt.
- GitHub Pages tiếp tục hoạt động với dữ liệu fallback.
