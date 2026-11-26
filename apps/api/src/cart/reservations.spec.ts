import { ConflictException } from '@nestjs/common';
import {
  claimReservations,
  releaseReservation,
  setReservation,
} from './reservations';

type Db = Parameters<typeof setReservation>[0];
interface Row {
  id: number;
  cartId: string;
  productId: number;
  qty: number;
  expiresAt: Date;
}

const HOLD = 15 * 60_000;
const T0 = new Date('2026-11-26T10:00:00Z');
const after = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

/** CSDL giả lập: 1 sản phẩm + bảng giữ chỗ. */
function makeDb(initialStock: number) {
  const product = { name: 'Cà phê sữa', stock: initialStock, version: 0, isActive: true };
  const rows: Row[] = [];
  let nextId = 1;
  const match = (r: Row, w: { id: number; qty: number }) =>
    r.id === w.id && r.qty === w.qty;

  const db = {
    product: {
      findUnique: async () => ({ ...product }),
      updateMany: async ({ data }: any) => {
        product.stock -= data.stock.decrement ?? 0;
        product.stock += data.stock.increment ?? 0;
        product.version += 1;
        return { count: 1 };
      },
    },
    cartReservation: {
      findUnique: async ({ where }: any) => {
        const k = where.cartId_productId;
        const r = rows.find((x) => x.cartId === k.cartId && x.productId === k.productId);
        return r ? { ...r } : null;
      },
      findMany: async ({ where }: any) =>
        rows
          .filter((r) => r.cartId === where.cartId && where.productId.in.includes(r.productId))
          .map((r) => ({ ...r })),
      create: async ({ data }: any) => {
        const r = { id: nextId++, ...data };
        rows.push(r);
        return r;
      },
      updateMany: async ({ where, data }: any) => {
        const r = rows.find((x) => match(x, where));
        if (!r) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
      deleteMany: async ({ where }: any) => {
        const i = rows.findIndex((x) => match(x, where));
        if (i < 0) return { count: 0 };
        rows.splice(i, 1);
        return { count: 1 };
      },
    },
  };

  return { db: db as unknown as Db, product, rows };
}

const set = (db: Db, qty: number, now = T0) =>
  setReservation(db, { cartId: 'c1', productId: 1, qty }, HOLD, now);

describe('Giữ tồn kho khi thêm vào giỏ (15 phút)', () => {
  it('thêm vào giỏ thì trừ tồn kho ngay và đặt hạn 15 phút', async () => {
    const { db, product } = makeDb(10);
    const r = await set(db, 3);
    expect(product.stock).toBe(7);
    expect(r.expiresAt).toEqual(after(15));
  });

  it('đổi số lượng chỉ trừ / trả phần chênh lệch và không gia hạn', async () => {
    const { db, product } = makeDb(10);
    await set(db, 3);
    const up = await set(db, 5, after(10));
    expect(product.stock).toBe(5);
    expect(up.expiresAt).toEqual(after(15));
    await set(db, 1, after(11));
    expect(product.stock).toBe(9);
  });

  it('bỏ khỏi giỏ thì trả kho', async () => {
    const { db, product, rows } = makeDb(10);
    await set(db, 4);
    await set(db, 0);
    expect(product.stock).toBe(10);
    expect(rows).toHaveLength(0);
  });

  it('không giữ quá số lượng còn lại', async () => {
    const { db, product } = makeDb(2);
    await expect(set(db, 3)).rejects.toBeInstanceOf(ConflictException);
    expect(product.stock).toBe(2);
  });

  it('giữ chỗ quá hạn được trả kho trước khi giữ lại', async () => {
    const { db, product } = makeDb(10);
    await set(db, 4);
    const r = await set(db, 2, after(16));
    expect(product.stock).toBe(8);
    expect(r.expiresAt).toEqual(after(31));
  });

  it('chỉ trả kho một lần cho mỗi giữ chỗ', async () => {
    const { db, product, rows } = makeDb(10);
    await set(db, 4);
    const row = { ...rows[0] };
    expect(await releaseReservation(db, row)).toBe(true);
    expect(await releaseReservation(db, row)).toBe(false);
    expect(product.stock).toBe(10);
  });

  it('tạo đơn dùng lại phần đã giữ, không trừ kho lần hai', async () => {
    const { db, product, rows } = makeDb(10);
    await set(db, 3);
    const missing = await claimReservations(db, 'c1', new Map([[1, 3]]));
    expect(missing.size).toBe(0);
    expect(product.stock).toBe(7);
    expect(rows).toHaveLength(0);
  });

  it('tạo đơn: giữ dư thì trả kho, giữ thiếu thì báo phần còn thiếu', async () => {
    const more = makeDb(10);
    await set(more.db, 5);
    await claimReservations(more.db, 'c1', new Map([[1, 2]]));
    expect(more.product.stock).toBe(8);

    const less = makeDb(10);
    await set(less.db, 2);
    const missing = await claimReservations(less.db, 'c1', new Map([[1, 5]]));
    expect(missing.get(1)).toBe(3);
  });
});
