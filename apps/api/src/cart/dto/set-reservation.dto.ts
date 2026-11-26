import { IsInt, Max, Min } from 'class-validator';

export class SetReservationDto {
  /** Tổng số ly của sản phẩm trong giỏ (0 = bỏ giữ). Trần = 30 dòng × 20 ly. */
  @IsInt()
  @Min(0)
  @Max(600, { message: 'Số lượng giữ quá lớn' })
  qty: number;
}
