"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { api, type LoginResponse } from "@/lib/api";

const inputClass =
  "h-10 rounded border border-[#c7cdd6] px-2.5 text-xs outline-none focus:border-[#0c66e4] focus:shadow-[0_0_0_1px_#0c66e4]";

export function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (!accepted) {
      setError("Bạn cần đồng ý với điều khoản để tạo tài khoản");
      return;
    }

    setLoading(true);
    try {
      await api.post<LoginResponse>("/auth/register", {
        name,
        email,
        password,
        confirmPassword,
      });
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được tài khoản");
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
          <h1 className="text-[23px] font-semibold tracking-tight">
            Tạo tài khoản
          </h1>
          <p className="mt-1.5 text-[11px] text-[#626f86]">
            Bắt đầu quản lý công việc cùng nhóm
          </p>
        </header>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-[#44546f]">
              Họ và tên
            </span>
            <input
              required
              autoComplete="name"
              placeholder="Nguyễn Văn An"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </label>
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
            <span className="text-[10px] font-semibold text-[#44546f]">
              Mật khẩu
            </span>
            <PasswordField
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Ít nhất 8 ký tự"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-[#44546f]">
              Xác nhận mật khẩu
            </span>
            <PasswordField
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
            />
          </label>
          <label className="flex items-start gap-2 text-[11px] leading-snug text-[#44546f]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 accent-[#0c66e4]"
            />
            <span>Tôi đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư</span>
          </label>
          {error && (
            <p className="rounded bg-[#ffedeb] px-2.5 py-2 text-[11px] text-[#ca3521]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded bg-[#0c66e4] text-[13px] font-semibold text-white hover:bg-[#0052cc] disabled:opacity-60"
          >
            {loading ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
          <Link
            href="/"
            className="flex h-10 items-center justify-center rounded border border-[#dfe1e6] bg-white text-[13px] font-semibold text-[#44546f] hover:bg-[#f7f8f9]"
          >
            Quay lại
          </Link>
        </form>

        <p className="mt-5 border-t border-[#dfe1e6] pt-4 text-center text-[10px] text-[#626f86]">
          Đã có tài khoản?{" "}
          <Link href="/" className="font-semibold text-[#0052cc]">
            Đăng nhập
          </Link>
        </p>
      </section>
    </main>
  );
}
