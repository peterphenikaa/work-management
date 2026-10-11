"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthFrame, authFieldClass } from "@/components/auth/auth-frame";
import { PasswordField } from "@/components/auth/password-field";
import { api, type LoginResponse } from "@/lib/api";

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
    <AuthFrame>
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Tạo tài khoản</h1>
        <p className="mt-2 text-sm text-[#626f86]">Bắt đầu quản lý công việc cùng nhóm.</p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#44546f]">Họ và tên</span>
          <input
            required
            autoComplete="name"
            placeholder="Nguyễn Văn An"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={authFieldClass}
          />
        </label>
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
            autoComplete="new-password"
            placeholder="Ít nhất 8 ký tự"
            className={`${authFieldClass} pr-10`}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#44546f]">Xác nhận mật khẩu</span>
          <PasswordField
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            className={`${authFieldClass} pr-10`}
          />
        </label>
        <label className="flex items-start gap-2.5 text-sm leading-5 text-[#44546f]">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 size-4 accent-[#0c66e4]"
          />
          <span>Tôi đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư</span>
        </label>
        {error ? (
          <p className="rounded-lg bg-[#ffedeb] px-3 py-2.5 text-sm text-[#ca3521]">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-[#0c66e4] text-sm font-semibold text-white shadow-[0_1px_2px_rgba(9,30,66,0.25)] hover:bg-[#0055cc] disabled:opacity-60"
        >
          {loading ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[#626f86]">
        Đã có tài khoản?{" "}
        <Link href="/" className="font-semibold text-[#0c66e4] hover:text-[#0052cc]">
          Đăng nhập
        </Link>
      </p>
    </AuthFrame>
  );
}
