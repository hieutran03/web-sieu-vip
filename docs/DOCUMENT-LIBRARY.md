# V-TNF · Bản đồ hồ sơ địa chất khu công nghiệp

Trang tra cứu hồ sơ khảo sát trong thư mục địa chất KCN miền Nam, theo tỉnh và địa điểm/dự án.
Bản đồ vẫn hiển thị toàn bộ lãnh thổ Việt Nam (kể cả Hoàng Sa, Trường Sa).

## 1. Luồng dữ liệu

```
Z:\...\★開発関係資料
   └── N1-Địa chất Việt Nam/R1.2. Địa chất  KCN miền Nam/<tỉnh>/<địa điểm>/…
        │
        │  npm run docs:catalog     quét + phân loại theo LUẬT (không dùng AI)
        ▼
src/data/documentCatalog.json      danh mục của đúng thư mục trên
        │
        │  npm run docs:upload      signed upload lên Cloudinary (tag + context metadata)
        ▼
Cloudinary  v-tnf/<collection>/<region>/<province>/<zone>/<file>_<hash>
        │
        ├── Web  (src/components/DocumentsPage.jsx)   bản đồ + hồ sơ + phân tích
        ├── API  (api/*.js)                           documents / analyze / classify / admin
        └── MCP  (mcp/server.mjs)                     search_documents, get_province, …
```

**Phạm vi**: chỉ tệp hợp lệ trong `R1.2. Địa chất  KCN miền Nam`, trừ thư mục `OLD`. Bảng Excel
tổng hợp ở gốc được giữ trong danh mục mà không gán vào một tỉnh hay địa điểm giả. Bộ lọc phạm vi
nằm ở [src/shared/scope.js](../src/shared/scope.js). API và web chỉ gộp trạng thái lưu trữ theo ID
đã có trong catalog, nên các bản cũ hoặc tệp ngoài thư mục không tự hiện lại từ kho lưu trữ.

Các tệp cũ trên ổ chia sẻ và kho lưu trữ không bị xóa vật lý. Không dùng `docs:prune -- --delete`
để dọn chúng khi chưa kiểm tra riêng, vì catalog hiện chỉ bao gồm một phần của kho.

Nguyên tắc: **catalog là nguồn sự thật cho danh sách và metadata**; các kho cung cấp URL.

## 2. Biến môi trường (`.env.local`)

| Biến | Dùng ở đâu | Ghi chú |
| --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID` | client | tuỳ chọn, chỉ cho chế độ bản đồ Google |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | server + scripts | secret **không bao giờ** ra client |
| `CLOUDINARY_ROOT_FOLDER` | server + scripts | mặc định `v-tnf` |
| `VITE_CLOUDINARY_CLOUD_NAME` | client | chỉ để dựng URL, là thông tin công khai |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | server | chỉ dùng khi bật AI |
| `AI_ANALYSIS_ENABLED` | server | **`false` = mặc định**: mọi phân tích chạy bằng luật |
| `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET` | server | đăng nhập admin để upload |
| `STORAGE_PUBLIC_URL`, `STORAGE_UPLOAD_SECRET` | server + scripts | máy chủ lưu trữ tự host cho file lớn, xem [storage-server/README.md](../storage-server/README.md) |
| `VITE_STORAGE_PUBLIC_URL` | client | dựng link xem/tải hồ sơ lưu ở máy chủ tự host |
| `DOCS_SOURCE_DIR` | scripts | đường dẫn ổ chia sẻ (chỉ cần trên máy có ổ Z:) |

## 3. Các script

```bash
npm run dev                 # Vite + API functions (api/ được mount vào dev server)
npm run build               # build production

npm run geo:build           # tải lại địa giới 63 tỉnh (dvhcvn / gis.chinhphu.vn), đơn giản hoá
npm run docs:catalog        # quét ổ chia sẻ -> src/data/documentCatalog.json  (thêm --all nếu cần)
npm run docs:upload         # upload các hồ sơ chưa có trên Cloudinary
npm run docs:sync           # catalog + upload
npm run docs:prune          # liệt kê asset mồ côi (thêm --delete để xoá thật)
npm run docs:upload-selfhost  # đẩy hồ sơ vượt giới hạn Cloudinary lên máy chủ tự host
npm run mcp                 # MCP server (stdio)
```

Thêm hồ sơ mới trên ổ Z: → `npm run docs:sync`. Script bỏ qua tài liệu đã upload và giữ nguyên
trạng thái upload khi quét lại.

Hồ sơ vượt giới hạn Cloudinary → `npm run docs:upload-selfhost`. Script đẩy chúng lên máy chủ tự
host (máy Linux 24/7, mở ra internet bằng Tailscale Funnel) và ghi `selfhost` vào catalog. Cài đặt
máy chủ xem [storage-server/README.md](../storage-server/README.md). Khi một hồ sơ có nhiều nơi
lưu, link xem/tải ưu tiên theo thứ tự `selfhost` → ImageKit → Cloudinary. Ảnh xem trước vẫn chỉ
có với hồ sơ trên Cloudinary.

Với hồ sơ `selfhost`, trang hỏi `<Funnel>/tunnel` để lấy link Cloudflare quick tunnel hiện tại,
rồi xem và tải qua link đó vì nhanh hơn. Khi không có link hoặc link lỗi, trang tự quay về
Funnel. Link tunnel đổi thì không cần sửa env (xem phần "Đường tải nhanh" trong README của
storage-server).

Các PDF miền Nam chưa có trên Cloudinary có thể tải lên ImageKit bằng `npm run docs:upload-imagekit`.
Đặt `IMAGEKIT_PRIVATE_KEY` trong `.env.local` và giữ khóa ở phía máy chủ. Danh mục lưu URL ImageKit
cho từng hồ sơ và giữ lại khi quét lại nếu tệp nguồn không thay đổi. Giới hạn kích thước phụ thuộc
vào tài khoản ImageKit; những tệp bị từ chối vẫn hiển thị ở trạng thái cấp theo yêu cầu.

## 4. Giao diện

Header có 2 tab:

**Bản đồ & hồ sơ**
- 4 chỉ số: tổng hồ sơ, hồ sơ khảo sát địa chất, số địa điểm/dự án, số tỉnh/thành.
- Lọc theo phạm vi có dữ liệu, nhóm tài liệu, định dạng, tên và địa chỉ; số đếm ở các bộ lọc
  phản ánh các điều kiện khác đang được chọn.
- Bản đồ choropleth theo mật độ hồ sơ:
  - tỉnh **có dữ liệu**: tô màu theo vùng, viền đậm + đổ bóng, bấm được;
  - tỉnh **chưa có dữ liệu**: nền xám nhạt, viền mảnh, không bấm được;
  - **Hoàng Sa** (huyện Hoàng Sa, TP. Đà Nẵng) và **Trường Sa** (huyện Trường Sa, tỉnh Khánh Hòa)
    vẽ ngay trên bản đồ theo toạ độ thật, kèm nhãn và nhãn *Biển Đông*;
  - phóng to / thu nhỏ bằng nút `+ − ⟲`, con lăn chuột, và kéo để di chuyển bản đồ;
  - chọn được nền **Bản đồ vector** (mặc định) hoặc **Google Maps**.
- Bấm vào tỉnh: popover có mũi tên trỏ vào tỉnh (số hồ sơ, số KCN, số KCN đủ dữ liệu, 3 KCN nhiều
  hồ sơ nhất, nút *Xem hồ sơ*) và panel bên phải hiện **danh sách KCN dạng list view**
  (cột KCN / Dữ liệu / Hồ sơ, hàng cao bằng nhau, cuộn trong khung — không co giãn theo số lượng).
- Bấm một KCN → cuộn xuống mục **Danh mục hồ sơ** đã lọc theo KCN đó.
- Danh mục hồ sơ: thanh phạm vi (vùng/tỉnh/KCN, bấm × để bỏ), tìm kiếm, lọc theo nhóm hồ sơ và
  định dạng, thẻ hồ sơ có ảnh xem trước (PNG resize, PDF render trang 1), xem trong modal, tải về.
- Deep link chia sẻ được: `/map?region=south&province=long-an&zone=xuyen-a` hoặc
  `/map?province=long-an&district=duc-hoa`; liên kết `#map?...` cũ vẫn hoạt động.

**Phân tích** — số liệu tính từ chính bộ hồ sơ: hồ sơ theo tỉnh, cấu trúc nhóm hồ sơ, độ phủ KCN
theo vùng, so sánh ba vùng, hồ sơ theo năm; kèm nhận định tiếng Việt sinh bằng luật. Nút
*Phân tích bằng AI* gọi `/api/analyze?ai=1` để Gemini viết nhận định **trên đúng các con số đó**.

Đăng nhập admin nằm ở liên kết nhỏ cuối trang (không hiện thông tin nội bộ trên trang khách hàng).

## 5. Phân loại tự động (rule-based, không cần AI)

[src/shared/classify.js](../src/shared/classify.js) suy ra từ cấu trúc thư mục và tên tệp:

- **Vùng**: thư mục `KCN miền Bắc/Trung/Nam`, `R1.6. Địa chất KCN miền Bắc`… hoặc suy từ tỉnh.
- **Tỉnh**: tên thư mục hoặc tên tệp, ưu tiên khớp có dấu hiệu `tỉnh/TP` để tránh nhầm huyện trùng
  tên (ví dụ `THẠNH HÓA` của Long An **không** bị hiểu là tỉnh Thanh Hóa).
- **Khu công nghiệp**: thư mục ngay dưới tỉnh, hoặc mẫu `KCN <tên>` / `CCN <tên>` trong tên tệp.
- **Nhóm hồ sơ**: `geology` (khảo sát địa chất) và `zone-map` (sơ đồ / mặt bằng KCN).
- **Định dạng**: image / pdf / document / spreadsheet / drawing / archive.

Mỗi hồ sơ lưu kèm `reasons[]` giải thích vì sao được gán như vậy (dùng trong form upload và MCP).

Gemini chỉ tham gia khi `AI_ANALYSIS_ENABLED=true`, và chỉ để **điền các trường luật không suy ra
được** ([server/classifyService.js](../server/classifyService.js)) hoặc viết nhận định trên đúng
các con số đã tính ([api/analyze.js](../api/analyze.js)). Số liệu không bao giờ do model sinh ra.

## 6. API (Vercel functions, cũng chạy trong `npm run dev`)

| Endpoint | Method | Mô tả |
| --- | --- | --- |
| `/api/health` | GET | cấu hình hiện có: cloudinary / admin / AI |
| `/api/documents` | GET | danh sách hồ sơ; `scope=merged\|live\|snapshot`, lọc theo region/province/zone/category/kind/query |
| `/api/analyze` | GET/POST | thống kê + nhận định (`ai=1` để gọi Gemini) |
| `/api/classify` | POST | phân loại một tên tệp/đường dẫn |
| `/api/admin/login` | POST | `{password}` → token HMAC 8 giờ (rate limit 8 lần / 5 phút) |
| `/api/admin/upload-signature` | POST | token + tên tệp → chữ ký để browser upload trực tiếp lên Cloudinary |
| `/api/admin/delete` | POST | xoá một asset trong thư mục gốc `v-tnf/` |

Upload đi **trực tiếp từ browser lên Cloudinary** bằng chữ ký ký ở server: không vướng giới hạn
body 4.5 MB của serverless, và API secret không rời server.

## 7. MCP server (`mcp/server.mjs`)

Đã khai báo trong [.mcp.json](../.mcp.json), transport stdio. Tools: `list_taxonomy`,
`search_documents`, `get_province`, `get_zone`, `get_statistics`, `classify_document`,
`upload_document` (cần `MCP_ALLOW_UPLOAD=true`), `cloudinary_status`.
Resources: `vtnf://catalog`, `vtnf://provinces.geojson`.

Các tool đọc dùng catalog snapshot (trả lời tức thì); truyền `includeRecentUploads: true` nếu cần
gộp thêm hồ sơ vừa upload qua trang admin.

## 8. Giới hạn đang có

- **Gói Cloudinary Free**: ảnh/raw tối đa **10 MB**, video **100 MB**. 41/197 hồ sơ (báo cáo khảo
  sát địa chất dung lượng lớn, tới 668 MB) vượt giới hạn nên chưa phát hành trực tuyến — thẻ hồ sơ
  hiển thị *"Bản đầy đủ cấp theo yêu cầu"* và không lộ đường dẫn nội bộ. Các hồ sơ này đi qua
  máy chủ tự host (`npm run docs:upload-selfhost`). Upload qua trang admin thì file lớn tự động
  được chuyển sang máy chủ đó.
- **Máy chủ tự host**: máy tắt hoặc mất mạng thì hồ sơ lớn tạm thời không mở được; băng thông
  Tailscale Funnel có giới hạn và không công bố con số.
- Địa giới dùng **63 tỉnh trước 01/07/2025** vì tên thư mục trên ổ chia sẻ theo hệ cũ; mỗi tỉnh có
  kèm `mergedInto` và popover/panel hiển thị dòng "Sau sáp nhập 01/07/2025 thuộc …".
- Chế độ Google Maps: `@vis.gl/react-google-maps` v1.8.3 gặp vấn đề khi React `StrictMode` mount
  hai lần; đã xử lý bằng cách hoãn mount một frame, nhưng bản đồ vector vẫn là mặc định vì vẽ tức
  thì và không phụ thuộc quota.
- Ổ Z: chỉ truy cập được từ mạng nội bộ, nên `docs:catalog` / `docs:upload` phải chạy ở máy công ty.
