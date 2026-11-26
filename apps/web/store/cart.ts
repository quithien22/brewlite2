import { create } from "zustand";
import { persist } from "zustand/middleware";
import { releaseCartHolds } from "@/lib/cart-release";
import type { CartLine } from "@/lib/types";

export interface AppliedCoupon {
  code: string;
  title: string;
  discount: number;
}

interface CartState {
  lines: CartLine[];
  note: string;
  coupon: AppliedCoupon | null;
  pointsToUse: number;
  /** Đơn PENDING/PAYMENT_FAILED vừa tạo từ giỏ này (để hủy khi tạo lại). */
  pendingOrderId: number | null;
  /** Mã giỏ (UUID) để máy chủ giữ tồn kho. */
  cartId: string | null;
  /** productId → thời điểm hết giữ hàng (ms, theo đồng hồ máy khách). */
  holds: Record<number, number>;
  /** Thông báo món bị xóa khỏi giỏ (không lưu lại). */
  notice: string | null;
  hydrated: boolean;

  addLine: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setNote: (note: string) => void;
  setCoupon: (coupon: AppliedCoupon | null) => void;
  setPointsToUse: (points: number) => void;
  setPendingOrderId: (id: number | null) => void;
  setCartId: (id: string) => void;
  setHold: (productId: number, expiresAt: number | null) => void;
  removeProducts: (productIds: number[]) => void;
  /** Đã tạo đơn: tồn kho chuyển sang cho đơn giữ. */
  markOrdered: (orderId: number) => void;
  setNotice: (notice: string | null) => void;
}

export const MAX_QTY = 20;

export function makeLineKey(l: Omit<CartLine, "key" | "qty" | "unitPrice">) {
  const tops = l.toppings
    .map((t) => t.id)
    .sort((a, b) => a - b)
    .join(",");
  return `${l.productId}|${l.size}|${l.sugar}|${l.ice}|${tops}`;
}

export const cartCount = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) =>
  lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
/** Tổng số ly của một sản phẩm (gộp mọi tùy chọn). */
export const productQty = (lines: CartLine[], productId: number) =>
  cartCount(lines.filter((l) => l.productId === productId));

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      note: "",
      coupon: null,
      pointsToUse: 0,
      pendingOrderId: null,
      cartId: null,
      holds: {},
      notice: null,
      hydrated: false,

      addLine: (line) =>
        set((s) => {
          const key = makeLineKey(line);
          const found = s.lines.find((l) => l.key === key);
          if (found) {
            return {
              lines: s.lines.map((l) =>
                l.key === key
                  ? {
                      ...l,
                      unitPrice: line.unitPrice,
                      qty: Math.min(MAX_QTY, l.qty + line.qty),
                    }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...s.lines,
              { ...line, key, qty: Math.min(MAX_QTY, line.qty) },
            ],
          };
        }),

      setQty: (key, qty) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.key === key
              ? { ...l, qty: Math.max(1, Math.min(MAX_QTY, qty)) }
              : l,
          ),
        })),

      remove: (key) =>
        set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),

      clear: () => {
        const { cartId, holds } = get();
        if (cartId && Object.keys(holds).length > 0) releaseCartHolds(cartId);
        set({
          lines: [],
          note: "",
          coupon: null,
          pointsToUse: 0,
          pendingOrderId: null,
          holds: {},
          notice: null,
        });
      },

      setNote: (note) => set({ note }),
      setCoupon: (coupon) => set({ coupon }),
      setPointsToUse: (pointsToUse) => set({ pointsToUse }),
      setPendingOrderId: (pendingOrderId) => set({ pendingOrderId }),
      setCartId: (cartId) => set({ cartId }),
      setHold: (productId, expiresAt) =>
        set((s) => {
          const holds = { ...s.holds };
          if (expiresAt === null) delete holds[productId];
          else holds[productId] = expiresAt;
          return { holds };
        }),
      removeProducts: (ids) =>
        set((s) => {
          const holds = { ...s.holds };
          for (const id of ids) delete holds[id];
          return {
            lines: s.lines.filter((l) => !ids.includes(l.productId)),
            holds,
          };
        }),
      markOrdered: (pendingOrderId) =>
        set({ pendingOrderId, holds: {}, notice: null }),
      setNotice: (notice) => set({ notice }),
    }),
    {
      name: "brewlite-cart",
      skipHydration: true,
      partialize: (s) => ({
        lines: s.lines,
        note: s.note,
        coupon: s.coupon,
        pointsToUse: s.pointsToUse,
        pendingOrderId: s.pendingOrderId,
        cartId: s.cartId,
        holds: s.holds,
      }),
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hydrated: true });
      },
    },
  ),
);
