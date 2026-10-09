"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountFrame } from "@/components/account/account-frame";
import { PasswordField } from "@/components/auth/password-field";
import { AppShell } from "@/components/shell/app-shell";
import { api } from "@/lib/api";

export function SettingsScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(() => setReady(true))
      .catch(() => router.replace("/"));
  }, [router]);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/auth/password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Đã cập nhật mật khẩu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mật khẩu");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await api.post("/auth/logout");
      router.replace("/");
    } catch (err) {
      setLoggingOut(false);
      setError(err instanceof Error ? err.message : "Không đăng xuất được");
    }
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="px-8 py-6 text-sm text-[#626f86]">Đang mở cài đặt…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <AccountFrame
      active="settings"
      title="Cài đặt tài khoản"
      description="Quản lý bảo mật và phiên đăng nhập của bạn."
    >
      <form
        onSubmit={savePassword}
        className="rounded-lg border border-[#dfe1e6] bg-white px-6 py-5"
      >
        <h2 className="text-[15px] font-semibold">Đổi mật khẩu</h2>
        <p className="mt-1 text-[12px] text-[#626f86]">
          Sử dụng mật khẩu mạnh mà bạn chưa dùng ở nơi khác.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#44546f]">Mật khẩu hiện tại</span>
            <PasswordField
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu hiện tại"
              minLength={1}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#44546f]">Mật khẩu mới</span>
            <PasswordField
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder="Ít nhất 8 ký tự"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#44546f]">Xác nhận mật khẩu mới</span>
            <PasswordField
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
            />
          </label>
        </div>
        {error && (
          <p className="mt-4 rounded bg-[#ffedeb] px-2.5 py-2 text-[12px] text-[#ca3521]">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded bg-[#dffcf0] px-2.5 py-2 text-[12px] text-[#216e4e]">
            {message}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded bg-[#0c66e4] px-4 text-[13px] font-semibold text-white hover:bg-[#0052cc] disabled:opacity-60"
          >
            {saving ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
          </button>
        </div>
      </form>

      <section className="flex items-center justify-between gap-4 rounded-lg border border-[#f5c2c0] bg-white px-6 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Phiên đăng nhập</h2>
          <p className="mt-1 text-[12px] text-[#626f86]">
            Đăng xuất khỏi tài khoản trên thiết bị này.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          className="h-9 shrink-0 rounded bg-[#c9372c] px-4 text-[13px] font-semibold text-white hover:bg-[#ae2e24] disabled:opacity-60"
        >
          {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
        </button>
      </section>
    </AccountFrame>
    </AppShell>
  );
}
