import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { releaseStock, reserveStock } from '../orders/inventory';

type ReservationDb = Pick<Prisma.TransactionClient, 'product' | 'cartReservation'>;

export interface ReservationState {
  productId: number;
  qty: number;
  expiresAt: Date | null;
}

const changedElsewhere = () =>
  new ConflictException('Giỏ hàng vừa được cập nhật, vui lòng thử lại');

/**
 * Xóa một giữ chỗ và trả hàng về kho. Chỉ trả kho khi chính lệnh này xóa được
 * (tránh trả kho hai lần khi job hết hạn và request của khách chạy cùng lúc).
 * Phải gọi trong transaction.
 */
export async function releaseReservation(
  db: ReservationDb,
  r: { id: number; productId: number; qty: number },
): Promise<boolean> {
  const del = await db.cartReservation.deleteMany({
    where: { id: r.id, qty: r.qty },
  });
  if (del.count !== 1) return false;
  await releaseStock(db, [{ productId: r.productId, qty: r.qty }]);
  return true;
}

/**
 * Đặt số lượng đang giữ của một sản phẩm trong giỏ thành `qty` (0 = bỏ giữ).
 * Chỉ phần chênh lệch được trừ / trả kho. Thời hạn tính từ lần giữ đầu tiên,
 * sửa số lượng KHÔNG gia hạn (tránh giữ kho vô thời hạn).
 * Phải gọi trong transaction.
 */
export async function setReservation(
  db: ReservationDb,
  input: { cartId: string; productId: number; qty: number },
  holdMs: number,
  now = new Date(),
): Promise<ReservationState> {
  const { cartId, productId, qty } = input;
  let current = await db.cartReservation.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });

  // Giữ chỗ đã quá hạn mà job chưa kịp dọn: trả kho rồi giữ lại từ đầu
  if (current && current.expiresAt <= now) {
    if (!(await releaseReservation(db, current))) throw changedElsewhere();
    current = null;
  }

  if (qty === 0) {
    if (current && !(await releaseReservation(db, current))) {
      throw changedElsewhere();
    }
    return { productId, qty: 0, expiresAt: null };
  }

  const held = current?.qty ?? 0;
  if (qty > held) {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { isActive: true },
    });
    if (!product?.isActive) {
      throw new BadRequestException('Sản phẩm không tồn tại hoặc đã ngừng bán');
    }
    // Thiếu hàng → 409, transaction ROLLBACK
    await reserveStock(db, new Map([[productId, qty - held]]));
  } else if (qty < held) {
    await releaseStock(db, [{ productId, qty: held - qty }]);
  }

  if (current) {
    const res = await db.cartReservation.updateMany({
      where: { id: current.id, qty: held },
      data: { qty },
    });
    if (res.count !== 1) throw changedElsewhere();
    return { productId, qty, expiresAt: current.expiresAt };
  }

  const expiresAt = new Date(now.getTime() + holdMs);
  await db.cartReservation.create({
    data: { cartId, productId, qty, expiresAt },
  });
  return { productId, qty, expiresAt };
}

/**
 * Chuyển giữ chỗ của giỏ thành đơn hàng: xóa giữ chỗ, KHÔNG trừ kho lần hai.
 * Giữ dư thì trả phần dư. Trả về số lượng còn thiếu để người gọi trừ kho tiếp.
 * Giữ chỗ quá hạn nhưng chưa bị dọn vẫn đang trừ kho nên được tính như bình thường.
 * Phải gọi trong transaction tạo đơn.
 */
export async function claimReservations(
  db: ReservationDb,
  cartId: string,
  needs: Map<number, number>,
): Promise<Map<number, number>> {
  const missing = new Map(needs);
  const rows = await db.cartReservation.findMany({
    where: { cartId, productId: { in: [...needs.keys()] } },
    orderBy: { productId: 'asc' },
  });

  for (const r of rows) {
    const del = await db.cartReservation.deleteMany({
      where: { id: r.id, qty: r.qty },
    });
    if (del.count !== 1) throw changedElsewhere();

    const need = needs.get(r.productId)!;
    if (r.qty > need) {
      await releaseStock(db, [{ productId: r.productId, qty: r.qty - need }]);
    }
    if (r.qty >= need) missing.delete(r.productId);
    else missing.set(r.productId, need - r.qty);
  }
  return missing;
}
