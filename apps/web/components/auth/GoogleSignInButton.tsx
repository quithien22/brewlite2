"use client";

import { useEffect, useRef, useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT_ID = "google-identity-services";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleIdentity {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

/** Nạp script Google Identity Services đúng một lần cho cả trang. */
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("load failed")));
  });
}

interface Props {
  /** Gọi khi Google trả về ID token (chuỗi JWT) cho người dùng. */
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
}

export default function GoogleSignInButton({ onCredential, onError }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Giữ callback mới nhất mà không phải khởi tạo lại nút Google mỗi lần render
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        const el = holder.current;
        const gid = window.google?.accounts.id;
        if (cancelled || !el || !gid) return;

        gid.initialize({
          client_id: CLIENT_ID,
          callback: (res) => {
            if (res.credential) handlers.current.onCredential(res.credential);
            else handlers.current.onError?.("Không nhận được phản hồi từ Google");
          },
        });
        gid.renderButton(el, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "center",
          locale: "vi",
          // Google chỉ nhận chiều rộng cố định từ 200 đến 400px
          width: Math.min(400, Math.max(200, el.clientWidth)),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT_ID || failed) {
    return (
      <button
        type="button"
        disabled
        title={failed ? "Không tải được Google" : "Chưa cấu hình Google Client ID"}
        className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-line bg-white py-3.5 text-sm font-bold text-ink opacity-60"
      >
        {failed ? "Không tải được đăng nhập Google" : "Đăng nhập với Google (chưa cấu hình)"}
      </button>
    );
  }

  return <div ref={holder} className="flex min-h-[44px] w-full justify-center" />;
}
