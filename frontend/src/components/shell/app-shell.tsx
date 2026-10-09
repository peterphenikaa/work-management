"use client";

import {
  Bell,
  ChartColumn,
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  Plus,
  Search,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, type AuthUser } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";

const ShellUserContext = createContext<AuthUser | null>(null);

export function useShellUser() {
  return useContext(ShellUserContext);
}

const nav = [
  {
    label: "Tổng quan",
    items: [{ href: "/home", label: "Dashboard", icon: LayoutGrid }],
  },
  {
    label: "Quản trị",
    items: [
      { href: null, label: "Workspaces", icon: FolderKanban },
      { href: null, label: "Thành viên", icon: Users },
      { href: null, label: "Phân quyền", icon: Shield },
    ],
  },
  {
    label: "Phân tích",
    items: [{ href: null, label: "Báo cáo", icon: ChartColumn }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const mark = initials(user.name);

  return (
    <ShellUserContext.Provider value={user}>
      <div className="flex min-h-full flex-1 flex-col bg-white text-[#172b4d]">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#dfe1e6] bg-white px-3">
          <button
            type="button"
            aria-label="Trình đơn ứng dụng"
            className="grid size-8 place-items-center rounded text-[#44546f] hover:bg-[#f1f2f4]"
          >
            <LayoutGrid size={18} />
          </button>
          <span className="grid size-7 place-items-center rounded bg-[#0c66e4] text-sm font-bold text-white">
            W
          </span>
          <button
            type="button"
            className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-sm font-semibold whitespace-nowrap hover:bg-[#f1f2f4]"
          >
            Không gian Northstar
            <ChevronDown size={16} className="text-[#626f86]" />
          </button>

          <label className="relative mx-auto hidden w-full max-w-[420px] md:block">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#626f86]" />
            <input
              readOnly
              placeholder="Tìm kiếm hoặc chuyển nhanh..."
              className="h-9 w-full rounded-md border border-transparent bg-[#f4f5f7] pr-3 pl-9 text-[13px] outline-none placeholder:text-[#626f86] focus:border-[#0c66e4] focus:bg-white"
            />
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex h-8 items-center gap-1 rounded bg-[#0c66e4] px-3 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-[#0052cc]"
            >
              <Plus size={16} />
              Tạo mới
            </button>
            <button
              type="button"
              aria-label="Thông báo"
              className="grid size-8 place-items-center rounded text-[#44546f] hover:bg-[#f1f2f4]"
            >
              <Bell size={18} />
            </button>
            <span className="hidden text-[13px] whitespace-nowrap text-[#44546f] sm:inline">
              {ROLE_LABEL[user.role]}
            </span>
            <Link
              href="/profile"
              aria-label="Hồ sơ cá nhân"
              className="grid size-8 place-items-center rounded-full bg-[#1d2125] text-[11px] font-semibold text-white"
            >
              {mark}
            </Link>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[232px] shrink-0 flex-col border-r border-[#dfe1e6] bg-[#f7f8f9]">
            <nav className="flex flex-1 flex-col gap-4 px-2 py-4">
              {nav.map((group) => (
                <div key={group.label}>
                  <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-[#626f86] uppercase">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = item.href !== null && pathname === item.href;
                      const className = `flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium ${
                        active
                          ? "bg-[#e9f2ff] text-[#0c66e4]"
                          : "text-[#172b4d]"
                      }`;
                      const content = (
                        <>
                          <Icon size={16} />
                          {item.label}
                        </>
                      );
                      return item.href ? (
                        <Link key={item.label} href={item.href} className={className}>
                          {content}
                        </Link>
                      ) : (
                        <span key={item.label} className={className}>
                          {content}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <Link
              href="/profile"
              className="flex items-center gap-2 border-t border-[#dfe1e6] px-3 py-3 hover:bg-[#f1f2f4]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1d2125] text-[11px] font-semibold text-white">
                {mark}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{user.name}</span>
                <span className="block truncate text-[11px] text-[#626f86]">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
            </Link>
          </aside>

          <div className="min-w-0 flex-1 bg-white">{children}</div>
        </div>
      </div>
    </ShellUserContext.Provider>
  );
}
