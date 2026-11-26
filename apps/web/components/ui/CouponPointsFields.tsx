"use client";

import { useEffect, useState } from "react";
import { btnOutline, card, input } from "@/components/ui/classes";
import { api, ApiError } from "@/lib/api";
import { POINT_VALUE, vnd } from "@/lib/format";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";

interface Props {
  /** Tạm tính của giỏ hàng, dùng để kiểm tra mã */
  subtotal: number;
  /** Số tiền mã đang giảm */
  discount: number;
  /** Số điểm đang áp dụng (đã chặn theo maxPoints) */
  points: number;
  /** Số điểm tối đa dùng được cho đơn này */
  maxPoints: number;
  disabled?: boolean;
}

/**
 * Mã giảm giá và điểm thưởng ở bước "Xác nhận đơn hàng".
 * Chỉ dùng khi đơn CHƯA được tạo: sau khi tạo đơn, lượt mã và điểm đã được máy chủ giữ.
 */
export default function CouponPointsFields({
  subtotal,
  discount,
  points,
  maxPoints,
  disabled = false,
}: Props) {
  const coupon = useCartStore((s) => s.coupon);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const setPointsToUse = useCartStore((s) => s.setPointsToUse);
  const balance = useAuthStore((s) => s.user?.loyaltyPoints ?? 0);

  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // Kiểm tra lại mã đang chọn (hết hạn, hết lượt, chưa đủ đơn tối thiểu)
  useEffect(() => {
    if (!coupon || subtotal <= 0) return;
    let off = false;
    api.promotions
      .validate(coupon.code, subtotal)
      .then((r) => {
        if (off) return;
        if (!r.valid) {
          setCoupon(null);
          setMessage({ ok: false, text: r.message });
        } else if (r.discount !== coupon.discount) {
          setCoupon({
            code: r.code,
            title: r.title ?? coupon.title,
            discount: r.discount,
          });
        }
      })
      .catch(() => {});
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, coupon?.code]);

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value) return;
    setChecking(true);
    setMessage(null);
    try {
      const r = await api.promotions.validate(value, subtotal);
      if (r.valid) {
        setCoupon({ code: r.code, title: r.title ?? r.code, discount: r.discount });
        setCode("");
      }
      setMessage({ ok: r.valid, text: r.message });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof ApiError ? err.message : "Không kiểm tra được mã",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <section className={card}>
        <h2 className="mb-3 text-base font-bold text-ink">Mã giảm giá</h2>
        {coupon ? (
          <div className="flex flex-col gap-2 rounded-lg bg-[#E6F3EA] px-4 py-3 text-sm text-[#1E7A43] sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-bold">{coupon.code}</span> · {coupon.title} ·{" "}
              <span className="font-semibold">−{vnd(discount)}</span>
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setCoupon(null);
                setMessage(null);
              }}
              className="font-bold hover:underline disabled:opacity-50"
            >
              Bỏ mã
            </button>
          </div>
        ) : (
          <form onSubmit={applyCoupon} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Nhập mã (ví dụ CHAO10)"
              maxLength={30}
              aria-label="Mã giảm giá"
              disabled={disabled}
              className={input}
            />
            <button
              type="submit"
              disabled={disabled || checking || !code.trim()}
              className={`${btnOutline} shrink-0 disabled:opacity-50`}
            >
              {checking ? "Đang kiểm tra..." : "Áp dụng"}
            </button>
          </form>
        )}
        {message && (
          <p
            role="status"
            className={`mt-2.5 text-sm font-medium ${message.ok ? "text-ok" : "text-danger"}`}
          >
            {message.text}
          </p>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 text-base font-bold text-ink">Điểm thưởng</h2>
        {balance <= 0 ? (
          <p className="text-sm text-muted">
            Bạn chưa có điểm. Mỗi 10.000đ trong đơn sẽ được cộng 1 điểm.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              Bạn có <b className="text-ink">{balance}</b> điểm · 1 điểm = {vnd(POINT_VALUE)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={0}
                max={maxPoints}
                value={points}
                onChange={(e) =>
                  setPointsToUse(
                    Math.max(0, Math.min(maxPoints, Math.floor(Number(e.target.value) || 0))),
                  )
                }
                aria-label="Số điểm muốn dùng"
                disabled={disabled}
                className={`${input} max-w-[140px]`}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPointsToUse(maxPoints)}
                className={`${btnOutline} disabled:opacity-50`}
              >
                Dùng tối đa ({maxPoints})
              </button>
              {points > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setPointsToUse(0)}
                  className="flex min-h-[44px] items-center px-2 text-sm font-semibold text-muted hover:text-danger"
                >
                  Bỏ
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
