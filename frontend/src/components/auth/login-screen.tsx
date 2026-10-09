"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type LoginResponse } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@northstar.vn", password: "Northstar1" },
  { role: "Leader", email: "leader@northstar.vn", password: "Northstar1" },
  { role: "Member", email: "member@northstar.vn", password: "Northstar1" },
] as const;

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post<LoginResponse>("/auth/login", { email, password });
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đăng nhập được");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-[#f7f8f9] px-5 py-10 text-[#172b4d]">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-[#0c66e4] to-[#0747a6] text-sm font-bold text-white">
          W
        </span>
        <span className="text-[17px] font-semibold tracking-tight">
          Northstar Work
        </span>
      </div>

      <section className="w-full max-w-[400px] rounded-lg border border-[#dfe1e6] bg-white px-8 py-8 shadow-[0_4px_16px_rgba(9,30,66,0.1)]">
        <header className="mb-6 text-center">
          <h1 className="text-[23px] font-semibold tracking-tight">Đăng nhập</h1>
          <p className="mt-1.5 text-[11px] text-[#626f86]">
            Tiếp tục vào Không gian Northstar
          </p>
        </header>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-[#44546f]">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="ten@congty.vn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 rounded border border-[#c7cdd6] px-2.5 text-xs outline-none focus:border-[#0c66e4] focus:shadow-[0_0_0_1px_#0c66e4]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-[#44546f]">
              Mật khẩu
            </span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              placeholder="Ít nhất 8 ký tự"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 rounded border border-[#c7cdd6] px-2.5 text-xs outline-none focus:border-[#0c66e4] focus:shadow-[0_0_0_1px_#0c66e4]"
            />
          </label>
          <Link
            href="/forgot-password"
            className="-mt-1 self-end text-[10px] font-semibold text-[#0052cc]"
          >
            Quên mật khẩu?
          </Link>
          {error && (
            <p className="rounded bg-[#ffedeb] px-2.5 py-2 text-[11px] text-[#ca3521]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-10 rounded bg-[#0c66e4] text-[13px] font-semibold text-white hover:bg-[#0052cc] disabled:opacity-60"
          >
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-5 border-t border-[#dfe1e6] pt-4 text-center text-[10px] text-[#626f86]">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-semibold text-[#0052cc]">
            Đăng ký
          </Link>
        </p>
      </section>

      <div className="mt-4 flex w-full max-w-[400px] flex-col gap-1.5">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.role}
            type="button"
            onClick={() => {
              setEmail(account.email);
              setPassword(account.password);
              setError(null);
            }}
            className="flex h-9 items-center justify-between rounded border border-[#dfe1e6] bg-white px-3 text-[11px] hover:bg-[#f7f8f9]"
          >
            <span className="font-semibold">{account.role}</span>
            <span className="text-[#626f86]">{account.email}</span>
          </button>
        ))}
      </div>

      <p className="mt-4 max-w-[400px] text-center text-[9px] leading-relaxed text-[#7a869a]">
        Bằng cách tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách
        quyền riêng tư.
      </p>
    </main>
  );
}
