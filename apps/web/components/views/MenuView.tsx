"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import ProductCard from "@/components/product/ProductCard";
import { container, input } from "@/components/ui/classes";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
export default function MenuView() {
  const router = useRouter();
  const params = useSearchParams();
  const category = params.get("category") ?? "";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortOrder, setSortOrder] = useState<
    "default" | "price-asc" | "price-desc"
  >("default");

  const { data, error, loading, reload } = useApi(
    () => api.products.list({}),
    [],
  );

  // Chỉ dùng dữ liệu thật từ GET /products (Sequence-01a), không có danh sách dự phòng viết cứng
  const products = useMemo(() => data ?? [], [data]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))],
    [products],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: products.length,
    };
    for (const p of products) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (category && p.category !== category) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (onlyFeatured && !p.isFeatured) return false;
      if (onlyInStock && !p.inStock) return false;
      return true;
    });

    if (sortOrder === "price-asc") {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortOrder === "price-desc") {
      return [...list].sort((a, b) => b.price - a.price);
    }
    return list;
  }, [products, category, search, onlyFeatured, onlyInStock, sortOrder]);

  const hasActiveFilters = Boolean(
    category ||
      search.trim() ||
      onlyFeatured ||
      onlyInStock ||
      sortOrder !== "default",
  );

  function resetFilters() {
    setSearch("");
    setOnlyFeatured(false);
    setOnlyInStock(false);
    setSortOrder("default");
    router.replace("/menu", { scroll: false });
  }

  function pickCategory(c: string) {
    router.replace(c ? `/menu?category=${encodeURIComponent(c)}` : "/menu", {
      scroll: false,
    });
  }

  return (
    <div className={`${container} py-6 sm:py-10`}>
      {/* Header & Search */}
      <div className="mb-5 flex flex-col gap-4 sm:mb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-[32px]">Thực đơn</h1>
          <p className="mt-1 text-sm text-muted">
            Chọn món, chọn size và topping — thanh toán không tiền mặt chỉ trong vài chạm.
          </p>
        </div>

        {/* Ô tìm kiếm thông minh */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên đồ uống..."
            aria-label="Tìm đồ uống"
            className={`${input} pr-10 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-cream text-xs font-bold text-muted transition hover:bg-line hover:text-ink cursor-pointer"
              aria-label="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Danh mục có gắn số lượng món */}
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mb-4 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <button
          onClick={() => pickCategory("")}
          className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition cursor-pointer ${
            !category
              ? "border-brand bg-brand text-white shadow-xs"
              : "border-line bg-white text-ink hover:border-brand"
          }`}
        >
          Tất cả ({categoryCounts.all ?? 0})
        </button>
        {categories.map((c) => {
          const active = c === category;
          return (
            <button
              key={c}
              onClick={() => pickCategory(c)}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                active
                  ? "border-brand bg-brand text-white shadow-xs"
                  : "border-line bg-white text-ink hover:border-brand"
              }`}
            >
              {c} ({categoryCounts[c] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Row 2: Bộ lọc thông minh & Sắp xếp giá */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream/40 border border-line/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider hidden sm:inline mr-1">
            Lọc theo:
          </span>

          {/* Toggle Món bán chạy */}
          <button
            type="button"
            onClick={() => setOnlyFeatured((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              onlyFeatured
                ? "border-brand bg-brand text-white shadow-xs"
                : "border-line bg-white text-ink hover:border-brand"
            }`}
          >
            <span>🔥</span>
            <span>Món bán chạy</span>
          </button>

          {/* Toggle Chỉ món còn hàng */}
          <button
            type="button"
            onClick={() => setOnlyInStock((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              onlyInStock
                ? "border-[#1E7A43] bg-[#1E7A43] text-white shadow-xs"
                : "border-line bg-white text-ink hover:border-brand"
            }`}
          >
            <span>✓</span>
            <span>Chỉ món còn hàng</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          {/* Dropdown sắp xếp theo giá */}
          <select
            value={sortOrder}
            onChange={(e) =>
              setSortOrder(
                e.target.value as "default" | "price-asc" | "price-desc",
              )
            }
            className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand focus:outline-none cursor-pointer"
            aria-label="Sắp xếp theo giá"
          >
            <option value="default">Sắp xếp: Mặc định</option>
            <option value="price-asc">Giá: Thấp → Cao</option>
            <option value="price-desc">Giá: Cao → Thấp</option>
          </select>

          {/* Nút xóa bộ lọc */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold text-muted hover:text-danger hover:underline cursor-pointer px-1 py-1"
            >
              Xóa bộ lọc ✕
            </button>
          )}
        </div>
      </div>

      {/* Hiển thị số lượng món tìm thấy */}
      {data && (
        <div className="mb-4 flex items-center justify-between text-xs text-muted font-medium">
          <span>
            Đang hiển thị <strong className="text-ink">{visible.length}</strong> món đồ uống
          </span>
        </div>
      )}

      {loading && !data ? (
        <Loading label="Đang tải thực đơn..." />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <EmptyState
          title="Thực đơn đang trống"
          description="Hiện cửa hàng chưa có đồ uống nào đang bán. Bạn quay lại sau nhé."
          href="/"
          action="Về trang chủ"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Không tìm thấy đồ uống phù hợp"
          description="Thử đổi từ khóa hoặc xóa bớt bộ lọc để xem các món khác nhé."
          href="/menu"
          action="Xem tất cả thực đơn"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
