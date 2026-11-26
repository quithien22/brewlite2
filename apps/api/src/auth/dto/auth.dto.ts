import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** AC-01.4: email chuẩn hóa chữ thường, cắt khoảng trắng trước khi lưu. */
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @IsString({ message: 'Họ tên không hợp lệ' })
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  @MaxLength(80)
  name: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  /** 0xxxxxxxxx hoặc +84xxxxxxxxx (AC-01.3) */
  @IsOptional()
  @Matches(/^(0\d{9}|\+84\d{9})$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Mật khẩu cần có cả chữ và số',
  })
  password: string;
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;
}

/** POST /auth/reset-password: email + mã 6 số nhận qua email + mật khẩu mới. */
export class ResetPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^\d{6}$/, { message: 'Mã xác nhận gồm 6 chữ số' })
  code: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Mật khẩu mới cần có cả chữ và số',
  })
  newPassword: string;
}

export class GoogleLoginDto {
  /** ID token (JWT) do Google Identity Services trả về ở trình duyệt. */
  @IsString({ message: 'Thiếu mã xác thực Google' })
  @MinLength(20, { message: 'Mã xác thực Google không hợp lệ' })
  @MaxLength(4096)
  credential: string;
}

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Chuỗi rỗng nghĩa là xóa số điện thoại (lưu null). */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/** PATCH /auth/profile: chỉ gửi trường nào cần đổi. Email không đổi được (dùng để đăng nhập). */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Họ tên không hợp lệ' })
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  @MaxLength(80, { message: 'Họ tên tối đa 80 ký tự' })
  name?: string;

  /** 0xxxxxxxxx hoặc +84xxxxxxxxx; gửi chuỗi rỗng / null để xóa số điện thoại. */
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^(0\d{9}|\+84\d{9})$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string | null;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu hiện tại' })
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Mật khẩu mới cần có cả chữ và số',
  })
  newPassword: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  @MaxLength(72)
  password: string;
}
