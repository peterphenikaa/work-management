"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountFrame } from "@/components/account/account-frame";
import { AppShell } from "@/components/shell/app-shell";
import { api, type AuthUser, type Role } from "@/lib/api";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  LEADER: "Trưởng nhóm",
  MEMBER: "Thành viên",
};

const inputClass =
  "h-10 rounded border border-[#c7cdd6] px-2.5 text-xs outline-none focus:border-[#0c66e4] focus:shadow-[0_0_0_1px_#0c66e4]";

export function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    api
      .get<AuthUser>("/auth/me")
      .then((response) => {
        setUser(response.data);
        setName(response.data.name);
        setPhone(response.data.phone ?? "");
      })
      .catch(() => router.replace("/"));
  }, [router]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      const response = await api.patch<{ user: AuthUser }>("/auth/profile", {
        name,
        phone,
      });
      setUser(response.data.user);
      setProfileMessage("Đã lưu thông tin");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setSavingProfile(false);
    }
  }

  if (!user) {
    return (
      <AppShell>
        <p className="px-8 py-6 text-sm text-[#626f86]">Đang mở hồ sơ…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <AccountFrame
      active="profile"
      title="Hồ sơ cá nhân"
      description="Thông tin hiển thị trong không gian làm việc."
    >
      <section className="rounded-lg border border-[#dfe1e6] bg-white px-6 py-5">
        <form className="flex flex-col gap-4" onSubmit={saveProfile}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-[#44546f]">Họ và tên</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-[#44546f]">Email</span>
            <input value={user.email} disabled className={`${inputClass} bg-[#f7f8f9] text-[#626f86]`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-[#44546f]">Số điện thoại</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0901234567"
              className={inputClass}
            />
          </label>
          <div className="flex items-center justify-between rounded-md bg-[#f4f5f7] px-3 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#44546f]">
              <Lock size={16} />
              {ROLE_LABEL[user.role]}
            </span>
            <span className="text-[11px] text-[#626f86]">
              Vai trò do quản trị viên thiết lập
            </span>
          </div>
          {profileError && (
            <p className="rounded bg-[#ffedeb] px-2.5 py-2 text-[11px] text-[#ca3521]">
              {profileError}
            </p>
          )}
          {profileMessage && (
            <p className="rounded bg-[#dffcf0] px-2.5 py-2 text-[11px] text-[#216e4e]">
              {profileMessage}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="h-9 rounded bg-[#0c66e4] px-4 text-[13px] font-semibold text-white hover:bg-[#0052cc] disabled:opacity-60"
            >
              {savingProfile ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </section>
    </AccountFrame>
    </AppShell>
  );
}
