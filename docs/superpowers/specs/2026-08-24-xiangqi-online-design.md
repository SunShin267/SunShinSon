# Thiết kế trò chơi Cờ tướng

Ngày: 2026-08-24  
Trạng thái: Đã thống nhất trong trao đổi, chờ duyệt đặc tả

## 1. Mục tiêu

Thêm trò chơi Cờ tướng vào SunShinSon với hai biến thể:

- **Cờ sáng** theo luật cờ tướng tiêu chuẩn.
- **Cờ úp** theo luật phổ biến tại Việt Nam.

Mỗi biến thể có hai chế độ:

- Chơi với máy.
- Chơi online với một người khác.

Trong chế độ online, người chơi có thể tạo link mời hoặc mời một người đang online. Người mở link nhưng chưa có phiên sẽ chỉ cần nhập tên, không cần tài khoản hoặc mật khẩu.

## 2. Phạm vi phiên bản đầu

Phiên bản đầu bao gồm:

- Trang Cờ tướng mới tại `/co-tuong` và một thẻ Cờ tướng trên trang chủ.
- Cờ sáng và Cờ úp.
- AI ba mức Dễ, Vừa và Khó; mặc định Vừa.
- Online bằng link mời hoặc lời mời trực tiếp từ danh sách hiện diện.
- Đồng hồ 5, 10 hoặc 15 phút mỗi bên; mặc định 10 phút; không cộng giây sau nước đi.
- Xin hòa, chấp nhận hoặc từ chối hòa, đầu hàng và chơi lại.
- Khôi phục ván online sau khi tải lại trang hoặc mất mạng ngắn.
- Giao diện đáp ứng trên điện thoại và máy tính.

Không thuộc phiên bản đầu:

- Tài khoản và mật khẩu.
- Chơi hai người trên cùng một thiết bị.
- Xếp hạng, Elo, giải đấu, khán giả hoặc chat.
- Đồng hồ có cộng giây sau mỗi nước đi.
- Thông báo đẩy khi người chơi không mở trang.

## 3. Trải nghiệm người chơi

### 3.1 Vào trang Cờ tướng

Trang chủ có thêm hoạt động **Chơi cờ tướng**. Người đã nhập tên ở SunShinSon dùng lại tên đó. Người chưa có tên và truy cập `/co-tuong` theo cách thông thường quay về luồng nhập tên hiện có.

Trang `/co-tuong` cho người chơi chọn theo thứ tự:

1. Cờ sáng hoặc Cờ úp.
2. Chơi với máy hoặc Chơi online.
3. Các tùy chọn của chế độ đã chọn.

### 3.2 Chơi với máy

Người chơi chọn:

- Bên Đỏ hoặc Đen.
- Độ khó Dễ, Vừa hoặc Khó.
- Đồng hồ 5, 10 hoặc 15 phút; mặc định 10 phút.

Khi ván bắt đầu, bên Đỏ đi trước. Ván có thể kết thúc do chiếu bí, hết nước hợp lệ, hết giờ hoặc người chơi đầu hàng.

### 3.3 Sảnh online

Sau khi chọn loại cờ và thời gian, người chơi có hai cách tìm đối thủ:

- **Mời bằng link:** tạo một phòng đang chờ và sao chép link có mã phòng ngắn.
- **Mời người online:** chọn một người có trạng thái Rảnh và gửi lời mời kèm loại cờ, thời gian.

Phòng chờ bằng link hết hạn sau 10 phút. Lời mời trực tiếp hết hạn sau 2 phút. Khi ghép trận thành công, máy chủ xáo ngẫu nhiên người cầm Đỏ và Đen. Hai client gửi trạng thái Sẵn sàng sau khi tải xong bàn; đồng hồ chỉ bắt đầu khi cả hai đã sẵn sàng.

Danh sách hiện diện hiển thị tên và một trong ba trạng thái:

- **Rảnh:** đang ở sảnh và có thể nhận lời mời.
- **Đang chờ:** đã tạo phòng và đang chờ đối thủ.
- **Đang chơi:** đã ở trong một ván.

Người nhận lời mời trực tiếp có thể chấp nhận hoặc từ chối. Khi chấp nhận, cả hai được đưa vào cùng một ván. Một người chỉ có thể giữ một phòng chờ hoặc một ván đang diễn ra tại một thời điểm.

### 3.4 Link mời và nhập tên

Link mời mở trang phòng, ví dụ `/co-tuong/phong/ABCD12`.

Nếu thiết bị chưa có tên, ứng dụng hiển thị trang đăng nhập dành cho Cờ tướng với một ô tên và không có mật khẩu. Sau khi nhập tên thành công, người chơi trở lại đúng phòng đã mở.

Nếu link không tồn tại, đã hết hạn, chủ phòng đã hủy hoặc phòng đã đủ người, trang hiển thị nguyên nhân và một hành động quay về sảnh.

### 3.5 Bàn cờ

Bàn cờ là nội dung chính. Giao diện hiển thị:

- Tên, màu quân, trạng thái kết nối và đồng hồ của hai người.
- Ô đang chọn, các đích hợp lệ, nước vừa đi và Tướng đang bị chiếu.
- Lịch sử nước đi.
- Các nút Xin hòa và Đầu hàng.
- Thông báo lượt đi và kết quả.

Trên máy tính, bảng thông tin và lịch sử nằm bên phải bàn cờ. Trên điện thoại, các phần này xếp dưới bàn cờ. Quân úp có mặt lưng riêng và một chuyển động lật ngắn khi được mở.

## 4. Luật chơi

### 4.1 Cờ sáng

Engine luật phải thực thi:

- Cách đi và bắt quân của Tướng, Sĩ, Tượng, Xe, Pháo, Mã và Tốt.
- Giới hạn cung đối với Tướng và Sĩ.
- Giới hạn qua sông đối với Tượng; thay đổi cách đi của Tốt sau khi qua sông.
- Luật cản chân Mã, cản mắt Tượng và quân ngòi của Pháo.
- Hai Tướng không được đối mặt trên cùng một cột không có quân chắn.
- Không được thực hiện nước khiến Tướng của mình bị chiếu.
- Chiếu, chiếu bí và hết nước hợp lệ. Trong cờ tướng, bên không còn nước hợp lệ thua.

Ván kết thúc do chiếu bí, hết nước hợp lệ, hết giờ, đầu hàng hoặc hòa do hai bên đồng ý. Lặp lại cùng một trạng thái bàn cờ ba lần kết thúc hòa trong phiên bản đầu nhằm ngăn ván lặp vô hạn.

### 4.2 Cờ úp

Thiết lập ban đầu:

- Tướng của mỗi bên để ngửa tại vị trí chuẩn.
- Mười lăm quân còn lại của mỗi bên được xáo ngẫu nhiên và úp trên 15 vị trí xuất phát còn lại của bên đó.
- Việc xáo dùng seed do máy chủ tạo cho ván online và seed cục bộ cho ván với máy. Seed được lưu cùng ván để có thể khôi phục và kiểm thử.

Luật quân úp:

- Khi chưa lật, quân đi theo loại quân của **vị trí đang che**. Ví dụ quân úp ở vị trí Xe được đi như Xe trong nước đầu tiên.
- Sau khi hoàn tất nước đi hợp lệ đầu tiên, quân lật để lộ danh tính thật.
- Từ nước tiếp theo, quân đi theo danh tính thật.
- Sĩ đã lật được phép rời cung.
- Tượng đã lật được phép qua sông nhưng vẫn đi chéo hai ô và vẫn chịu luật cản mắt Tượng.
- Các quy tắc bảo vệ Tướng, hai Tướng đối mặt, chiếu, chiếu bí và kết thúc ván vẫn áp dụng.

Máy chủ lưu danh tính thật của quân chưa lật. Phản hồi gửi đến trình duyệt phải che trường danh tính đó cho đến khi quân được lật.

## 5. AI

Engine AI chạy trong Web Worker để không làm đứng giao diện. Cả Cờ sáng và Cờ úp dùng chung biểu diễn bàn cờ và trình sinh nước hợp lệ.

### 5.1 Cờ sáng

AI dùng tìm kiếm minimax với alpha-beta, sắp xếp nước đi và hàm lượng giá dựa trên giá trị quân, vị trí, độ linh hoạt, an toàn của Tướng và đe dọa bắt quân.

Ba mức độ khác nhau bằng giới hạn độ sâu, thời gian suy nghĩ và một lượng ngẫu nhiên có kiểm soát ở mức Dễ. Mỗi lần tìm kiếm có thể bị hủy khi người chơi rời ván hoặc bắt đầu ván mới.

### 5.2 Cờ úp

AI chỉ được nhận trạng thái đã che giống như người chơi. Nó không được đọc mapping quân úp thật khi chấm điểm hoặc chọn nước.

AI định giá quân chưa lật bằng phân phối các quân còn chưa được nhìn thấy và cập nhật phân phối khi có quân lật. Mức Khó lấy mẫu tối đa 16 cách phân bố hợp lệ để so sánh nước đi; mức Dễ và Vừa dùng kỳ vọng xác suất đơn giản hơn. Sau khi AI chọn xong một nước hợp lệ, lớp game mới dùng mapping kín để lật quân nếu cần.

## 6. Kiến trúc ứng dụng

### 6.1 Các khối chính

Mã được chia thành các khối có trách nhiệm rõ ràng:

- **Engine luật thuần TypeScript:** mô hình bàn cờ, sinh nước, kiểm tra chiếu, áp dụng nước, serialize và hydrate. Không phụ thuộc React hoặc API.
- **Engine AI:** đánh giá và tìm kiếm nước trong Web Worker, chỉ gọi API công khai của engine luật.
- **Giao diện trò chơi:** màn chọn chế độ, sảnh online, bàn cờ, đồng hồ, lịch sử và các hộp thoại.
- **Client online:** đăng nhập tên, heartbeat hiện diện, polling sảnh/ván, gửi lệnh và xử lý đồng bộ lại.
- **API Cờ tướng:** xác thực phiên, xử lý hiện diện, lời mời, phòng, lệnh trong ván và trạng thái ván.
- **Kho D1:** lưu phiên, hiện diện, lời mời, phòng, ván, nước đi và kết quả.

Engine luật là nguồn chân lý dùng chung. Chế độ máy gọi engine ngay trong trình duyệt; chế độ online gửi lệnh tới máy chủ và máy chủ dùng cùng engine để kiểm tra lại.

### 6.2 Phiên ẩn danh

Khi người chơi nhập tên cho Cờ tướng, máy chủ tạo một ID phiên ngẫu nhiên và đặt cookie HttpOnly, Secure, SameSite=Lax. Tên hiển thị được liên kết với ID phiên. Cookie, không phải tên, xác định người chơi.

Người đã có tên cục bộ của SunShinSon có thể bắt đầu bằng tên đó, nhưng API vẫn cấp phiên máy chủ ở lần dùng online đầu tiên. Hai người có cùng tên vẫn là hai phiên riêng biệt.

### 6.3 Đồng bộ bằng D1 và polling

Phiên bản đầu dùng D1 và HTTP polling, không dùng dịch vụ realtime bên ngoài.

- Sảnh gửi heartbeat và tải danh sách hiện diện khoảng 3 giây một lần.
- Bàn chơi tải snapshot mới khoảng 1 giây một lần.
- Khi tab được đưa lại về foreground, client đồng bộ ngay, không chờ chu kỳ kế tiếp.
- API trả `ETag` từ revision và phản hồi `304 Not Modified` khi snapshot không đổi.

Mỗi ván có revision tăng dần. Lệnh thay đổi trạng thái phải kèm revision client đang có. Máy chủ kiểm tra phiên, quyền của người chơi, lượt đi, luật cờ và revision trước khi ghi. Lệnh cũ hoặc trùng trả về snapshot mới nhất để client tự đồng bộ lại.

### 6.4 Đồng hồ

Máy chủ là nguồn chân lý cho đồng hồ online. Trạng thái lưu số mili giây còn lại của mỗi bên, bên đang chạy và thời điểm máy chủ bắt đầu khoảng hiện tại.

Khi xử lý một lệnh hoặc trả snapshot, máy chủ tính phần thời gian đã trôi qua từ timestamp, cập nhật đồng hồ và kết thúc ván nếu một bên hết giờ. Polling chỉ giúp hiển thị và phát hiện kết quả nhanh hơn; việc làm chậm hoặc sửa đồng hồ ở client không thay đổi kết quả.

Trong chế độ chơi với máy, đồng hồ dùng `performance.now()` ở client và dừng khi ván kết thúc. Rời hoặc tải lại trang kết thúc ván cục bộ; không lưu ván máy lên D1 trong phiên bản đầu.

## 7. Mô hình dữ liệu D1

Các bảng:

- `xiangqi_sessions`: ID phiên, tên hiển thị, ngày tạo và lần hoạt động gần nhất.
- `xiangqi_presence`: phiên, trạng thái, phòng hoặc ván liên quan, lần heartbeat.
- `xiangqi_invites`: người mời, người được mời hoặc mã phòng công khai, cấu hình ván, trạng thái và thời hạn.
- `xiangqi_games`: hai người chơi, biến thể, cấu hình đồng hồ, trạng thái bàn cờ đầy đủ, revision, lượt hiện tại, đề nghị hòa đang chờ, kết quả và timestamp.
- `xiangqi_moves`: ván, số thứ tự, nước đi, quân lật nếu có, thời gian còn lại sau nước và timestamp.

Các index phục vụ tra cứu theo session, mã phòng, trạng thái lời mời, trạng thái hiện diện và game đang hoạt động. Presence hết hiệu lực nếu không có heartbeat trong 15 giây; dữ liệu phiên vẫn được giữ để người chơi quay lại ván.

## 8. API và luồng dữ liệu

API nằm dưới `/api/xiangqi` và trả JSON.

Nhóm endpoint:

- `POST /session`: tạo hoặc cập nhật phiên tên.
- `POST /presence/heartbeat`: cập nhật hiện diện và trả lời mời đang chờ.
- `GET /lobby`: danh sách hiện diện, lời mời và phòng của phiên hiện tại.
- `POST /invites`: tạo link hoặc lời mời trực tiếp.
- `POST /invites/:id/accept` và `/decline`: xử lý lời mời.
- `POST /invites/:id/cancel`: chủ phòng hủy chờ.
- `GET /games/:id`: lấy snapshot đã che phù hợp với người gọi.
- `POST /games/:id/commands`: báo sẵn sàng, gửi nước đi, xin hòa, chấp nhận hòa, từ chối hòa, đầu hàng hoặc yêu cầu chơi lại.

Các thay đổi có cạnh tranh như chấp nhận lời mời và ghi nước đi phải dùng thao tác có điều kiện theo trạng thái/revision để chỉ một request thắng. API không tin tên người chơi, ID người chơi, lượt, đồng hồ hoặc kết quả do client gửi lên.

## 9. Xử lý lỗi và kết nối lại

- Mạng lỗi tạm thời: giữ snapshot cuối, hiển thị trạng thái mất kết nối và retry sau 1, 2, 4 rồi tối đa 8 giây.
- Client có revision cũ: thay vì áp dụng lệnh, API trả snapshot mới; client thay thế trạng thái cục bộ.
- Link hết hạn hoặc phòng đủ người: hiển thị thông báo cụ thể và nút về sảnh.
- Đối thủ đã bận: lời mời trực tiếp hết hiệu lực và người mời nhận thông báo.
- Hai lời mời được chấp nhận gần nhau: điều kiện session chỉ được tham gia một game đảm bảo tối đa một lời mời thành công.
- Mất mạng giữa ván: đồng hồ tiếp tục chạy trên máy chủ; người chơi dùng cùng cookie để vào lại.
- Cookie bị mất: người chơi có thể nhập lại tên nhưng không tự động chiếm lại ghế cũ, tránh mạo danh chỉ bằng tên.
- AI lỗi hoặc hết thời gian suy nghĩ: dừng đồng hồ cục bộ, cho phép thử lại AI hoặc kết thúc ván; không tự chọn một nước chưa kiểm tra.
- D1 lỗi: không dự đoán nước đi thành công; client giữ trạng thái trước lệnh và cho phép gửi lại sau khi đồng bộ.

Mọi API thay đổi dữ liệu kiểm tra `Origin`, cookie phiên và `Content-Type: application/json`. Tên hiển thị được cắt khoảng trắng, giới hạn 30 ký tự và render như văn bản thuần.

## 10. Giao diện và khả năng tiếp cận

Trang dùng lại `GameShell`, header và ngôn ngữ thiết kế SunShinSon. Bàn cờ dùng tông gỗ ấm, quân Đỏ và Đen có độ tương phản cao.

- Mọi ô và nút có nhãn truy cập phù hợp.
- Có thể chọn quân và đích bằng bàn phím, không chỉ chuột hoặc cảm ứng.
- Không dùng màu làm tín hiệu duy nhất cho lượt, trạng thái hay cảnh báo.
- Hộp thoại giữ focus, đóng bằng Escape và trả focus về vị trí trước đó.
- Chuyển động lật quân tôn trọng `prefers-reduced-motion`.
- Đồng hồ đổi cả màu, biểu tượng và văn bản khi sắp hết giờ.
- Trạng thái cập nhật online dùng vùng thông báo `aria-live` có mức độ vừa phải, tránh đọc lại toàn bộ bàn mỗi giây.

## 11. Kiểm thử

### 11.1 Engine luật

Unit test cho:

- Cách đi, cản đường và bắt quân của từng loại quân.
- Tướng đối mặt, tự đưa Tướng vào chiếu, chiếu và chiếu bí.
- Hết nước hợp lệ, lặp trạng thái và các lý do kết thúc.
- Serialize/hydrate tạo lại đúng trạng thái.

### 11.2 Cờ úp

- Xáo đủ 15 quân mỗi bên, không mất hoặc lặp quân.
- Cùng seed tạo cùng bố cục.
- Quân chưa lật đi theo vị trí che và lật sau nước hợp lệ đầu tiên.
- Sĩ rời cung và Tượng qua sông sau khi lật.
- Snapshot công khai không chứa danh tính quân chưa lật.
- AI không nhận mapping kín trong input tìm kiếm.

### 11.3 Đồng hồ và AI

- Chuyển lượt cập nhật đúng đồng hồ.
- Hết giờ tạo kết quả đúng ở cả local và server.
- Tải lại hoặc polling chậm không làm sai thời gian máy chủ.
- Ba mức AI chỉ trả nước hợp lệ, có thể hủy và không khóa UI.

### 11.4 Online

- Tạo, mở, chấp nhận, từ chối, hủy và làm hết hạn lời mời.
- Người chưa có tên trở lại đúng phòng sau khi nhập tên.
- Presence chuyển đúng giữa Rảnh, Đang chờ và Đang chơi.
- Hai request cùng revision chỉ có một request được ghi.
- Hai lời mời cạnh tranh không đưa một phiên vào hai ván.
- Mất mạng và tải lại khôi phục đúng ván.
- Người ngoài ván không đọc được mapping kín hoặc gửi lệnh.

### 11.5 Giao diện và tích hợp

- Kiểm tra render ở kích thước điện thoại và máy tính.
- Kiểm tra điều khiển bàn phím, focus hộp thoại và reduced motion.
- Chạy build, lint và toàn bộ test hiện có cùng test Cờ tướng.

## 12. Tiêu chí hoàn thành

Tính năng hoàn thành khi:

- Người chơi có thể hoàn tất một ván Cờ sáng hoặc Cờ úp với máy.
- Hai trình duyệt có thể tìm nhau qua link hoặc danh sách online và hoàn tất một ván.
- Người mở link lần đầu chỉ cần nhập tên rồi vào đúng phòng.
- Luật, đồng hồ và kết quả được máy chủ kiểm tra cho ván online.
- Không có danh tính quân úp chưa lật trong phản hồi gửi cho client.
- Tải lại trang trong ván online khôi phục đúng bàn và đồng hồ.
- Trang hoạt động tốt trên điện thoại và máy tính, không làm hỏng các trò chơi hiện có.
