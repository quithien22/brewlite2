import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyHistoryService } from './loyalty-history.service';
import { LoyaltyService } from './loyalty.service';

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyService, LoyaltyHistoryService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
