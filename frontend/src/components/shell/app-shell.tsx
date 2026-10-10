"use client";

import {
  Bell,
  Building2,
  ChartColumn,
  CircleUser,
  Ellipsis,
  LayoutGrid,
  Search,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState } from "react";
import { api, type AuthUser } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";
import { UserMenu } from "@/components/shell/user-menu";

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
      { href: "/workspaces", label: "Workspaces", icon: Building2 },
      { href: null, label: "Thành viên & Phân quyền", icon: Users },
    ],
  },
  {
    label: "Phân tích",
    items: [{ href: null, label: "Báo cáo", icon: ChartColumn }],
  },
  {
    label: "Tài khoản",
    items: [
      { href: "/profile", label: "Hồ sơ cá nhân", icon: CircleUser },
      { href: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
];

function ShellLoading() {
  return (
    <main className="grid min-h-full flex-1 place-items-center bg-[#f7f8f9] text-sm text-[#626f86]">
      Đang mở phiên làm việc…
    </main>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellLoading />}>
      <AppShellFrame>{children}</AppShellFrame>
    </Suspense>
  );
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
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
    return <ShellLoading />;
  }

  const mark = initials(user.name);

  return (
    <ShellUserContext.Provider value={user}>
      <div className="flex min-h-full flex-1 flex-col bg-white text-[#172b4d]">
        <header className="grid h-16 shrink-0 grid-cols-[1fr_minmax(0,440px)_1fr] items-center border-b border-[#dfe1e6] bg-white px-5">
          <span className="grid size-7 place-items-center justify-self-start rounded-[6px] bg-gradient-to-br from-[#0c66e4] to-[#0747a6] text-sm font-bold text-white">
            W
          </span>

          <label className="relative h-9 w-full">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#172b4d]" />
            <input
              readOnly
              placeholder="Tìm kiếm hoặc chuyển nhanh..."
              className="h-9 w-full rounded-[5px] border border-[#c7cdd6] bg-[#f7f8f9] pr-3 pl-9 text-[13px] outline-none placeholder:text-[#7a869a]"
            />
          </label>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              aria-label="Thông báo"
              className="relative grid size-8 place-items-center text-[#626f86]"
            >
              <Bell size={18} />
              <span className="absolute top-1 right-1 size-2 rounded-full bg-[#ca3521] ring-2 ring-white" />
            </button>
            <UserMenu user={user} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[244px] shrink-0 flex-col border-r border-[#dfe1e6] bg-[#f7f8f9]">
            <nav className="flex flex-1 flex-col px-2.5 pt-5">
              {nav.map((group, index) => (
                <div
                  key={group.label}
                  className={index === 0 ? "" : "mt-3 border-t border-[#dfe1e6]/70 pt-4"}
                >
                  <p className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-[#7a869a] uppercase">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        item.href !== null &&
                        (pathname === item.href || pathname.startsWith(`${item.href}/`));
                      const className = `flex h-9 items-center gap-3 rounded-[5px] px-3 text-[14px] ${
                        active
                          ? "bg-[#e9f2ff] font-semibold text-[#0052cc] shadow-[inset_3px_0_0_#0c66e4]"
                          : "font-medium text-[#44546f] hover:bg-[#ebecf0]"
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
              className="flex items-center gap-2.5 border-t border-[#dfe1e6] px-4 py-4 hover:bg-[#f1f2f4]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#334563] text-[11px] font-semibold text-white">
                {mark}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[#172b4d]">
                  {user.name}
                </span>
                <span className="block truncate text-[11px] text-[#626f86]">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <Ellipsis size={16} className="shrink-0 text-[#626f86]" />
            </Link>
          </aside>

          <div className="min-w-0 flex-1 bg-white">{children}</div>
        </div>
      </div>
    </ShellUserContext.Provider>
  );
}
