// Quên mật khẩu: nhập email -> nhận mã 6 số qua email -> nhập mã + mật khẩu mới
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { btnOutline, btnPrimary, input } from "@/components/ui/classes";
import { api, ApiError } from "@/lib/api";

type Step = "email" | "code" | "done";

/** Giãn cách giữa hai lần gửi mã (khớp với backend: 60 giây). */
const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Đếm ngược để chặn bấm "Gửi lại mã" liên tục
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** Gửi (hoặc gửi lại) mã tới email. Trả true nếu gọi API thành công. */
  async function sendCode(): Promise<boolean> {
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      setError("Email không hợp lệ");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.forgotPassword(addr);
      setEmail(addr);
      setInfo(r.message);
      setCooldown(RESEND_SECONDS);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đã có lỗi xảy ra");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (await sendCode()) setStep("code");
  }

  async function onResend() {
    if (cooldown > 0 || busy) return;
    if (await sendCode()) setCode("");
  }

  async function onSubmitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Mã xác nhận gồm 6 chữ số");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu mới tối thiểu 8 ký tự");
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password)) {
      setError("Mật khẩu mới cần có cả chữ và số");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.resetPassword({ email, code, newPassword: password });
      setInfo(r.message);
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setPassword("");
    setConfirm("");
    setError(null);
    setInfo(null);
  }

  const errorBox = error && (
    <div role="alert" className="rounded-lg bg-[#FBE7E7] px-4 py-3 text-sm text-danger">
      {error}
    </div>
  );

  return (
    <div className="flex w-full justify-center px-4 py-6 sm:px-6 sm:py-20">
      <div className="flex w-full max-w-[480px] flex-col rounded-2xl bg-white p-2 sm:p-8">
        <div className="mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6F4E37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        </div>

        {step === "email" && (
          <>
            <h2 className="mb-2 text-[28px] font-bold text-ink sm:text-[32px]">Quên mật khẩu?</h2>
            <p className="mb-2 text-[15px] leading-[150%] text-muted sm:text-[16px]">
              Đừng lo, chúng mình sẽ giúp bạn quay lại.
            </p>
            <p className="mb-6 text-[15px] leading-[150%] text-muted sm:mb-8 sm:text-[16px]">
              Nhập email đã đăng ký. Bạn sẽ nhận được mã xác nhận gồm 6 số để tạo mật khẩu mới.
            </p>

            <form onSubmit={onSubmitEmail} className="flex flex-col gap-6" noValidate>
              {errorBox}
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-bold text-ink">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Nhập email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={input}
                />
              </div>

              <button disabled={busy} className={`${btnPrimary} mt-2 w-full py-4`}>
                {busy ? "Đang gửi...." : "Gửi mã xác nhận"}
              </button>

              <div className="mt-2 w-full text-center">
                <Link href="/login" className="flex min-h-[44px] items-center justify-center text-sm font-bold text-ink transition-colors hover:text-brand">
                  Quay lại đăng nhập
                </Link>
              </div>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <h2 className="mb-2 text-[28px] font-bold text-ink sm:text-[32px]">Nhập mã xác nhận</h2>
            <p className="mb-6 text-[15px] leading-[150%] text-muted sm:mb-8 sm:text-[16px]">
              Nếu <span className="font-bold text-ink">{email}</span> đã đăng ký, mã 6 số đã được gửi tới
              email này (có hiệu lực 10 phút). Hãy kiểm tra cả hộp thư rác.
            </p>

            <form onSubmit={onSubmitReset} className="flex flex-col gap-5" noValidate>
              {errorBox}
              {info && !error && (
                <div role="status" className="rounded-lg bg-[#E6F3EA] px-4 py-3 text-sm text-[#1E7A43]">
                  {info}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="code" className="text-sm font-bold text-ink">Mã xác nhận</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="______"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${input} text-center text-2xl font-bold tracking-[0.5em]`}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="new-password" className="text-sm font-bold text-ink">Mật khẩu mới</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự, có chữ và số"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={input}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-password" className="text-sm font-bold text-ink">Nhập lại mật khẩu mới</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={input}
                />
              </div>

              <button disabled={busy} className={`${btnPrimary} mt-2 w-full py-4`}>
                {busy ? "Đang xử lý...." : "Đặt lại mật khẩu"}
              </button>

              <button
                type="button"
                onClick={onResend}
                disabled={busy || cooldown > 0}
                className={`${btnOutline} w-full`}
              >
                {cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : "Gửi lại mã"}
              </button>

              <div className="w-full text-center">
                <button
                  type="button"
                  onClick={changeEmail}
                  className="flex min-h-[44px] w-full items-center justify-center text-sm font-bold text-ink transition-colors hover:text-brand"
                >
                  Đổi email khác
                </button>
              </div>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <h2 className="mb-2 text-[28px] font-bold text-ink sm:text-[32px]">Đã đặt lại mật khẩu</h2>
            <div className="mt-4 flex flex-col gap-6">
              <div role="status" className="rounded-lg bg-[#E6F3EA] px-4 py-3 text-sm text-[#1E7A43]">
                {info}
              </div>
              <Link href="/login" className={`${btnPrimary} w-full py-4`}>
                Đăng nhập
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
