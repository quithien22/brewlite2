import { API_URL } from "./config";

/**
 * Trả kho toàn bộ giữ chỗ của giỏ (khi xóa giỏ / đăng xuất). Không chờ kết quả:
 * nếu lỗi mạng thì máy chủ vẫn tự trả kho khi hết hạn.
 * Tách riêng khỏi lib/api để store/cart không bị phụ thuộc vòng.
 */
export function releaseCartHolds(cartId: string) {
  void fetch(`${API_URL}/cart/${cartId}`, {
    method: "DELETE",
    keepalive: true,
  }).catch(() => {});
}
