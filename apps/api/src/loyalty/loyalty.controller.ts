import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/auth.guards';
import type { AuthUser } from '../auth/jwt.strategy';
import { LoyaltyHistoryQuery } from './dto/loyalty-history.query';
import { LoyaltyHistoryService } from './loyalty-history.service';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly history: LoyaltyHistoryService) {}

  /** GET /loyalty/history — lịch sử điểm thưởng của user đang đăng nhập */
  @Get('history')
  list(@CurrentUser() user: AuthUser, @Query() query: LoyaltyHistoryQuery) {
    return this.history.list(user.id, query);
  }
}
