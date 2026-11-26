import { Module } from '@nestjs/common';
import { CartReservationService } from './cart-reservation.service';
import { CartController } from './cart.controller';

@Module({
  controllers: [CartController],
  providers: [CartReservationService],
})
export class CartModule {}
