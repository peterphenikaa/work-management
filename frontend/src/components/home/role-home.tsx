"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type AuthUser, type Role } from "@/lib/api";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  LEADER: "Trưởng nhóm",
  MEMBER: "Thành viên",
};

export function RoleHome() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    api
      .get<AuthUser>("/auth/me")
      .then((response) => setUser(response.data))
      .catch(() => router.replace("/"));
  }, [router]);

  if (!user) {
    return (
      <main className="grid min-h-full flex-1 place-items-center bg-[#f7f8f9] text-sm text-[#626f86]">
        Đang mở phiên làm việc…
      </main>
    );
  }

  async function logout() {
    await api.post("/auth/logout");
    router.replace("/");
  }

  return (
    <main className="flex min-h-full flex-1 flex-col bg-[#f7f8f9] text-[#172b4d]">
      <header className="flex h-16 items-center justify-between border-b border-[#dfe1e6] bg-white px-5">
        <span className="text-sm font-semibold">Không gian Northstar</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="h-8 rounded bg-[#f1f2f4] px-3 text-xs font-semibold hover:bg-[#dcdfe4]"
        >
          Đăng xuất
        </button>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-[#626f86]">{user.name}</p>
        <h1 className="mt-2 text-2xl font-semibold">{ROLE_LABEL[user.role]}</h1>
      </section>
    </main>
  );
}
