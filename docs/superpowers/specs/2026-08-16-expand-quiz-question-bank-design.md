# Thiết kế mở rộng ngân hàng câu hỏi đố vui

Ngày: 2026-08-16

## Mục tiêu

Mở rộng ngân hàng câu hỏi của trang `do-vui-do-meo.html` từ 48 lên 180 câu, tạo đủ nội dung để trẻ có thể chơi lại nhiều lần mà ít gặp câu trùng. Không thay đổi giao diện, luồng chơi, bộ lọc hay cách tính kết quả hiện tại.

## Phạm vi

Ngân hàng gồm năm chủ đề hiện có:

- Động vật (`dongvat`)
- Thiên nhiên (`tunhien`)
- Toán học (`toanhoc`)
- Đố mẹo (`domeo`)
- Văn hoá (`vanhoa`)

Mỗi chủ đề có 36 câu, được chia đều thành 12 câu cho từng nhóm tuổi:

- 3–5 tuổi (`de`)
- 6–8 tuổi (`vua`)
- 9–12 tuổi (`kho`)

Tổng số sau khi hoàn thành là 5 × 36 = 180 câu.

## Cấu trúc dữ liệu

Giữ nguyên mảng `questions` và định dạng của từng phần tử:

- `tag`: `đố vui` hoặc `đố mẹo`
- `topic`: mã chủ đề hiện có
- `age`: mã nhóm tuổi hiện có
- `q`: nội dung câu hỏi
- `opts`: đúng bốn phương án trả lời
- `correct`: chỉ số từ 0 đến 3 trỏ tới đáp án đúng
- `explain`: lời giải thích ngắn sau khi trả lời

Không tách dữ liệu sang API hoặc hệ quản trị nội dung vì phạm vi hiện tại chỉ cần một trang tĩnh và GitHub Pages.

## Nguyên tắc nội dung

- Dùng tiếng Việt tự nhiên, rõ ràng và phù hợp với trẻ em.
- Độ khó phải đúng nhóm tuổi; câu cho nhóm 3–5 không yêu cầu kiến thức đọc hiểu phức tạp, còn nhóm 9–12 có thể cần suy luận hoặc kiến thức sâu hơn.
- Mỗi câu có duy nhất một đáp án đúng, các phương án nhiễu hợp lý nhưng không gây nhập nhằng.
- Không lặp lại câu hỏi hoặc chỉ đổi cách diễn đạt của cùng một câu.
- Lời giải thích xác nhận đáp án và bổ sung một thông tin ngắn, tích cực.
- Nội dung văn hoá ưu tiên kiến thức Việt Nam phổ biến, tránh nhận định gây tranh cãi hoặc phụ thuộc thời điểm.
- Không sử dụng câu hỏi có nội dung bạo lực, định kiến hoặc không phù hợp với trẻ em.

## Cách triển khai

Bổ sung câu hỏi trực tiếp vào mảng dữ liệu hiện có trong `public/do-vui-do-meo.html`. Câu hỏi được nhóm theo chủ đề và độ tuổi để dễ rà soát, nhưng cơ chế lọc và xáo trộn vẫn sử dụng các trường `topic` và `age` như hiện tại.

Không thay đổi HTML/CSS của giao diện, các hàm điều khiển trò chơi, điều hướng về trang chủ hay cơ chế đăng xuất.

## Kiểm tra dữ liệu

Sau khi bổ sung, thực hiện kiểm tra tự động ở mức dữ liệu để xác nhận:

- Có đúng 180 câu.
- Mỗi chủ đề có đúng 36 câu.
- Mỗi cặp chủ đề/độ tuổi có đúng 12 câu.
- Mỗi câu có bốn đáp án và `correct` nằm trong khoảng hợp lệ.
- Không có nội dung câu hỏi trùng nhau.
- Các trường bắt buộc đều có giá trị.

Không bổ sung bài kiểm thử giao diện vì tính năng và giao diện không thay đổi.

## Tiêu chí hoàn thành

- Bộ lọc “Tất cả” hiển thị 180 câu phù hợp.
- Mọi lựa chọn chủ đề và độ tuổi đều có đúng số câu theo phân bổ trên.
- Người chơi có thể bắt đầu, trả lời và xem giải thích bằng cơ chế hiện tại.
- Bản build tĩnh cho GitHub Pages tiếp tục thành công.
