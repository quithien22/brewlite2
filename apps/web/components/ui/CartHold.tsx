"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";

/** Đếm ngược thời gian giữ hàng của một sản phẩm trong giỏ. */
export function CartHoldTimer({ productId }: { productId: number }) {
  const expiresAt = useCartStore((s) => s.holds[productId]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (expiresAt === undefined) return null;
  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <p className="text-xs font-semibold text-[#8A5A00]">
      Giữ hàng còn {mm}:{ss}
    </p>
  );
}

/** Thông báo món đã bị xóa khỏi giỏ vì hết hạn giữ / hết hàng. */
export function CartHoldNotice() {
  const notice = useCartStore((s) => s.notice);
  const setNotice = useCartStore((s) => s.setNotice);
  if (!notice) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-[#FFF3D6] px-4 py-3 text-sm text-[#8A5A00]"
    >
      <span>{notice}</span>
      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => setNotice(null)}
        className="font-bold hover:opacity-70"
      >
        ✕
      </button>
    </div>
  );
}
