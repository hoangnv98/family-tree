# Cây gia phả chia sẻ (`?tree=<id>`)

Mở app với `?tree=<id>` là vào **cây chia sẻ** có id `<id>`. Ai có link cũng
**sửa được**, và thay đổi **tự lưu lên cloud** (last-write-wins); người khác mở
hoặc refresh sẽ thấy bản mới.

## Dữ liệu nằm ở đâu
- **Cloud (Upstash Redis / Vercel KV)** là nguồn chính — xem [api/tree.ts](../../api/tree.ts).
- File `.json` trong thư mục này chỉ là **bản tĩnh đi kèm**, dùng để:
  - **Seed**: lần đầu mở `?tree=<id>` mà cloud chưa có cây đó, app nạp file này
    làm dữ liệu khởi đầu; lần sửa đầu tiên sẽ tạo cây trên cloud.
  - **Fallback chỉ-đọc**: nếu chưa bật lưu trữ cloud, app hiển thị file này ở
    chế độ chỉ xem.

## Tạo cây chia sẻ
- Cách nhanh: ở chế độ nháp (mở app không có `?tree=`), bấm nút **Chia sẻ lên
  cloud** (icon chia sẻ) — app tạo id ngẫu nhiên, đẩy cây hiện tại lên cloud rồi
  mở link chia sẻ.
- Hoặc tự đặt id: mở `?tree=ten-tuy-y` (chữ thường/số/`-`/`_`) rồi bắt đầu sửa.
