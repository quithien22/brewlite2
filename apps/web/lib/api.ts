import { useAuthStore } from "@/store/auth";
import { API_URL } from "./config";
import type {
  CartHold,
  CouponCheck,
  LoyaltyHistoryPage,
  Order,
  OrderPage,
  OrderStatus,
  PaymentMethod,
  PaymentResult,
  Product,
  ProductDetail,
  Promotion,
  RefundResult,
  Session,
  SizeCode,
  User,
} from "./types";

export { API_URL };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
  /** status 0 = không gọi được máy chủ (mất mạng / backend tắt). */
  get isNetwork() {
    return this.status === 0;
  }
}

async function request<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Không thể kết nối tới máy chủ", 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) useAuthStore.getState().logout();
    const msg = data?.message;
    throw new ApiError(
      (Array.isArray(msg) ? msg[0] : msg) ?? "Đã có lỗi xảy ra",
      res.status,
    );
  }
  return data as T;
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface CreateOrderBody {
  items: {
    productId: number;
    size: SizeCode;
    sugar: string;
    ice: string;
    toppingIds: number[];
    qty: number;
  }[];
  /** Giỏ đang giữ tồn kho (xem lib/cart-hold). */
  cartId?: string;
  couponCode?: string;
  pointsToUse?: number;
  note?: string;
}

export const api = {
  products: {
    list: (p: { category?: string; search?: string; featured?: boolean } = {}) =>
      request<Product[]>(`/products${qs(p)}`),
    get: (id: number) => request<ProductDetail>(`/products/${id}`),
  },
  cart: {
    reservations: (cartId: string) =>
      request<CartHold[]>(`/cart/${cartId}/reservations`),
    /** qty = tổng số ly của sản phẩm trong giỏ; 0 = bỏ giữ. */
    reserve: (cartId: string, productId: number, qty: number) =>
      request<CartHold>(`/cart/${cartId}/items/${productId}`, {
        method: "PUT",
        body: { qty },
      }),
  },
  promotions: {
    list: () => request<Promotion[]>("/promotions"),
    validate: (code: string, subtotal: number) =>
      request<CouponCheck>("/promotions/validate", {
        method: "POST",
        body: { code, subtotal },
      }),
  },
  auth: {
    register: (body: {
      name: string;
      email: string;
      phone?: string;
      password: string;
    }) => request<Session>("/auth/register", { method: "POST", body }),
    login: (body: { email: string; password: string }) =>
      request<Session>("/auth/login", { method: "POST", body }),
    /** credential = ID token (JWT) từ Google Identity Services. */
    google: (credential: string) =>
      request<Session>("/auth/google", { method: "POST", body: { credential } }),
    me: () => request<User>("/auth/me"),
    /** Chỉ gửi trường cần đổi. phone = null để xóa số điện thoại. */
    updateProfile: (body: { name?: string; phone?: string | null }) =>
      request<User>("/auth/profile", { method: "PATCH", body }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ message: string }>("/auth/change-password", {
        method: "POST",
        body,
      }),
    forgotPassword: (email: string) =>
      request<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      }),
    /** Bước 2: mã 6 số nhận qua email + mật khẩu mới. */
    resetPassword: (body: { email: string; code: string; newPassword: string }) =>
      request<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body,
      }),
  },
  orders: {
    create: (body: CreateOrderBody) =>
      request<Order>("/orders", { method: "POST", body }),
    mine: (p: {
      status?: OrderStatus;
      month?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    }) => request<OrderPage>(`/orders/me${qs(p)}`),
    get: (id: number) => request<Order>(`/orders/${id}`),
    cancel: (id: number) =>
      request<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  },
  loyalty: {
    history: (p: { page?: number; pageSize?: number } = {}) =>
      request<LoyaltyHistoryPage>(`/loyalty/history${qs(p)}`),
  },
  payments: {
    pay: (
      body: {
        orderId: number;
        method: PaymentMethod;
        simulateFailure?: boolean;
      },
      idempotencyKey: string,
    ) =>
      request<PaymentResult>("/payments", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    /** Hủy đơn đã thanh toán + hoàn tiền (chỉ trong thời hạn cho phép). */
    refund: (orderId: number) =>
      request<RefundResult>("/payments/refund", {
        method: "POST",
        body: { orderId },
      }),
  },
};
