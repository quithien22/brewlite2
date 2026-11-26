-- Số điện thoại là duy nhất (UC-02: kiểm tra trùng email / SĐT)

-- Dọn dữ liệu cũ trước khi tạo ràng buộc: nếu một số điện thoại đang gắn với nhiều tài khoản,
-- giữ lại cho tài khoản tạo sớm nhất, các tài khoản còn lại được bỏ trống số điện thoại.
-- (Xem trước bằng: SELECT "phone", COUNT(*) FROM "User" WHERE "phone" IS NOT NULL GROUP BY "phone" HAVING COUNT(*) > 1;)
UPDATE "User" AS u
SET "phone" = NULL
WHERE u."phone" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "User" AS o
    WHERE o."phone" = u."phone" AND o."id" < u."id"
  );

-- CreateIndex (nhiều tài khoản không có số điện thoại vẫn hợp lệ vì NULL không bị coi là trùng)
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
