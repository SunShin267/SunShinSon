# Thiết kế tooltip cho thanh trạng thái đố vui

Ngày: 2026-08-16

## Mục tiêu

Khi người dùng rê chuột vào một nốt trên thanh trạng thái của trò chơi đố vui, hiển thị số thứ tự câu hỏi và trạng thái của câu đó. Không thay đổi kích thước, vị trí hoặc cách tương tác hiện có của thanh trạng thái.

## Nội dung tooltip

Mỗi nốt luôn có tooltip theo một trong các định dạng:

- `Câu N — Đúng`
- `Câu N — Sai`
- `Câu N — Hiện tại`
- `Câu N — Chưa trả lời`

Nếu một câu vừa là câu đang xem vừa đã có kết quả trong chế độ xem lại, ưu tiên hiển thị trạng thái `Đúng` hoặc `Sai` vì đây là thông tin cụ thể hơn.

## Cách triển khai

- Hàm `buildProgress()` xác định nội dung tooltip từ chỉ số câu, `results`, `current` và `viewState`.
- Nội dung được gắn vào thuộc tính `data-tooltip` và `aria-label` của từng nốt.
- CSS dùng pseudo-element `::after` để hiển thị tooltip ngay phía trên nốt khi hover hoặc focus.
- Tooltip có nền tối, chữ trắng, kích thước nhỏ và không bắt sự kiện chuột.
- Nốt đã trả lời tiếp tục có class `clickable` và click để mở lại câu hỏi như hiện tại.
- Không đổi dữ liệu câu hỏi, cách tính điểm hoặc các màn hình khác.

## Khả năng sử dụng

- Tooltip không che khuất chính nốt đang được trỏ tới.
- Tooltip nằm trên các nốt khác bằng `z-index` và không làm thay đổi bố cục.
- `aria-label` cung cấp cùng nội dung cho công nghệ hỗ trợ.
- Các nốt đã trả lời có thể nhận focus để người dùng bàn phím đọc nhãn và kích hoạt xem lại.

## Rà soát trước khi phát hành

Không bổ sung test theo yêu cầu. Chỉ rà soát mã nguồn, chạy build local và build GitHub Pages trước khi phát hành.

## Tiêu chí hoàn thành

- Rê chuột vào mọi nốt đều thấy đúng số câu và trạng thái.
- Các trạng thái đúng, sai, hiện tại và chưa trả lời hiển thị đúng theo dữ liệu trò chơi.
- Click vào nốt đã trả lời vẫn mở chế độ xem lại.
- Thanh trạng thái không thay đổi bố cục.
- Build local và GitHub Pages hoàn tất thành công.
