# Task 1.1 – Bối cảnh, stakeholder và phạm vi

## 1.1.1. Vấn đề cần giải quyết
Một cửa hàng cà phê quy mô nhỏ vận hành theo cách truyền thống: khách xếp hàng tại quầy, xem bảng giá, gọi món bằng lời, trả tiền mặt rồi chờ. Cách làm này gây ra các vấn đề sau:

| STT | Vấn đề | Hệ quả |
| :--- | :--- | :--- |
| 1 | Khách phải xếp hàng để xem menu và gọi món, nhất là giờ cao điểm | Mất thời gian, bỏ về, giảm doanh thu |
| 2 | Tùy chỉnh đồ uống (size, đường, đá, topping) truyền đạt bằng lời | Dễ nhầm đơn, phải làm lại |
| 3 | Thanh toán tiền mặt, tìm tiền thừa | Chậm, sai sót, khó đối soát |
| 4 | Không biết còn hàng hay hết hàng cho đến khi gọi món | Khách bị từ chối sau khi đã chờ |
| 5 | Khuyến mãi và tích điểm quản lý thủ công | Áp sai mã, khó giới hạn lượt dùng |
| 6 | Không lưu lịch sử mua hàng | Khách không xem lại được các đơn đã đặt |

## 1.1.2. Giải pháp đề xuất
**BrewLite** là ứng dụng web mobile-first (hướng PWA) cho phép khách hàng xem menu, chọn tùy chọn, đặt đồ uống và thanh toán không dùng tiền mặt ngay trên điện thoại, sau đó theo dõi trạng thái và lịch sử đơn hàng.

*   **Luồng nghiệp vụ tối thiểu:** Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn.
*   **Nguyên tắc MVP:** Hệ thống chỉ có một vai trò người dùng là khách hàng. Dữ liệu menu, tồn kho, khuyến mãi được nạp bằng seed/migration. Sau khi thanh toán thành công, đơn ở trạng thái PAID và được xem là đã đặt thành công (đơn PAID chỉ có thể chuyển tiếp sang REFUNDED qua phần mở rộng hoàn tiền, xem 1.3.2a).

## 1.1.3. Mục tiêu sản phẩm

| STT | Mục tiêu | Cách đo |
| :--- | :--- | :--- |
| 1 | Khách hoàn thành một đơn từ lúc mở menu đến lúc thanh toán xong trong thời gian ngắn | Luồng end-to-end chạy được, demo không lỗi |
| 2 | Không bán quá số lượng tồn kho, không trừ tiền hai lần | Kiểm thử đồng thời và kiểm thử idempotency đạt |
| 3 | Khách luôn xem được trạng thái và lịch sử đơn của mình | Trang chi tiết đơn hiển thị đúng trạng thái và nhật ký |
| 4 | Hệ thống triển khai được lên môi trường truy cập qua HTTPS | URL production hoạt động tại thời điểm nghiệm thu |
| 5 | Người ngoài nhóm clone repository và chạy được theo README | `docker compose up` chạy thành công |

---

## 1.2. Stakeholder

### 1.2.1. Bảng stakeholder

| Stakeholder | Vai trò / mô tả | Mức ảnh hưởng | Mức quan tâm |
| :--- | :--- | :--- | :--- |
| **Khách hàng** (người dùng cuối) | Đặt đồ uống và thanh toán qua ứng dụng; dùng chủ yếu trên điện thoại | Cao | Cao |
| **Giảng viên / khách hàng nghiệm thu** | Đặt yêu cầu bài tập, chấm điểm theo tiêu chí Assignment 2 | Rất cao | Rất cao |
| **Nhóm phát triển** (Nhóm 07) | Phân tích, thiết kế, hiện thực, kiểm thử, triển khai | Cao | Rất cao |
| **Đơn vị thanh toán** (Ví MoMo / Thẻ VNPay – mô phỏng) | Nhận yêu cầu thanh toán và trả kết quả thành công hoặc thất bại | Trung bình | Thấp |

### 1.2.2. Mục tiêu và kỳ vọng của từng stakeholder

| Stakeholder | Mục tiêu | Kỳ vọng cụ thể |
| :--- | :--- | :--- |
| **Khách hàng** | Gọi đồ uống nhanh, không phải xếp hàng, không dùng tiền mặt | Menu rõ ràng; chọn được size/đường/đá/topping; biết giá cuối cùng trước khi trả; thanh toán an toàn, không bị trừ tiền hai lần; xem lại được đơn cũ; dùng được mã giảm giá và điểm thưởng |
| **Giảng viên / nghiệm thu** | Đánh giá năng lực áp dụng quy trình từ yêu cầu đến triển khai | Đủ tạo phẩm theo từng task, lịch sử commit rõ, truy vết được yêu cầu → thiết kế → code → test, URL production hoạt động, tài liệu và README đầy đủ |
| **Nhóm phát triển** | Hoàn thành đúng hạn, đúng chất lượng, học được quy trình chuyên nghiệp | Phạm vi vừa sức, yêu cầu rõ ràng và kiểm thử được, công cụ CI/CD ổn định |
| **Đơn vị thanh toán** | Nhận yêu cầu hợp lệ, không bị gọi trùng | Mỗi giao dịch gửi một lần; mã giao dịch được ghi nhận; xử lý được lỗi và phản hồi chậm |

---

## 1.3. Phạm vi

### 1.3.1. Phạm vi trong MVP (in-scope)

| Nhóm chức năng | Nội dung |
| :--- | :--- |
| **Xác thực** | Đăng ký, đăng nhập, đăng xuất, JWT, xem hồ sơ và số điểm. Chỉ có vai trò khách hàng |
| **Menu** | Xem danh sách đồ uống, tìm kiếm theo tên, lọc theo danh mục, hiển thị còn hàng / hết hàng, xem khuyến mãi đang chạy |
| **Chi tiết sản phẩm** | Chọn size (S/M/L), topping, mức đường, mức đá; tính giá theo tùy chọn |
| **Giỏ hàng** | Thêm, sửa số lượng, xóa món; tính tổng tiền; lưu giỏ khi tải lại trang; ghi chú cho đơn |
| **Khuyến mãi và điểm** | Áp mã giảm giá, dùng điểm thưởng, tích điểm sau thanh toán |
| **Đặt đơn** | Tạo đơn PENDING, kiểm tra và giữ tồn kho, tính lại giá ở máy chủ |
| **Thanh toán** | Ví / Thẻ mô phỏng, chống thanh toán trùng bằng Idempotency-Key, xử lý thất bại và thử lại |
| **Đơn hàng** | Màn hình xác nhận, lịch sử đơn (lọc, phân trang), chi tiết và nhật ký trạng thái, hủy đơn chưa thanh toán (hủy kèm hoàn tiền: xem 1.3.2a) |
| **Hạ tầng và chất lượng** | Docker Compose, CI/CD, kiểm thử, health check, migration + seed, triển khai production qua HTTPS |

### 1.3.2. Phạm vi mở rộng và nội dung không thực hiện

#### a) Mở rộng vượt MVP (đã hiện thực)

Hai chức năng dưới đây nằm ngoài đề bài và ngoài phạm vi MVP ban đầu, nhưng nhóm đã hiện thực trong mã nguồn nhằm tăng độ hoàn thiện. Chúng không thay thế yêu cầu Must/Should nào: nếu bỏ chúng đi, luồng chọn sản phẩm → giỏ hàng → thanh toán → xác nhận đơn vẫn đầy đủ. Cả hai đều ở mức mô phỏng (không có cổng thanh toán thật, không gửi email thật).

| Mã | Chức năng | Hành vi | Cài đặt | Kiểm chứng |
| :--- | :--- | :--- | :--- | :--- |
| FR-33 | Hủy đơn đã thanh toán và hoàn tiền (mô phỏng) | Khách hủy đơn PAID trong `REFUND_WINDOW_MINUTES` (mặc định 5 phút) kể từ lúc thanh toán; đơn chuyển PAID → REFUNDED. Hệ thống trả lại tồn kho, lượt dùng mã giảm giá, điểm đã dùng và thu hồi điểm đã cộng. Quá hạn trả 422; cổng lỗi trả 502 và đơn vẫn PAID để thử lại; không hủy được đơn của người khác (404) | `POST /payments/refund`; trạng thái `OrderStatus.REFUNDED`, `PaymentStatus.REFUNDING/REFUNDED`, loại sổ điểm `REVOKE`; migration `20261111000000_order_refund`; web: nút hủy trong chi tiết đơn | UT-PAY-12…19, UT-SM-03…05 |
| FR-32 | Quên mật khẩu (mô phỏng) | `POST /auth/forgot-password` luôn trả cùng một thông báo dù email có đăng ký hay không (không lộ email). Việc "gửi email" chỉ ghi log `[MOCK EMAIL]`; chưa có liên kết hay luồng đặt lại mật khẩu thật | `auth.controller.ts`, `auth.service.ts` (`forgotPassword`), `dto/auth.dto.ts`; web `/forgotpassword` | Chưa có test tự động |

Hệ quả với phần còn lại của tài liệu: trạng thái đơn trong tài liệu và sơ đồ gồm cả REFUNDED; hoàn tiền không làm thay đổi tiêu chí nghiệm thu của MVP.

#### b) Không thực hiện trong MVP

| Nội dung | Ghi chú | Phân loại |
| :--- | :--- | :--- |
| Giao diện nhân viên quầy; cập nhật trạng thái pha chế (PREPARING, READY, COMPLETED) | Không có vai trò nhân viên trong MVP | Mở rộng (Won’t) |
| Quản trị cửa hàng: thêm/sửa/ẩn sản phẩm, chỉnh tồn kho, quản lý khuyến mãi, tài khoản nhân viên | Dữ liệu được nạp bằng seed | Mở rộng (Won’t) |
| Báo cáo doanh thu, thống kê bán chạy | | Mở rộng (Won’t) |
| Đặt lại đơn cũ bằng một thao tác; đặt lại mật khẩu thật qua email (phần mô phỏng ở 1.3.2a) | | Mở rộng (Won’t) |
| Giao hàng, nhiều chi nhánh, thanh toán thật, chế độ offline | | Không thực hiện |

### 1.3.3. Giả định

| Giả định | Nếu sai thì |
| :--- | :--- |
| Cửa hàng có một điểm bán duy nhất, khách nhận đồ tại quầy | Cần thêm giao hàng, nhiều chi nhánh (đã loại khỏi phạm vi) |
| Khách có điện thoại với trình duyệt hiện đại và kết nối Internet | Cần chế độ offline, tăng công sức PWA |
| Cổng thanh toán là mô phỏng, phản hồi trong vài giây, có thể ép thất bại để demo | Phải xử lý timeout và đối soát thật |
| Mỗi khách được định danh bằng email duy nhất | Cần định danh bằng số điện thoại |
| Giá niêm yết, phụ phí size và giá topping do máy chủ quyết định; tiền tệ là VND, số nguyên | Cần xử lý số thập phân và đa tiền tệ |
| Một điểm thưởng quy đổi 500 đ; mỗi 10.000 đ của tổng đơn sau giảm giá được 1 điểm | Thay đổi hằng số trong cấu hình giá |
| Tồn kho tính theo từng sản phẩm, không tính nguyên liệu | Cần mô hình công thức, nguyên liệu |
| Dữ liệu mẫu (menu, topping, khuyến mãi, tài khoản demo) nạp bằng seed, đủ để kiểm thử và nghiệm thu | Bổ sung seed |
| Nhóm có tài khoản AWS (credit hoặc chi phí thấp) để chạy một máy EC2 (ADR-011) | Chuyển sang VPS khác, vẫn dùng cùng `docker-compose.prod.yml` |

### 1.3.4. Ràng buộc

| Ràng buộc kỹ thuật |
| :--- |
| Frontend bắt buộc dùng Next.js, hướng mobile-first / PWA |
| Backend bắt buộc dùng NestJS, tổ chức theo module / domain |
| Cơ sở dữ liệu bắt buộc là PostgreSQL; có migration và seed tái tạo được |
| Đóng gói và chạy bằng Docker; có `docker-compose.yml` chạy web, API, database ở local |
| Có thể bổ sung công nghệ khác nhưng không thay thế ba thành phần bắt buộc (dự kiến: Prisma, Tailwind CSS, Zustand) |
| Xác thực bằng JWT; mật khẩu không lưu dạng rõ |
| Production truy cập qua HTTPS; database production không public trực tiếp |
| Secret không xuất hiện trong repository hoặc log CI (chỉ commit `.env.example`) |

| Ràng buộc quy trình |
| :--- |
| Năm task thực hiện tuần tự; task sau chỉ nghiệm thu khi task trước đã có tạo phẩm trên kho mã nguồn |
| Mọi thay đổi tài liệu và sơ đồ đi qua commit / pull request, ghi rõ lý do |
| Pull request không được merge nếu lint, test hoặc build thất bại |
| Sơ đồ lưu cả tệp nguồn PlantUML (.puml) và bản kết xuất (.svg) trong `docs/diagrams/` |

### 1.3.5. Rủi ro ban đầu

| Rủi ro | Biện pháp giảm thiểu |
| :--- | :--- |
| Bán quá tồn kho khi nhiều khách đặt cùng lúc | Transaction, cập nhật có điều kiện (stock ≥ số lượng), kiểm thử đồng thời |
| Khách bị trừ tiền hai lần khi bấm thanh toán nhiều lần hoặc mạng chập chờn | Idempotency-Key bắt buộc, ràng buộc unique, kiểm thử gửi lại |
| Tồn kho bị giữ mãi bởi đơn chưa thanh toán | Cho khách hủy đơn; đơn quá hạn tự hủy (FR-27) |
| Trễ tiến độ vì làm tuần tự năm task | Chia Sprint, theo dõi backlog, ưu tiên MoSCoW |
| Triển khai production thất bại hoặc không truy cập được lúc chấm | Thử triển khai sớm từ Sprint 1, health check, smoke test, quy trình rollback |
| Lộ secret (`JWT_SECRET`, mật khẩu CSDL) lên repository hoặc log | `.gitignore`, `.env.example`, secret của CI, rà soát trước mỗi lần merge |
| Tài liệu, sơ đồ và mã nguồn mâu thuẫn nhau | Ma trận truy vết, review chéo, sửa tài liệu cùng pull request với code |
| Chi phí AWS vượt dự kiến, một máy EC2 duy nhất là điểm lỗi, mất dữ liệu | AWS Budgets, volume EBS + snapshot + `pg_dump` định kỳ, seed tái tạo được, quy trình rollback bằng đổi tag image (xem `docs/deployment.md`) |
| Cổng thanh toán mô phỏng chậm hoặc lỗi làm treo thanh toán | Giao dịch PROCESSING có thời hạn 2 phút, xem là thất bại nếu cổng không phản hồi |