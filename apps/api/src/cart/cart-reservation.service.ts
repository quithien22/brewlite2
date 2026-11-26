import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cartHoldMs } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { releaseReservation, setReservation } from './reservations';

const SWEEP_INTERVAL_MS = 30_000;
const TX_OPTIONS = { timeout: 15000, maxWait: 10000 };

/** Giữ tồn kho cho giỏ hàng và tự trả kho khi quá hạn. */
@Injectable()
export class CartReservationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CartReservationService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.releaseExpired().catch((e) =>
        this.logger.error(
          `Trả kho giữ chỗ quá hạn thất bại: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }, SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Các giữ chỗ còn hạn của giỏ. `expiresInMs` để client không phụ thuộc đồng hồ máy khách. */
  async list(cartId: string) {
    await this.releaseExpired();
    const now = Date.now();
    const rows = await this.prisma.cartReservation.findMany({
      where: { cartId, expiresAt: { gt: new Date(now) } },
      orderBy: { productId: 'asc' },
    });
    return rows.map((r) => ({
      productId: r.productId,
      qty: r.qty,
      expiresInMs: r.expiresAt.getTime() - now,
    }));
  }

  async set(cartId: string, productId: number, qty: number) {
    // Dọn trước để số tồn kho khả dụng chính xác
    await this.releaseExpired();
    try {
      const state = await this.prisma.$transaction(
        (tx) =>
          setReservation(tx, { cartId, productId, qty }, cartHoldMs()),
        TX_OPTIONS,
      );
      return {
        productId,
        qty: state.qty,
        expiresInMs: state.expiresAt
          ? Math.max(0, state.expiresAt.getTime() - Date.now())
          : 0,
      };
    } catch (e) {
      // Hai request cùng tạo giữ chỗ cho một sản phẩm: một bên bị ROLLBACK
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Giỏ hàng vừa được cập nhật, vui lòng thử lại',
        );
      }
      throw e;
    }
  }

  /** Bỏ toàn bộ giỏ: trả kho ngay. */
  async releaseCart(cartId: string) {
    const rows = await this.prisma.cartReservation.findMany({
      where: { cartId },
      orderBy: { productId: 'asc' },
    });
    return { released: await this.releaseRows(rows) };
  }

  /** Trả kho các giữ chỗ quá hạn. Trả về số giữ chỗ đã xóa. */
  async releaseExpired(now = new Date()): Promise<number> {
    const rows = await this.prisma.cartReservation.findMany({
      where: { expiresAt: { lte: now } },
      orderBy: { productId: 'asc' },
      take: 200,
    });
    return this.releaseRows(rows);
  }

  private async releaseRows(
    rows: { id: number; productId: number; qty: number }[],
  ) {
    let released = 0;
    for (const row of rows) {
      const ok = await this.prisma.$transaction(
        (tx) => releaseReservation(tx, row),
        TX_OPTIONS,
      );
      if (ok) released++;
    }
    return released;
  }
}
