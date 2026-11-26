import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CartReservationService } from './cart-reservation.service';
import { SetReservationDto } from './dto/set-reservation.dto';

/**
 * Giữ tồn kho cho giỏ hàng. Không cần đăng nhập: giỏ được nhận diện bằng
 * cartId (UUID) do trình duyệt sinh.
 */
@Controller('cart/:cartId')
export class CartController {
  constructor(private readonly reservations: CartReservationService) {}

  @Get('reservations')
  list(@Param('cartId', ParseUUIDPipe) cartId: string) {
    return this.reservations.list(cartId);
  }

  @Put('items/:productId')
  set(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: SetReservationDto,
  ) {
    return this.reservations.set(cartId, productId, dto.qty);
  }

  @Delete()
  release(@Param('cartId', ParseUUIDPipe) cartId: string) {
    return this.reservations.releaseCart(cartId);
  }
}
