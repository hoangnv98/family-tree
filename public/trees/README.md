# Cây gia phả chia sẻ qua URL

Mỗi file `<tên>.json` ở đây là một cây gia phả phục vụ qua link khi deploy:

    https://your-site/?tree=<tên>

Ví dụ: `demo.json` → mở bằng `?tree=demo`.

## Thêm cây của bạn

1. Trong app, bấm xuất file (Export) để tải file JSON cây gia phả về.
2. Đổi tên thành slug an toàn — chỉ chữ thường, số, `-`, `_` (vd `giapha-ho-tran.json`).
3. Bỏ vào thư mục `public/trees/` này rồi build/deploy lại.
4. Truy cập `?tree=giapha-ho-tran` để xem.

Khi mở bằng `?tree=...`, dữ liệu được nạp từ file ở đây và **không ghi đè** bản
nháp đang lưu trong trình duyệt (localStorage). Mở app không kèm tham số vẫn là
chế độ chỉnh sửa bình thường.
