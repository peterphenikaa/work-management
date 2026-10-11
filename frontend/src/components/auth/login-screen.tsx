"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { ApiError, api, type LoginResponse } from "@/lib/api";

const inputClass =
  "h-10 w-full rounded border border-[#c7cdd6] px-2.5 text-xs outline-none focus:border-[#0c66e4] focus:shadow-[0_0_0_1px_#0c66e4]";

const ACCOUNTS = [
  { label: "Admin", email: "admin@northstar.vn", password: "Northstar1" },
  { label: "User", email: "thanhbinh58058@gmail.com", password: "acebinh123" },
] as const;

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string>(ACCOUNTS[0].email);
  const [password, setPassword] = useState<string>(ACCOUNTS[0].password);
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
    <main className="flex min-h-full flex-1 items-center justify-center bg-[#f7f8f9] px-5 py-10 text-[#172b4d]">
      <div className="flex w-full max-w-[400px] flex-col items-center">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-[#0c66e4] to-[#0747a6] text-sm font-bold text-white">
            W
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Northstar Work</span>
        </div>

        <section className="w-full rounded-lg border border-[#dfe1e6] bg-white px-8 py-8 shadow-[0_4px_16px_rgba(9,30,66,0.1)]">
          <header className="mb-5 text-center">
            <h1 className="text-[23px] font-semibold tracking-tight">Đăng nhập</h1>
            <p className="mt-1 text-[11px] text-[#626f86]">Tiếp tục vào Không gian Northstar</p>
          </header>

          <form className="flex flex-col gap-3.5" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#44546f]">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="ten@congty.vn"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-[#44546f]">Mật khẩu</span>
              <PasswordField
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                placeholder="Ít nhất 8 ký tự"
                className={`${inputClass} pr-9`}
              />
            </label>
            <span className="-mt-1 self-end text-[10px] font-semibold text-[#0052cc]">Quên mật khẩu?</span>
            {waiting ? (
              <p className="rounded bg-[#fff7d6] px-2.5 py-2 text-[11px] leading-4 text-[#7f5f01]">{waiting}</p>
            ) : null}
            {error ? (
              <p className="rounded bg-[#ffedeb] px-2.5 py-2 text-[11px] text-[#ca3521]">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded bg-[#0c66e4] text-xs font-semibold text-white hover:bg-[#0055cc] disabled:opacity-60"
            >
              {loading ? (waiting ? "Đang chờ máy chủ…" : "Đang đăng nhập…") : "Đăng nhập"}
            </button>
          </form>

          <div className="mt-4 border-t border-[#dfe1e6] pt-4 text-center text-[11px] text-[#626f86]">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-semibold text-[#0052cc] hover:underline">
              Đăng ký
            </Link>
          </div>
        </section>

        <div className="mt-4 flex w-full flex-col gap-1.5">
          {ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                setError(null);
              }}
              className="flex h-9 items-center justify-between rounded border border-[#dfe1e6] bg-white px-3 text-[11px] hover:bg-[#f7f8f9]"
            >
              <span className="font-semibold">{account.label}</span>
              <span className="text-[#626f86]">{account.email}</span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-center text-[10px] leading-4 text-[#7a869a]">
          Bằng cách tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư.
        </p>
      </div>
    </main>
  );
}
