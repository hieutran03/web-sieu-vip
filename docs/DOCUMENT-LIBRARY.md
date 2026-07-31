# V-TNF · Bản đồ hồ sơ địa chất khu công nghiệp

Trang tra cứu dành cho khách hàng: bản đồ toàn bộ lãnh thổ Việt Nam (kể cả Hoàng Sa, Trường Sa) →
tỉnh → khu công nghiệp → hồ sơ khảo sát địa chất và sơ đồ mặt bằng, lưu trên Cloudinary.

## 1. Luồng dữ liệu

```
Z:\...\★開発関係資料
   ├── N1-Địa chất Việt Nam/R1.1. Khu công nghiệp/KCN miền {Bắc,Trung,Nam}/<tỉnh>/<KCN>/…
   └── N1-Địa chất Việt Nam/R1.{2,6,8}. Địa chất KCN miền {Nam,Bắc,Trung}/<tỉnh>/<KCN>/…
        │
        │  npm run docs:catalog     quét + phân loại theo LUẬT (không dùng AI)
        ▼
src/data/documentCatalog.json      197 hồ sơ · 141 KCN · 34 tỉnh
        │
        │  npm run docs:upload      signed upload lên Cloudinary (tag + context metadata)
        ▼
Cloudinary  v-tnf/<collection>/<region>/<province>/<zone>/<file>_<hash>
        │
        ├── Web  (src/components/DocumentsPage.jsx)   bản đồ + hồ sơ + phân tích
        ├── API  (api/*.js)                           documents / analyze / classify / admin
        └── MCP  (mcp/server.mjs)                     search_documents, get_province, …
```

**Phạm vi**: chỉ tài liệu gắn được lên bản đồ — hồ sơ địa chất và sơ đồ của khu công nghiệp, có
tỉnh và tên KCN xác định. Các thư mục khác trên ổ chia sẻ (TNF/TCCS, xi măng, hồ sơ địa chất cầu
đường, atlas toàn quốc) bị loại khỏi catalog; muốn quét hết thì `npm run docs:catalog -- --all`.
Bộ lọc phạm vi nằm ở [src/shared/scope.js](../src/shared/scope.js) và cũng áp cho dữ liệu đọc
trực tiếp từ Cloudinary, nên tài liệu cũ còn sót trên Cloudinary không hiện lên trang.

Nguyên tắc: **catalog là nguồn sự thật cho metadata**, Cloudinary là nguồn sự thật cho URL.

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
npm run mcp                 # MCP server (stdio)
```

Thêm hồ sơ mới trên ổ Z: → `npm run docs:sync`. Script bỏ qua tài liệu đã upload và giữ nguyên
trạng thái upload khi quét lại.

## 4. Giao diện

Header có 2 tab:

**Bản đồ & hồ sơ**
- 4 chỉ số: tổng hồ sơ, hồ sơ khảo sát địa chất, số KCN, số tỉnh/thành.
- Lọc theo vùng (Toàn quốc / Bắc / Trung / Nam).
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
- Deep link chia sẻ được: `#map?region=north&province=bac-ninh&zone=vsip`.

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
  hiển thị *"Bản đầy đủ cấp theo yêu cầu"* và không lộ đường dẫn nội bộ. Nâng gói là đủ để
  `npm run docs:upload` đẩy tiếp, không cần sửa code.
- Địa giới dùng **63 tỉnh trước 01/07/2025** vì tên thư mục trên ổ chia sẻ theo hệ cũ; mỗi tỉnh có
  kèm `mergedInto` và popover/panel hiển thị dòng "Sau sáp nhập 01/07/2025 thuộc …".
- Chế độ Google Maps: `@vis.gl/react-google-maps` v1.8.3 gặp vấn đề khi React `StrictMode` mount
  hai lần; đã xử lý bằng cách hoãn mount một frame, nhưng bản đồ vector vẫn là mặc định vì vẽ tức
  thì và không phụ thuộc quota.
- Ổ Z: chỉ truy cập được từ mạng nội bộ, nên `docs:catalog` / `docs:upload` phải chạy ở máy công ty.
