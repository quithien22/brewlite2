import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyHistoryQuery } from './dto/loyalty-history.query';

/** Chiều cộng / trừ của từng loại bút toán (points trong DB luôn dương). */
const SIGN = { EARN: 1, REFUND: 1, REDEEM: -1, REVOKE: -1 } as const;

/** Đọc sổ điểm thưởng của một khách (UC-02: Xem lịch sử điểm thưởng). */
@Injectable()
export class LoyaltyHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /loyalty/history — mới nhất trước, có phân trang. Chỉ trả bút toán của chính khách. */
  async list(userId: number, q: LoyaltyHistoryQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 10;

    const [total, rows, user] = await this.prisma.$transaction([
      this.prisma.loyaltyTransaction.count({ where: { userId } }),
      this.prisma.loyaltyTransaction.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { loyaltyPoints: true },
      }),
    ]);

    return {
      balance: user?.loyaltyPoints ?? 0,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        /** Có dấu: EARN / REFUND là dương, REDEEM / REVOKE là âm. */
        points: SIGN[r.type] * r.points,
        orderId: r.orderId,
        orderCode: `#${r.orderId}`,
        createdAt: r.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
