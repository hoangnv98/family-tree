# 🌳 Cây Gia Phả (Family Tree)

Ứng dụng vẽ **cây gia phả** chạy hoàn toàn trên trình duyệt — **không cần backend**.
Thêm/sửa/xoá thành viên, nối quan hệ cha–mẹ / con / vợ–chồng, **xuất & nhập JSON**,
tự lưu vào trình duyệt. Deploy thẳng lên **GitHub Pages**.

![stack](https://img.shields.io/badge/React-18-blue) ![vite](https://img.shields.io/badge/Vite-5-purple) ![tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Tính năng
- 🧑‍🤝‍🧑 Quản lý thành viên: tên, giới tính, năm sinh/mất, ảnh, nghề nghiệp, liên hệ, tiểu sử, ghi chú, sự kiện.
- 🔗 Nối quan hệ: cha–mẹ / con / vợ–chồng — kéo thả trên canvas hoặc chọn trong bảng chi tiết.
- 🪄 Sắp xếp tự động cây theo thế hệ (dagre).
- 💾 **Tự lưu** vào `localStorage` — mở lại vẫn còn.
- 📤 **Xuất JSON** để sao lưu / chia sẻ, 📥 **Nhập JSON** (có kiểm tra định dạng).
- 🔍 Tìm kiếm & làm nổi bật, 🌙 chế độ sáng/tối.

## Chạy ở máy
```bash
npm install
npm run dev        # mở http://localhost:5173
```
Build production: `npm run build` → `npm run preview`.

## Tech stack
React 18 · TypeScript · Vite · Tailwind CSS · [@xyflow/react](https://reactflow.dev) ·
dagre (auto-layout) · Zustand (+persist) · zod (validate JSON).

## Deploy lên GitHub Pages (miễn phí, không backend)
1. Tạo repo trên GitHub rồi push code:
   ```bash
   git init && git add -A && git commit -m "init family tree"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. Trên GitHub: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Mỗi lần push lên `main`, workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   tự build và xuất bản. Sau ~1 phút mở link `https://<user>.github.io/<repo>/`.

> `vite.config.ts` đặt `base: './'` nên app chạy đúng ở mọi đường dẫn Pages mà không cần chỉnh gì.
> Dữ liệu cây nằm trong `localStorage` của từng trình duyệt; muốn mang đi nơi khác thì **Xuất JSON** rồi **Nhập** lại.

## Định dạng file JSON
```jsonc
{
  "version": 1,
  "meta": { "name": "Cây gia phả", "exportedAt": "2026-06-08T00:00:00.000Z" },
  "people": [
    { "id": "p1", "firstName": "Văn An", "lastName": "Nguyễn", "gender": "male", "birthYear": 1940 }
  ],
  "relationships": [
    { "id": "r1", "type": "parent", "parentId": "p1", "childId": "p3" },
    { "id": "r2", "type": "spouse", "aId": "p1", "bId": "p2" }
  ]
}
```
