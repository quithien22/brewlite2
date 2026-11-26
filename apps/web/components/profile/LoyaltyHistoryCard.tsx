"use client";

import Link from "next/link";
import { useState } from "react";
import { btnOutline, card } from "@/components/ui/classes";
import { ErrorState, Loading } from "@/components/ui/States";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { LoyaltyHistoryPage, LoyaltyType } from "@/lib/types";

const PAGE_SIZE = 10;

const LABEL: Record<LoyaltyType, string> = {
  EARN: "Tích điểm từ đơn",
  REDEEM: "Dùng điểm cho đơn",
  REFUND: "Hoàn điểm do hủy đơn",
  REVOKE: "Thu hồi điểm do hoàn tiền đơn",
};

/** UC-02: xem lịch sử điểm thưởng (GET /loyalty/history). */
export default function LoyaltyHistoryCard() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<LoyaltyHistoryPage>(
    () => api.loyalty.history({ page, pageSize: PAGE_SIZE }),
    [page],
  );

  return (
    <section className={card}>
      <h2 className="text-base font-bold text-ink">Lịch sử điểm thưởng</h2>

      {error && !data ? (
        <div className="mt-4">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <Loading label="Đang tải lịch sử điểm..." />
      ) : data && data.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Chưa có biến động điểm nào. Điểm sẽ xuất hiện sau khi bạn thanh toán đơn đầu tiên.
        </p>
      ) : data ? (
        <>
          <ul className="mt-3 divide-y divide-line">
            {data.items.map((it) => {
              const plus = it.points > 0;
              return (
                <li key={it.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {LABEL[it.type]}{" "}
                      <Link
                        href={`/orders/detail?id=${it.orderId}`}
                        className="text-brand hover:underline"
                      >
                        {it.orderCode}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(it.createdAt)}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${plus ? "text-ok" : "text-danger"}`}
                  >
                    {plus ? "+" : "−"}
                    {Math.abs(it.points).toLocaleString("vi-VN")}
                  </span>
                </li>
              );
            })}
          </ul>

          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={btnOutline}
              >
                ← Trước
              </button>
              <span className="text-xs text-muted">
                Trang {data.page}/{data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className={btnOutline}
              >
                Sau →
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
