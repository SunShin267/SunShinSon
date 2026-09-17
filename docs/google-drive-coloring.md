# Google Drive cho tranh tô màu

SunShinSon dùng mô hình kết hợp:

- Google Drive lưu file PNG hoàn chỉnh trong thư mục `SunShinSon - Tranh cua be`.
- Cloudflare D1 lưu metadata, quyền sở hữu, Drive file ID và token OAuth đã mã hóa.
- Ứng dụng chỉ xin scope `drive.file`, nên chỉ đọc/ghi các file do SunShinSon tạo hoặc được người dùng cấp quyền cho ứng dụng.

## Cấu hình Google Cloud

1. Tạo OAuth 2.0 Client loại **Web application** trong Google Cloud Console.
2. Bật Google Drive API.
3. Thêm Authorized redirect URI:

   `https://sunshinson.phanthanhtai-cmu.chatgpt.site/api/coloring/drive/callback`

4. Cấu hình ba biến môi trường bí mật cho cả Sites và Cloudflare Worker:

   - `GOOGLE_DRIVE_CLIENT_ID`
   - `GOOGLE_DRIVE_CLIENT_SECRET`
   - `GOOGLE_DRIVE_TOKEN_KEY`

`GOOGLE_DRIVE_TOKEN_KEY` phải là 32 byte dạng base64url. Có thể tạo bằng:

```sh
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

Không commit các giá trị thật vào Git. Sau khi cấu hình, mở một tranh, tô màu, bấm **Kết nối Google Drive**, rồi bấm **Lưu Google Drive**. Tranh đã lưu xuất hiện trong chủ đề **Google Drive** của bộ sưu tập.
