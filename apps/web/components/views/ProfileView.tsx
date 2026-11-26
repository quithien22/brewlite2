"use client";

import Link from "next/link";
import { useState } from "react";
import ChangePasswordCard from "@/components/profile/ChangePasswordCard";
import LoyaltyHistoryCard from "@/components/profile/LoyaltyHistoryCard";
import ProfileInfoCard from "@/components/profile/ProfileInfoCard";
import { btnOutline, btnPrimary, card, container } from "@/components/ui/classes";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { api } from "@/lib/api";
import { POINT_VALUE, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { User } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

/** UC-02: xem / cập nhật hồ sơ, đổi mật khẩu, xem điểm và lịch sử điểm thưởng. */
export default function ProfileView() {
  // Chưa đăng nhập thì hiện thông báo (giống lịch sử đơn) thay vì tự chuyển sang /login
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const ready = hydrated && !!token;
  // Hồ sơ vừa sửa xong: hiển thị ngay, không cần tải lại cả trang
  const [edited, setEdited] = useState<User | null>(null);

  // Luôn lấy lại từ máy chủ để số điểm là mới nhất
  const { data, error, loading, reload } = useApi<User | null>(
    () =>
      ready
        ? api.auth.me().then((u) => {
            setUser(u);
            return u;
          })
        : Promise.resolve(null),
    [ready],
  );

  if (!hydrated) return <Loading />;

  if (!token) {
    return (
      <div className={`${container} py-6 sm:py-10`}>
        <h1 className="mb-6 text-2xl font-bold text-ink sm:text-[32px]">Hồ sơ của tôi</h1>
        <EmptyState
          title="Bạn cần đăng nhập để xem hồ sơ"
          description="Đăng nhập để xem thông tin tài khoản và điểm thưởng."
          href="/login?next=/profile"
          action="Đăng nhập"
        />
        <p className="mt-4 text-center text-sm text-muted">
          Chưa có tài khoản?{" "}
          <Link href="/register?next=/profile" className="font-bold text-brand hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    );
  }

  // Không dùng dữ liệu lưu sẵn trong trình duyệt khi chưa lấy được từ máy chủ
  if (error && !data) {
    return (
      <div className={`${container} py-6 sm:py-10`}>
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (loading || !data) return <Loading label="Đang tải hồ sơ..." />;

  const profile = edited ?? data;

  return (
    <div className={`${container} py-6 sm:py-10`}>
      <h1 className="mb-5 text-2xl font-bold text-ink sm:mb-6 sm:text-[32px]">Hồ sơ của tôi</h1>

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="flex flex-col gap-4 sm:gap-6">
          <ProfileInfoCard
            user={profile}
            onSaved={(u) => {
              setEdited(u);
              setUser(u);
            }}
          />
          <ChangePasswordCard />
        </div>

        <div className="flex flex-col gap-4 sm:gap-6">
          <section className={card}>
            <h2 className="text-base font-bold text-ink">Điểm thưởng</h2>
            <p className="mt-2 text-[32px] font-bold text-brand">
              {data.loyaltyPoints.toLocaleString("vi-VN")} điểm
            </p>
            <p className="text-sm text-muted">
              Tương đương {vnd(data.loyaltyPoints * POINT_VALUE)} khi thanh toán.
            </p>
            <p className="mt-3 text-xs text-muted">
              1 điểm = {vnd(POINT_VALUE)}. Mỗi 10.000đ trong tổng đơn sau giảm giá được cộng 1 điểm
              khi thanh toán thành công.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <Link href="/menu" className={btnPrimary}>
                Đặt món để tích điểm
              </Link>
              <Link href="/orders" className={btnOutline}>
                Xem lịch sử đơn hàng
              </Link>
            </div>
          </section>

          <LoyaltyHistoryCard />
        </div>
      </div>
    </div>
  );
}
