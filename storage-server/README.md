# Máy chủ lưu trữ tự host (cho hồ sơ > 10 MB)

Server lưu file nhỏ, không phụ thuộc thư viện ngoài, chạy trên máy Linux bật 24/7. Server này lưu
những hồ sơ vượt giới hạn gói Cloudinary Free. Cloudinary vẫn giữ các file nhỏ vì có ảnh xem trước.

```
Trình duyệt ──HTTPS──► https://<tên-máy>.<tailnet>.ts.net  (Tailscale Funnel, free, không cần domain)
                               │
                               ▼
                    Docker: vtnf-storage (127.0.0.1:8080) ──► /srv/vtnf-storage
```

- **Đọc file**: công khai, giống URL Cloudinary. Có hỗ trợ Range nên PDF lớn mở được từng phần,
  video tua được.
- **Upload / xoá / liệt kê**: bắt buộc có chữ ký HMAC, hết hạn sau 2 giờ. Chữ ký do Vercel hoặc
  script ký bằng `UPLOAD_SECRET`; secret không bao giờ xuống trình duyệt.

## 1. Cài server (trên máy Linux)

```bash
# Lấy code (chỉ cần thư mục storage-server/)
git clone <repo> ~/web-sieu-vip && cd ~/web-sieu-vip/storage-server

cp .env.example .env
openssl rand -base64 48          # dán kết quả vào UPLOAD_SECRET trong .env
nano .env

# Thư mục dữ liệu phải thuộc user node (uid 1000) trong container
sudo mkdir -p /srv/vtnf-storage && sudo chown 1000:1000 /srv/vtnf-storage

docker compose up -d --build
curl http://127.0.0.1:8080/health   # {"ok":true,...,"freeBytes":...}
```

`restart: unless-stopped` giúp container tự chạy lại sau khi máy khởi động lại (miễn là Docker
được bật cùng máy: `sudo systemctl enable docker`).

## 2. Mở ra internet bằng Tailscale Funnel (free)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                    # đăng nhập bằng tài khoản Google/GitHub/Microsoft
sudo tailscale funnel --bg 8080      # lần đầu sẽ in ra link để bật HTTPS + Funnel cho tailnet
tailscale funnel status              # in ra URL public, ví dụ https://homeserver.tail1234.ts.net
```

Thử từ một máy khác: `curl https://homeserver.tail1234.ts.net/health`.

Cấu hình Funnel được lưu lại và tự bật sau khi máy khởi động lại (do có cờ `--bg`).

### Đường tải nhanh: Cloudflare quick tunnel (free, tự động)

Funnel giới hạn mỗi kết nối còn khoảng 0,2 MB/s, nên PDF lớn mở rất chậm. `docker compose up`
chạy thêm container `vtnf-tunnel` (cloudflared). Container này mở một link
`https://<ngẫu-nhiên>.trycloudflare.com` miễn phí, không cần tài khoản hay domain, và đo được
nhanh hơn Funnel khoảng 7 lần.

```
Trình duyệt ──► Funnel /tunnel ──► "link Cloudflare hiện tại là ..."
Trình duyệt ──► https://xxx.trycloudflare.com/f/... (tải PDF nhanh)
            └─► lỗi / chưa có link ──► tự quay về Funnel
```

- Link Cloudflare **đổi mỗi lần container khởi động lại**. Server tự đọc link mới từ cloudflared,
  kiểm tra nó chạy được, rồi trả về ở `GET /tunnel`. Không cần sửa env hay redeploy Vercel.
- Upload, xoá, liệt kê vẫn đi qua Funnel. Cloudflare chỉ dùng để đọc file.
- Kiểm tra: `curl http://127.0.0.1:8080/tunnel`. Kết quả `{"url":"https://...trycloudflare.com"}`
  là đang chạy. Kết quả `{"url":null}` nghĩa là chỉ còn Funnel (đợi khoảng 30 giây sau khi khởi
  động, hoặc xem `docker logs vtnf-tunnel`).
- Quick tunnel là dịch vụ thử nghiệm của Cloudflare, không cam kết uptime. Khi nó lỗi, trang vẫn
  chạy qua Funnel, chỉ chậm hơn.

## 3. Cấu hình web

Thêm vào **Vercel → Settings → Environment Variables** và vào `.env.local` của máy chạy script
(máy có ổ Z:):

| Biến | Giá trị |
| --- | --- |
| `STORAGE_PUBLIC_URL` | URL Funnel, ví dụ `https://homeserver.tail1234.ts.net` |
| `STORAGE_UPLOAD_SECRET` | **giống hệt** `UPLOAD_SECRET` trong `storage-server/.env` |
| `VITE_STORAGE_PUBLIC_URL` | URL Funnel (client dùng để dựng link xem/tải) |

Sau đó redeploy Vercel (biến `VITE_*` được gắn vào bundle lúc build).

## 4. Đẩy các hồ sơ lớn lên

Chạy trên máy công ty có ổ Z: (PowerShell, trong thư mục repo):

```bash
npm run docs:upload-selfhost -- --dry-run           # xem danh sách, chưa upload
npm run docs:upload-selfhost                        # upload tất cả hồ sơ chưa có ở đâu
npm run docs:upload-selfhost -- --include-imagekit  # chuyển luôn các hồ sơ đang ở ImageKit
```

Script ghi `selfhost` vào `src/data/documentCatalog.json` sau mỗi file. Commit file đó rồi
deploy lại để trang hiện các hồ sơ mới. Bị ngắt giữa chừng thì chạy lại, file đã xong sẽ được
bỏ qua.

Upload qua trang admin: file vượt giới hạn Cloudinary sẽ **tự động** đi thẳng lên server này.

## 5. Vận hành

- **Backup**: dữ liệu chỉ nằm ở một ổ đĩa. Nên chép định kỳ sang ổ khác, ví dụ
  `0 3 * * * rsync -a /srv/vtnf-storage/ /mnt/backup/vtnf-storage/` trong `crontab -e`, hoặc
  dùng `rclone` đẩy lên Google Drive. File gốc vẫn còn trên ổ Z:, nên mất dữ liệu ở đây thì chạy
  lại `docs:upload-selfhost -- --force` là khôi phục được.
- **Log**: `docker compose logs -f`
- **Cập nhật**: `git pull && docker compose up -d --build`
- **Đổi secret**: sửa `.env`, `docker compose up -d`, rồi cập nhật `STORAGE_UPLOAD_SECRET` trên Vercel.
- **Đổi URL** (đổi tên máy, chuyển sang Cloudflare Tunnel khi có domain): chỉ cần đổi 3 biến ở
  mục 3 rồi redeploy. Link xem/tải được dựng từ `VITE_STORAGE_PUBLIC_URL`, không cần upload lại.

## Giới hạn

- Băng thông Funnel do Tailscale giới hạn và không công bố con số; tốc độ tải còn phụ thuộc
  upload của mạng nhà. Phù hợp với lượng truy cập vừa phải.
- Máy tắt hoặc mất mạng thì hồ sơ lớn tạm thời không mở được. Hồ sơ trên Cloudinary và phần
  còn lại của trang vẫn chạy bình thường.
