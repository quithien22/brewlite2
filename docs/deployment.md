# Triển khai BrewLite lên AWS EC2

Production chạy trên **một máy AWS EC2** (Ubuntu 24.04, `t3.small`, ap-southeast-1) bằng **Docker Compose**. HTTPS qua **nginx + Let's Encrypt**. Image build ở **GitHub Actions**, lưu ở **GHCR**, pipeline CD SSH vào EC2 để cập nhật (xem ADR-011). Hướng dẫn Render cũ ở `deployment-render.md` chỉ để tham khảo.

## 1. URL bàn giao
 
| Thành phần | URL | Trạng thái |
|---|---|---|
| Frontend (HTTPS) | `hhttp://16.179.30.215:3000/` | ✅ |
| API | `http://16.179.30.215:4000/` | ✅ |
| Health check | `http://16.179.30.215:4000/health` → `{"status":"ok","database":"up",...}` | ✅ |
| Repository | `https://github.com/quithien22/brewlite-` | ✅ |

Tài khoản demo: `demo@brewlite.vn` / `Demo1234`. Mã khuyến mãi: `CHAO10`, `GIAM15K`, `COMBO20`.

## 2. Kiến trúc

```
Trình duyệt ──HTTPS 443──> nginx ──app.<domain>──> web (Next.js :3000)
                             └────api.<domain>──> api (NestJS :4000) ──> db (PostgreSQL 16, volume pgdata)
```

- Chỉ nginx mở cổng 80/443. `web`, `api`, `db` nằm trong mạng nội bộ Docker; cổng 5432 không ra ngoài.
- Image build trong CI, server chỉ `pull` rồi `up -d`. Web nhúng `NEXT_PUBLIC_API_URL` lúc build, đổi domain API thì phải build lại web.
- RabbitMQ không chạy ở production (`RABBITMQ_URL` để trống, API vẫn chạy bình thường).

Tệp liên quan: `docker-compose.prod.yml`, `nginx/default.conf.template`, `deploy/deploy.sh`, `.github/workflows/ci.yml` và `cd.yml`.

## 3. Chuẩn bị lần đầu

**Trên AWS:** tạo EC2, gắn Elastic IP, Security Group mở 80 và 443 (22 chỉ cho IP của nhóm), trỏ DNS `app` và `api` về Elastic IP.

**Trên server:**

```bash
# cài Docker, certbot rồi lấy chứng chỉ (tên "brewlite" khớp nginx/default.conf.template)
sudo certbot certonly --standalone --cert-name brewlite -d app.<domain> -d api.<domain>

mkdir -p ~/brewlite && cd ~/brewlite
cat > .env <<'EOF'
APP_DOMAIN=app.<domain>
API_DOMAIN=api.<domain>
POSTGRES_PASSWORD=<mật-khẩu-mạnh>
JWT_SECRET=<chuỗi-ngẫu-nhiên-dài>
EOF
chmod 600 .env
```

Biến tùy chọn (có mặc định): `JWT_EXPIRES_IN=7d`, `ORDER_EXPIRE_MINUTES=15`, `REFUND_WINDOW_MINUTES=5`, `MOCK_PAYMENT_ALLOW_FAILURE=false`.

**Trên GitHub** (Settings → Secrets and variables → Actions):

| Loại | Tên | Ý nghĩa |
|---|---|---|
| Secret | `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` | Địa chỉ, user và khóa SSH của EC2 |
| Variable | `PROD_API_URL` | `https://api.<domain>` (nhúng vào web lúc build) |
| Variable | `PROD_ALLOW_MOCK_FAILURE` | `true` hoặc `false` |
| Environment | `production` | Dùng cho job `deploy` |

## 4. Triển khai và rollback

- **Tự động:** push vào `main` hoặc tag `vX.Y.Z` thì `cd.yml` chạy: lint, test, build, đẩy image lên GHCR, SSH vào EC2 chạy `deploy.sh`.
- `deploy.sh` kéo image mới, `up -d`, rồi smoke test (`GET /health`, `GET /products`). Nếu lỗi, tự quay về tag trước.
- **Rollback tay** (trên server): `cd ~/brewlite && ./deploy.sh <tag-cũ>`
- **Backup DB:** `docker compose -f docker-compose.prod.yml exec db pg_dump -U brewlite brewlite > backup.sql`. Nên backup trước bản phát hành có migration, vì Prisma migration không có "down".

## 5. Kiểm tra sau khi triển khai

1. `curl https://api.<domain>/health` trả `{"status":"ok","database":"up",...}`.
2. Mở `https://app.<domain>`, đăng nhập tài khoản demo, đặt và thanh toán một đơn.
3. `docker compose -f docker-compose.prod.yml ps` cho thấy `db`, `api`, `web`, `nginx` đang chạy; cổng 5432 không mở ra ngoài.

 