import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Gửi email qua SMTP (nodemailer).
 *
 * Cấu hình bằng biến môi trường: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM.
 * Để trống SMTP_HOST thì KHÔNG gửi thật mà chỉ in nội dung email ra log (tiện chạy thử trên máy).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')?.trim();
    const user = config.get<string>('SMTP_USER')?.trim();
    const pass = config.get<string>('SMTP_PASS');
    const port = Number(config.get<string>('SMTP_PORT') || 587);
    // Cổng 465 dùng TLS ngay từ đầu; cổng 587 dùng STARTTLS (secure = false)
    const secure = config.get<string>('SMTP_SECURE') === 'true' || port === 465;

    this.from =
      config.get<string>('MAIL_FROM')?.trim() ||
      (user ? `BrewLite <${user}>` : 'BrewLite <no-reply@brewlite.local>');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user ? { user, pass } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        'Chưa cấu hình SMTP_HOST: email chỉ được in ra log, không gửi thật',
      );
    }
  }

  async send(to: string, subject: string, text: string, html: string) {
    if (!this.transporter) {
      this.logger.warn(
        `[MAIL - chưa cấu hình SMTP] Tới: ${to} | Tiêu đề: ${subject}\n${text}`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }

  /** Email chứa mã xác nhận đặt lại mật khẩu. */
  sendPasswordResetCode(to: string, code: string, ttlMinutes: number) {
    const subject = `Mã đặt lại mật khẩu BrewLite: ${code}`;
    const text =
      `Mã xác nhận đặt lại mật khẩu BrewLite của bạn là: ${code}\n\n` +
      `Mã có hiệu lực trong ${ttlMinutes} phút và chỉ dùng được một lần.\n` +
      `Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.`;
    const html =
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#2b2b2b">` +
      `<h2 style="margin:0 0 12px;color:#6F4E37">Đặt lại mật khẩu BrewLite</h2>` +
      `<p>Mã xác nhận của bạn là:</p>` +
      `<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0;color:#6F4E37">${code}</p>` +
      `<p>Mã có hiệu lực trong <b>${ttlMinutes} phút</b> và chỉ dùng được một lần.</p>` +
      `<p style="color:#777;font-size:13px">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>` +
      `</div>`;
    return this.send(to, subject, text, html);
  }
}
