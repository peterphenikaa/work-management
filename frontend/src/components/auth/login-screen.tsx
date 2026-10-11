"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthFrame, authFieldClass } from "@/components/auth/auth-frame";
import { PasswordField } from "@/components/auth/password-field";
import { ApiError, api, type LoginResponse } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { role: "Quản trị viên", email: "admin@northstar.vn", password: "Northstar1" },
  { role: "Thành viên", email: "member@northstar.vn", password: "Northstar1" },
] as const;

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setWaiting(null);
    const hint = window.setTimeout(() => setWaiting("Máy chủ đang mở lại sau lúc nghỉ."), 4000);
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await api.post<LoginResponse>("/auth/login", { email, password }, { timeout: 40000 });
          window.clearTimeout(hint);
          setWaiting(null);
          router.push("/home");
          return;
        } catch (err) {
          const asleep = err instanceof ApiError && err.asleep;
          if (!asleep || attempt === 2) throw err;
          setWaiting("Máy chủ đang thức dậy. Đang thử lại…");
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.asleep) {
        setWaiting(err.message);
        setError(null);
      } else {
        setWaiting(null);
        setError(err instanceof Error ? err.message : "Không đăng nhập được");
      }
    } finally {
      window.clearTimeout(hint);
      setLoading(false);
    }
  }

  return (
    <AuthFrame>
          <header className="mb-6">
            <h1 className="text-[28px] font-semibold tracking-tight">Đăng nhập</h1>
            <p className="mt-2 text-sm text-[#626f86]">Tiếp tục vào không gian của nhóm bạn.</p>
          </header>

          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#44546f]">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="ten@congty.vn"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={authFieldClass}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#44546f]">Mật khẩu</span>
              <PasswordField
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                placeholder="Ít nhất 8 ký tự"
                className={`${authFieldClass} pr-10`}
              />
            </label>
            {waiting ? (
              <p className="rounded-lg bg-[#fff7d6] px-3 py-2.5 text-sm leading-5 text-[#7f5f01]">{waiting}</p>
            ) : null}
            {error ? (
              <p className="rounded-lg bg-[#ffedeb] px-3 py-2.5 text-sm text-[#ca3521]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-lg bg-[#0c66e4] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(9,30,66,0.25)] hover:bg-[#0055cc] disabled:opacity-60"
            >
              {loading ? (waiting ? "Đang chờ máy chủ…" : "Đang đăng nhập…") : "Đăng nhập"}
            </button>
          </form>

          <p className="mt-6 text-sm text-[#626f86]">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-semibold text-[#0c66e4] hover:text-[#0052cc]">
              Đăng ký
            </Link>
          </p>

          <div className="mt-6 border-t border-[#dfe1e6] pt-5">
            <p className="text-xs font-medium tracking-wide text-[#626f86] uppercase">Tài khoản mẫu</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError(null);
                  }}
                  className="rounded-lg border border-[#dfe1e6] bg-white px-3 py-2.5 text-left hover:border-[#0c66e4] hover:bg-[#f7faff]"
                >
                  <span className="block text-sm font-semibold">{account.role}</span>
                  <span className="mt-0.5 block truncate text-xs text-[#626f86]">{account.email}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-5 text-xs leading-5 text-[#7a869a]">
            Bằng cách tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư.
          </p>
    </AuthFrame>
  );
}
