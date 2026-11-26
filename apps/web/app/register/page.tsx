// 

import type { Metadata } from "next";
import { Suspense } from "react";
import Register from "@/components/auth/Register";

export const metadata: Metadata = { title: "Đăng ký" };

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Register dùng useSearchParams (?next=) nên cần Suspense */}
      <Suspense fallback={null}>
        <Register />
      </Suspense>
    </div>
  );
}
