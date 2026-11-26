//service auth

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';

/** Các trường cần dùng trong kết quả xác thực ID token của Google. */
interface GoogleTokenInfo {
  aud?: string;
  iss?: string;
  exp?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/** Quên mật khẩu: mã xác nhận 6 số gửi qua email. */
const RESET_CODE_TTL_MINUTES = 10;
const RESET_CODE_TTL_MS = RESET_CODE_TTL_MINUTES * 60 * 1000;
/** Chỉ gửi lại mã sau khoảng này (chống spam email). */
const RESET_RESEND_COOLDOWN_MS = 60 * 1000;
/** Nhập sai quá số lần này thì mã bị khóa, phải yêu cầu mã mới. */
const RESET_MAX_ATTEMPTS = 5;

/** 0901234567 và +84901234567 là cùng một số: trả về cả hai dạng để kiểm tra trùng. */
function phoneVariants(phone: string): string[] {
  if (phone.startsWith('+84')) return [phone, `0${phone.slice(3)}`];
  if (phone.startsWith('0')) return [phone, `+84${phone.slice(1)}`];
  return [phone];
}

/** Không bao giờ trả passwordHash ra ngoài. */
export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    loyaltyPoints: user.loyaltyPoints,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email đã được sử dụng');
    if (dto.phone) await this.assertPhoneAvailable(dto.phone);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });
      return this.buildSession(user);
    } catch (err) {
      throw this.uniqueViolationToConflict(err) ?? err;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const ok = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.buildSession(user);
  }

  /**
   * POST /auth/google
   * Nhận ID token từ Google Identity Services, xác thực với Google,
   * rồi tìm hoặc tạo tài khoản theo email và cấp JWT của BrewLite.
   */
  async googleLogin(dto: GoogleLoginDto) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Đăng nhập bằng Google chưa được cấu hình',
      );
    }

    const info = await this.verifyGoogleToken(dto.credential, clientId);
    const email = info.email!.trim().toLowerCase();

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Tài khoản Google không có mật khẩu: lưu hash của chuỗi ngẫu nhiên
      // để không ai đăng nhập bằng mật khẩu được vào tài khoản này.
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      user = await this.prisma.user.create({
        data: {
          name: (info.name?.trim() || email.split('@')[0]).slice(0, 80),
          email,
          passwordHash,
        },
      });
    }
    return this.buildSession(user);
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }

  /**
   * PATCH /auth/profile — cập nhật họ tên / số điện thoại.
   * Email không đổi được. phone = null (hoặc chuỗi rỗng) là xóa số điện thoại.
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const data: { name?: string; phone?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Không có thông tin nào để cập nhật');
    }

    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) throw new UnauthorizedException();

    // Số điện thoại mới không được trùng với tài khoản khác (xóa số = null thì bỏ qua)
    if (typeof data.phone === 'string') {
      await this.assertPhoneAvailable(data.phone, userId);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
      });
      return toPublicUser(user);
    } catch (err) {
      throw this.uniqueViolationToConflict(err) ?? err;
    }
  }

  /**
   * POST /auth/change-password — đổi mật khẩu khi đang đăng nhập.
   * Mật khẩu hiện tại sai trả 400 (không phải 401, vì frontend sẽ tự đăng xuất khi nhận 401).
   */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const currentOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: 'Đổi mật khẩu thành công' };
  }

  /**
   * POST /auth/forgot-password — bước 1: gửi mã xác nhận 6 số tới email.
   * Luôn trả cùng một thông báo (kể cả khi email chưa đăng ký, hoặc vừa gửi chưa quá 60 giây)
   * để không lộ email nào đã có tài khoản.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = {
      message: `Nếu email đã được đăng ký, chúng mình đã gửi mã xác nhận (có hiệu lực ${RESET_CODE_TTL_MINUTES} phút).`,
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) return generic;

    const last = await this.prisma.passwordResetCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (
      last &&
      Date.now() - last.createdAt.getTime() < RESET_RESEND_COOLDOWN_MS
    ) {
      return generic;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Mã cũ chưa dùng bị vô hiệu: chỉ mã mới nhất có tác dụng
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetCode.create({
        data: {
          userId: user.id,
          codeHash: this.hashResetCode(user.id, code),
          expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
        },
      }),
    ]);

    // Không chờ SMTP (gửi chậm) để thời gian phản hồi không tiết lộ email có tồn tại hay không
    void this.mail
      .sendPasswordResetCode(user.email, code, RESET_CODE_TTL_MINUTES)
      .catch((err) =>
        this.logger.error(
          `Không gửi được email đặt lại mật khẩu tới ${user.email}: ${String(err)}`,
        ),
      );

    return generic;
  }

  /**
   * POST /auth/reset-password — bước 2: nhập mã nhận qua email + mật khẩu mới.
   * Mã sai / hết hạn / đã dùng đều trả cùng một thông báo; nhập sai 5 lần thì mã bị khóa.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const invalid = () =>
      new BadRequestException('Mã xác nhận không đúng hoặc đã hết hạn');

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw invalid();

    const record = await this.prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw invalid();

    // Tăng số lần thử TRƯỚC khi so mã (một lệnh nguyên tử) để không dò mã được bằng nhiều request song song
    const attempt = await this.prisma.passwordResetCode.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        attempts: { lt: RESET_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count === 0) {
      throw new BadRequestException(
        'Bạn đã nhập sai quá nhiều lần, vui lòng yêu cầu mã mới',
      );
    }
    if (!this.resetCodeMatches(record.codeHash, user.id, dto.code)) {
      throw invalid();
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      // Đánh dấu đã dùng trước: nếu request song song đã dùng mã này rồi thì count = 0
      const used = await tx.passwordResetCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (used.count === 0) throw invalid();

      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      // Vô hiệu mọi mã còn lại của tài khoản
      await tx.passwordResetCode.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return {
      message:
        'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
    };
  }

  /**
   * 409 nếu số điện thoại đã thuộc tài khoản khác (cả dạng 0xxx và +84xxx).
   * excludeUserId: bỏ qua chính chủ khi sửa hồ sơ.
   */
  private async assertPhoneAvailable(phone: string, excludeUserId?: number) {
    const taken = await this.prisma.user.findFirst({
      where: {
        phone: { in: phoneVariants(phone) },
        ...(excludeUserId !== undefined ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (taken) throw new ConflictException('Số điện thoại đã được sử dụng');
  }

  /**
   * Hai request cùng email / số điện thoại gửi song song: kiểm tra ở trên có thể cùng lọt,
   * ràng buộc UNIQUE của CSDL sẽ chặn bản thứ hai; đổi lỗi đó thành 409 thay vì 500.
   */
  private uniqueViolationToConflict(err: unknown): ConflictException | null {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const target = String(err.meta?.target ?? '');
      return new ConflictException(
        target.includes('phone')
          ? 'Số điện thoại đã được sử dụng'
          : 'Email đã được sử dụng',
      );
    }
    return null;
  }

  /** Băm mã bằng HMAC-SHA256 (khóa JWT_SECRET), gắn userId để cùng một mã của hai người cho hash khác nhau. */
  private hashResetCode(userId: number, code: string): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return createHmac('sha256', secret)
      .update(`${userId}:${code}`)
      .digest('hex');
  }

  private resetCodeMatches(
    storedHash: string,
    userId: number,
    code: string,
  ): boolean {
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(this.hashResetCode(userId, code), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Hỏi Google xem ID token có hợp lệ không, rồi đối chiếu audience, issuer, hạn dùng. */
  private async verifyGoogleToken(
    credential: string,
    clientId: string,
  ): Promise<GoogleTokenInfo> {
    let res: Response;
    try {
      res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { signal: AbortSignal.timeout(5000) },
      );
    } catch (err) {
      this.logger.error(`Không gọi được Google tokeninfo: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Không thể xác thực với Google, vui lòng thử lại',
      );
    }
    if (!res.ok) {
      throw new UnauthorizedException('Phiên đăng nhập Google không hợp lệ');
    }

    const info = (await res.json().catch(() => null)) as GoogleTokenInfo | null;
    const verified =
      info?.email_verified === true || info?.email_verified === 'true';
    const notExpired = Number(info?.exp ?? 0) * 1000 > Date.now();
    if (
      !info?.email ||
      !verified ||
      !notExpired ||
      info.aud !== clientId ||
      !GOOGLE_ISSUERS.includes(info.iss ?? '')
    ) {
      throw new UnauthorizedException('Phiên đăng nhập Google không hợp lệ');
    }
    return info;
  }

  private async buildSession(user: User) {
    // JWT chứa sub, email (AC-02.1)
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken, user: toPublicUser(user) };
  }
}
