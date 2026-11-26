# ADR-011: Triển khai production trên AWS EC2 (VPS, region ap-southeast-1)

- **Trạng thái:** Chấp nhận (thay thế bản dùng Render; bản Render cũ giữ ở `docs/deployment-render.md` để tham khảo)
- **Liên quan:** NFR-14, NFR-07, NFR-15, NFR-17; ADR-010

## Bối cảnh
Cần URL production qua HTTPS, database lưu trữ bền và không public, chi phí thấp, và kiểm soát được cách triển khai, rollback, sao lưu. Nhóm đã có image build sẵn trong CI và lưu ở GHCR (ADR-010).

## Quyết định
Chạy toàn bộ hệ thống trên **một máy AWS EC2** (Ubuntu 24.04, `t3.small`, region `ap-southeast-1`) bằng **Docker Compose** (`docker-compose.prod.yml`):

- `nginx` là điểm vào duy nhất (cổng 80/443), kết thúc TLS bằng **Let's Encrypt**, tách `app.<domain>` (web :3000) và `api.<domain>` (API :4000).
- `web`, `api`, `db` chỉ nằm trong mạng nội bộ của Compose; cổng 5432 không publish ra host và Security Group đóng, nên database không public.
- Dữ liệu PostgreSQL nằm ở volume `pgdata` trên **EBS gp3**; sao lưu bằng `pg_dump` định kỳ và snapshot EBS.
- **Elastic IP** + **Route 53** (hoặc sslip.io khi chưa có domain) giữ địa chỉ ổn định cho DNS và chứng chỉ.
- Image `brewlite-api` và `brewlite-web` build trong GitHub Actions, lưu ở **GHCR** với tag bất biến (`vX.Y.Z` hoặc `sha-<7 ký tự>`). Pipeline CD (`cd.yml`) SSH vào EC2 chạy `deploy/deploy.sh`: pull, `up -d`, smoke test (`GET /health`, `GET /products`), tự rollback về tag trước nếu smoke test lỗi.
- Secret nằm trong file `.env` trên EC2 (`chmod 600`) và GitHub Secrets; log ra stdout, giới hạn dung lượng bằng cấu hình `json-file`; health check `GET /health`.
- RabbitMQ không chạy ở production: `RABBITMQ_URL` để trống nên API tắt gửi / nhận sự kiện đơn hàng, các nghiệp vụ chính không bị ảnh hưởng (xem README, mục "Sự kiện đơn hàng").

Hướng dẫn từng bước, biến môi trường, rollback và checklist bàn giao: `docs/deployment.md`.

## Phương án đã cân nhắc
- **Render (Web Service + Render PostgreSQL):** dựng nhanh, có HTTPS sẵn, nhưng gói miễn phí ngủ đông, giới hạn hạn mức và khó kiểm soát sao lưu. Hướng dẫn cũ còn ở `docs/deployment-render.md`.
- **VPS tự quản khác (không phải AWS):** tương tự EC2 nhưng nhóm không có sẵn tài khoản và quy trình.
- **ECS / EKS / RDS:** mạnh nhưng phức tạp và tốn chi phí cho một MVP một cửa hàng.

## Hệ quả
- Ưu: toàn quyền kiểm soát hạ tầng, giá thấp, dữ liệu bền trên EBS, HTTPS qua nginx + Let's Encrypt, rollback ứng dụng bằng đổi tag image.
- Nhược: phải tự vận hành (cập nhật hệ điều hành, gia hạn chứng chỉ, backup, theo dõi chi phí AWS); một máy duy nhất là một điểm lỗi; Prisma migration không có "down" nên cần backup trước release có migration.
- Rủi ro cần theo dõi: hết credit hoặc phát sinh chi phí (đặt AWS Budgets), mất dữ liệu (snapshot + `pg_dump`, đã thử khôi phục), cổng SSH cho CD (xem `deployment.md`, mục 4.2).
