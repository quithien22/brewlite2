import { useAuthStore } from "@/store/auth";
import { MAX_QTY, makeLineKey, productQty, useCartStore } from "@/store/cart";
import { api, ApiError, type CreateOrderBody } from "./api";
import type { CartLine } from "./types";

/**
 * Đồng bộ giỏ hàng với giữ chỗ tồn kho trên máy chủ:
 * thêm vào giỏ = trừ kho và giữ 15 phút; quá hạn chưa đặt = xóa khỏi giỏ.
 * Khi giỏ đã thành đơn (pendingOrderId) thì kho do đơn giữ, không giữ chỗ thêm.
 */

export type CartResult = { ok: true } | { ok: false; message: string };

const SYNC_INTERVAL_MS = 30_000;
const cart = () => useCartStore.getState();

// Chạy tuần tự để hai thao tác giỏ hàng không ghi đè lên nhau
let queue: Promise<unknown> = Promise.resolve();
function run<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task);
  queue = next.catch(() => {});
  return next;
}

function newCartId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Trang chạy qua http (không phải localhost) không có randomUUID
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

function ensureCartId(): string {
  let id = cart().cartId;
  if (!id) {
    id = newCartId();
    cart().setCartId(id);
  }
  return id;
}

/** Đặt số ly đang giữ của một sản phẩm và ghi lại thời hạn. */
async function hold(productId: number, qty: number) {
  const res = await api.cart.reserve(ensureCartId(), productId, qty);
  cart().setHold(productId, res.qty > 0 ? Date.now() + res.expiresInMs : null);
}

const cartProductIds = () => [...new Set(cart().lines.map((l) => l.productId))];

function drop(productIds: number[], reason: string) {
  if (productIds.length === 0) return;
  const names = [
    ...new Set(
      cart()
        .lines.filter((l) => productIds.includes(l.productId))
        .map((l) => l.name),
    ),
  ];
  cart().removeProducts(productIds);
  if (names.length) cart().setNotice(`${reason}: ${names.join(", ")}.`);
}

const EXPIRED = "Đã quá thời gian giữ hàng, món sau được xóa khỏi giỏ";

/** Xóa ngay các món đã hết hạn giữ (không cần gọi máy chủ). */
export function removeExpired(now = Date.now()) {
  const { hydrated, pendingOrderId, holds } = cart();
  if (!hydrated || pendingOrderId !== null) return;
  drop(
    cartProductIds().filter((id) => holds[id] !== undefined && holds[id] <= now),
    EXPIRED,
  );
}

/**
 * Kiểm tra đơn đang chờ của giỏ.
 * "active": còn chờ thanh toán; "unknown": chưa kiểm tra được; "none": không còn đơn.
 */
async function settlePending(): Promise<"none" | "active" | "unknown"> {
  const id = cart().pendingOrderId;
  if (id === null) return "none";
  if (!useAuthStore.getState().token) return "unknown";
  try {
    const order = await api.orders.get(id);
    if (order.status === "PENDING" || order.status === "PAYMENT_FAILED") {
      return "active";
    }
    if (order.status === "PAID") cart().clear();
    else cart().setPendingOrderId(null);
    return "none";
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      cart().setPendingOrderId(null);
      return "none";
    }
    return "unknown";
  }
}

/** Giữ lại hàng cho toàn bộ giỏ; món không giữ được thì xóa khỏi giỏ. */
async function holdWholeCart() {
  const failed: number[] = [];
  for (const id of cartProductIds()) {
    try {
      await hold(id, productQty(cart().lines, id));
    } catch {
      failed.push(id);
    }
  }
  drop(failed, "Không còn đủ hàng để giữ, món sau được xóa khỏi giỏ");
}

/** Lấy máy chủ làm chuẩn: món không còn giữ chỗ thì xóa khỏi giỏ. */
async function reconcile() {
  const cartId = cart().cartId;
  // Giỏ lưu từ phiên bản cũ chưa có giữ chỗ
  if (!cartId) return holdWholeCart();

  const rows = await api.cart.reservations(cartId);
  const receivedAt = Date.now();
  const server = new Map(rows.map((r) => [r.productId, r]));
  const ids = cartProductIds();
  const lost: number[] = [];

  for (const id of ids) {
    const row = server.get(id);
    const qty = productQty(cart().lines, id);
    if (!row) lost.push(id);
    else if (row.qty === qty) cart().setHold(id, receivedAt + row.expiresInMs);
    else {
      try {
        await hold(id, qty);
      } catch (e) {
        if (!(e instanceof ApiError && e.isNetwork)) lost.push(id);
      }
    }
  }
  // Máy chủ còn giữ món đã bỏ khỏi giỏ (lần bỏ trước bị lỗi mạng)
  for (const row of rows) {
    if (!ids.includes(row.productId)) await hold(row.productId, 0);
  }
  drop(lost, EXPIRED);
}

let syncing = false;
export function syncCart() {
  if (syncing || !cart().hydrated) return;
  syncing = true;
  run(async () => {
    removeExpired();
    if ((await settlePending()) !== "none") return;
    const { lines, holds } = cart();
    if (lines.length || Object.keys(holds).length) await reconcile();
  })
    .catch(() => {}) // mất mạng: thử lại ở lượt sau
    .finally(() => {
      syncing = false;
    });
}

/** Chạy khi mở ứng dụng. Trả về hàm dọn dẹp. */
export function startCartHoldWatcher() {
  const expiry = window.setInterval(() => removeExpired(), 1000);
  const sync = window.setInterval(syncCart, SYNC_INTERVAL_MS);
  window.addEventListener("focus", syncCart);
  syncCart();
  return () => {
    window.clearInterval(expiry);
    window.clearInterval(sync);
    window.removeEventListener("focus", syncCart);
  };
}

const fail = (e: unknown): CartResult => ({
  ok: false,
  message: e instanceof ApiError ? e.message : "Không giữ được hàng, vui lòng thử lại",
});

const PENDING_MESSAGE =
  "Bạn đang có đơn chờ thanh toán. Hãy thanh toán hoặc hủy đơn đó trước khi thêm món.";

/** Kiểm tra trước khi tăng số lượng trong giỏ. */
async function prepareIncrease(): Promise<CartResult> {
  removeExpired();
  const hadPending = cart().pendingOrderId !== null;
  const pending = await settlePending();
  if (pending === "active") return { ok: false, message: PENDING_MESSAGE };
  if (pending === "unknown") {
    return {
      ok: false,
      message: "Chưa kiểm tra được đơn đang chờ. Hãy đăng nhập hoặc thử lại.",
    };
  }
  if (hadPending) await reconcile();
  return { ok: true };
}

/** Giữ hàng trước, giữ được mới đưa vào giỏ. */
export function addToCart(line: Omit<CartLine, "key">): Promise<CartResult> {
  return run(async (): Promise<CartResult> => {
    const ready = await prepareIncrease();
    if (!ready.ok) return ready;

    const { lines } = cart();
    const inLine = lines.find((l) => l.key === makeLineKey(line))?.qty ?? 0;
    const added = Math.min(MAX_QTY, inLine + line.qty) - inLine;
    if (added <= 0) {
      return { ok: false, message: `Mỗi món tối đa ${MAX_QTY} ly` };
    }
    await hold(line.productId, productQty(lines, line.productId) + added);
    cart().addLine(line);
    return { ok: true };
  }).catch(fail);
}

export function changeQty(key: string, qty: number): Promise<CartResult> {
  return run(async (): Promise<CartResult> => {
    let line = cart().lines.find((l) => l.key === key);
    if (!line) return { ok: true };
    const next = Math.max(1, Math.min(MAX_QTY, qty));

    // Giảm khi đã có đơn chờ: chỉ sửa giỏ, kho đang do đơn giữ
    if (next < line.qty && cart().pendingOrderId !== null) {
      cart().setQty(key, next);
      return { ok: true };
    }
    if (next > line.qty) {
      const ready = await prepareIncrease();
      if (!ready.ok) return ready;
    } else {
      removeExpired();
    }
    line = cart().lines.find((l) => l.key === key);
    if (!line) return { ok: true };

    const total = productQty(cart().lines, line.productId) - line.qty + next;
    await hold(line.productId, total);
    cart().setQty(key, next);
    return { ok: true };
  }).catch(fail);
}

/** Bỏ món khỏi giỏ và trả kho phần đang giữ. */
export function removeLine(key: string): Promise<void> {
  return run(async () => {
    const line = cart().lines.find((l) => l.key === key);
    if (!line) return;
    cart().remove(key);
    const { holds, pendingOrderId, lines } = cart();
    if (pendingOrderId !== null || holds[line.productId] === undefined) return;
    const left = productQty(lines, line.productId);
    if (left === 0) cart().setHold(line.productId, null);
    await hold(line.productId, left);
  }).catch(() => {}); // lỗi mạng: lần đồng bộ sau hoặc hết hạn sẽ trả kho
}

/** Tạo đơn từ giỏ: máy chủ chuyển phần đang giữ sang đơn. */
export function placeOrder(body: Omit<CreateOrderBody, "cartId">) {
  return run(async () => {
    const order = await api.orders.create({
      ...body,
      cartId: cart().cartId ?? undefined,
    });
    cart().markOrdered(order.id);
    return order;
  });
}

/** Khách hủy đơn: nếu là đơn của giỏ hiện tại thì giữ hàng lại cho giỏ (15 phút mới). */
export function cancelOrder(orderId: number) {
  return run(async () => {
    const order = await api.orders.cancel(orderId);
    if (cart().pendingOrderId === orderId) {
      await holdWholeCart();
      cart().setPendingOrderId(null);
    }
    return order;
  });
}
