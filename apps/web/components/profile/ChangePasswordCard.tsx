"use client";

import { useState } from "react";
import { btnOutline, btnPrimary, card, input } from "@/components/ui/classes";
import { api, ApiError } from "@/lib/api";

/** UC-02: đổi mật khẩu (POST /auth/change-password). Quy tắc mật khẩu mới giống lúc đăng ký. */
export default function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!current) {
      setError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (next.length < 8) {
      setError("Mật khẩu mới tối thiểu 8 ký tự");
      return;
    }
    if (next.length > 72) {
      setError("Mật khẩu mới tối đa 72 ký tự");
      return;
    }
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setError("Mật khẩu mới cần có cả chữ và số");
      return;
    }
    if (next === current) {
      setError("Mật khẩu mới phải khác mật khẩu hiện tại");
      return;
    }
    if (next !== confirm) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.auth.changePassword({ currentPassword: current, newPassword: next });
      reset();
      setOpen(false);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.isNetwork
            ? "Mất kết nối đến máy chủ, vui lòng thử lại"
            : err.message
          : "Đã có lỗi xảy ra",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink">Mật khẩu</h2>
          <p className="mt-1 text-sm text-muted">Nên đổi mật khẩu định kỳ để bảo vệ tài khoản.</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
            className={`${btnOutline} shrink-0`}
          >
            Đổi mật khẩu
          </button>
        )}
      </div>

      {done && !open && (
        <p role="status" className="mt-4 rounded-lg bg-[#E6F3EA] px-4 py-3 text-sm text-[#1E7A43]">
          Đổi mật khẩu thành công. Lần đăng nhập sau hãy dùng mật khẩu mới.
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="pw-current" className="mb-2 block text-sm font-bold text-ink">
              Mật khẩu hiện tại
            </label>
            <input
              id="pw-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              maxLength={72}
              autoComplete="current-password"
              className={input}
            />
          </div>

          <div>
            <label htmlFor="pw-new" className="mb-2 block text-sm font-bold text-ink">
              Mật khẩu mới
            </label>
            <input
              id="pw-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              maxLength={72}
              autoComplete="new-password"
              className={input}
            />
            <p className="mt-1 text-xs text-muted">Tối thiểu 8 ký tự, gồm cả chữ và số.</p>
          </div>

          <div>
            <label htmlFor="pw-confirm" className="mb-2 block text-sm font-bold text-ink">
              Nhập lại mật khẩu mới
            </label>
            <input
              id="pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={72}
              autoComplete="new-password"
              className={input}
            />
          </div>

          <p className="text-xs text-muted">
            Tài khoản đăng ký bằng Google chưa có mật khẩu riêng nên chưa dùng được chức năng này.
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-[#FBE7E7] px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`}>
              {busy ? "Đang lưu..." : "Cập nhật mật khẩu"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className={`${btnOutline} flex-1`}
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
