"use client";

import { useState } from "react";
import { btnOutline, btnPrimary, card, input } from "@/components/ui/classes";
import { api, ApiError } from "@/lib/api";
import { initials } from "@/lib/format";
import type { User } from "@/lib/types";

const PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

/** UC-02: xem và cập nhật hồ sơ (PATCH /auth/profile). Email dùng để đăng nhập nên không sửa được. */
export default function ProfileInfoCard({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (user: User) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setName(user.name);
    setPhone(user.phone ?? "");
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const n = name.trim();
    const p = phone.trim();
    if (n.length < 2) {
      setError("Họ tên tối thiểu 2 ký tự");
      return;
    }
    if (n.length > 80) {
      setError("Họ tên tối đa 80 ký tự");
      return;
    }
    if (p && !PHONE_RE.test(p)) {
      setError("Số điện thoại không hợp lệ (0xxxxxxxxx hoặc +84xxxxxxxxx)");
      return;
    }

    // Chỉ gửi trường thật sự thay đổi
    const body: { name?: string; phone?: string | null } = {};
    if (n !== user.name) body.name = n;
    if (p !== (user.phone ?? "")) body.phone = p === "" ? null : p;
    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await api.auth.updateProfile(body);
      onSaved(updated);
      setSaved(true);
      setEditing(false);
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

  const rows = [
    { label: "Họ và tên", value: user.name },
    { label: "Email", value: user.email },
    { label: "Số điện thoại", value: user.phone || "Chưa cập nhật" },
  ];

  return (
    <section className={card}>
      <div className="mb-5 flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
          {initials(user.name)}
        </span>
        <h2 className="min-w-0 flex-1 break-words text-lg font-bold text-ink">{user.name}</h2>
        {!editing && (
          <button type="button" onClick={startEdit} className={`${btnOutline} shrink-0`}>
            Chỉnh sửa
          </button>
        )}
      </div>

      {saved && !editing && (
        <p role="status" className="mb-4 rounded-lg bg-[#E6F3EA] px-4 py-3 text-sm text-[#1E7A43]">
          Đã cập nhật hồ sơ.
        </p>
      )}

      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-sm font-bold text-ink">
              Họ và tên
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoComplete="name"
              className={input}
            />
          </div>

          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-bold text-ink">
              Email
            </label>
            <input
              id="profile-email"
              value={user.email}
              disabled
              className={`${input} cursor-not-allowed bg-cream/60 text-muted`}
            />
            <p className="mt-1 text-xs text-muted">Email dùng để đăng nhập nên không thể thay đổi.</p>
          </div>

          <div>
            <label htmlFor="profile-phone" className="mb-2 block text-sm font-bold text-ink">
              Số điện thoại
            </label>
            <input
              id="profile-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0901234567 hoặc +84901234567"
              className={input}
            />
            <p className="mt-1 text-xs text-muted">Để trống nếu muốn xóa số điện thoại.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-[#FBE7E7] px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`}>
              {busy ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button type="button" onClick={cancelEdit} disabled={busy} className={`${btnOutline} flex-1`}>
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <dl className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-4"
            >
              <dt className="text-muted">{r.label}</dt>
              <dd className="break-all font-semibold text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
