"use client";

import {
  Bell,
  ChartColumn,
  ChevronDown,
  FolderKanban,
  Inbox,
  LayoutGrid,
  List,
  Repeat,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, type AuthUser } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/roles";
import { WorkspaceAvatar } from "@/components/leader/workspace-avatar";
import { WorkspaceSwitcher } from "@/components/leader/workspace-switcher";
import { type MineWorkspace } from "@/components/leader/workspace-mark";
import { MemberDataProvider, useMemberData } from "@/components/member/member-data";
import { NotificationBell } from "@/components/shell/notification-bell";
import { QuickSearch } from "@/components/shell/quick-search";
import { UserMenu } from "@/components/shell/user-menu";

const STORAGE_KEY = "northstar-workspace";

type LeaderContextValue = {
  workspaces: MineWorkspace[];
  current: MineWorkspace | null;
  select: (id: string) => void;
  reload: (preferId?: string) => Promise<void>;
};

const LeaderContext = createContext<LeaderContextValue | null>(null);

export function useLeader() {
  return useContext(LeaderContext);
}

const NAV: { label: string; items: { tab: string; label: string; icon: LucideIcon }[] }[] = [
  { label: "Tổng quan", items: [{ tab: "dashboard", label: "Dashboard", icon: LayoutGrid }] },
  {
    label: "Quản lý dự án",
    items: [
      { tab: "projects", label: "Dự án", icon: FolderKanban },
      { tab: "board", label: "Board", icon: SquareKanban },
      { tab: "list", label: "List", icon: List },
    ],
  },
  {
    label: "Quản lý Agile",
    items: [
      { tab: "backlog", label: "Backlog", icon: Inbox },
      { tab: "sprint", label: "Sprint", icon: Repeat },
    ],
  },
  { label: "Phân tích", items: [{ tab: "reports", label: "Báo cáo", icon: ChartColumn }] },
];

// Member không có Backlog/Báo cáo quản trị; có thêm trung tâm thông báo cá nhân.
const MEMBER_NAV: typeof NAV = [
  { label: "Tổng quan", items: [{ tab: "dashboard", label: "Công việc nhóm", icon: LayoutGrid }] },
  {
    label: "Dự án",
    items: [
      { tab: "projects", label: "Space & List", icon: FolderKanban },
      { tab: "board", label: "Board", icon: SquareKanban },
      { tab: "list", label: "List", icon: List },
    ],
  },
  { label: "Agile", items: [{ tab: "sprint", label: "Sprint hiện tại", icon: Repeat }] },
  { label: "Thông báo", items: [{ tab: "notifications", label: "Thông báo", icon: Bell }] },
];

function chooseId(items: MineWorkspace[], preferId: string | undefined, current: string | null) {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const next = [preferId, current, stored].find((id) => id && items.some((item) => item.id === id));
  return next ?? items[0]?.id ?? null;
}

export function LeaderExperience({
  user,
  children,
  empty,
}: {
  user: AuthUser;
  children: React.ReactNode;
  empty: React.ReactNode;
}) {
  const [workspaces, setWorkspaces] = useState<MineWorkspace[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async (preferId?: string) => {
    const response = await api.get<{ items: MineWorkspace[] }>("/workspaces/mine");
    const items = response.data.items;
    setWorkspaces(items);
    setFailed(false);
    setSelectedId((current) => {
      const next = chooseId(items, preferId, current);
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: MineWorkspace[] }>("/workspaces/mine")
      .then((response) => {
        if (cancelled) return;
        const items = response.data.items;
        setWorkspaces(items);
        setSelectedId((current) => {
          const next = chooseId(items, undefined, current);
          if (next) window.localStorage.setItem(STORAGE_KEY, next);
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setWorkspaces([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!workspaces) {
    return (
      <main className="grid min-h-full flex-1 place-items-center bg-[#f7f8f9] text-sm text-[#626f86]">
        Đang mở workspace…
      </main>
    );
  }

  const current = workspaces.find((item) => item.id === selectedId) ?? null;

  function select(id: string) {
    setSelectedId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <LeaderContext.Provider value={{ workspaces, current, select, reload }}>
      {current && !failed ? (
        current.role === "MEMBER" ? (
          <MemberDataProvider key={`${current.id}:${user.id}`} workspaceId={current.id} workspaceName={current.name} userId={user.id}>
            <LeaderChrome user={user}>{children}</LeaderChrome>
          </MemberDataProvider>
        ) : (
          <LeaderChrome user={user}>{children}</LeaderChrome>
        )
      ) : (
        empty
      )}
    </LeaderContext.Provider>
  );
}

function LeaderChrome({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const leader = useLeader();
  const pathname = usePathname();
  const params = useSearchParams();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const member = useMemberData();
  const current = leader?.current;
  if (!current || !leader) return null;

  const isMember = current.role === "MEMBER";
  const nav = isMember ? MEMBER_NAV : NAV;
  const unread = isMember ? (member?.unread ?? 0) : 0;

  const tab = pathname === "/home" ? (params.get("tab") ?? "dashboard") : "";
  const badgeClass =
    current.role === "LEADER"
      ? "bg-[#f3f0ff] text-[#5e4db2]"
      : current.role === "ADMIN"
        ? "bg-[#e9f2ff] text-[#0c66e4]"
        : "bg-[#f1f2f4] text-[#44546f]";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-[#172b4d]">
      <header className="grid h-16 shrink-0 grid-cols-[auto_minmax(0,440px)_1fr] items-center gap-4 border-b border-[#dfe1e6] bg-white px-5">
        <span className="grid size-7 place-items-center rounded-[6px] bg-gradient-to-br from-[#0c66e4] to-[#0747a6] text-sm font-bold text-white">
          W
        </span>
        <QuickSearch />
        <div className="flex items-center justify-end gap-3">
          {isMember ? (
            <Link href="/home?tab=notifications" aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"} className="relative grid size-8 place-items-center text-[#626f86] hover:text-[#172b4d]">
              <Bell size={18} />
              {unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ca3521] px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          ) : (
            <NotificationBell />
          )}
          <UserMenu user={user} badge={ROLE_LABEL[current.role]} badgeClassName={badgeClass} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#dfe1e6] bg-[#f7f8f9]">
          <div className="px-3 pt-3">
            <button
              ref={anchorRef}
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left hover:bg-[#ebecf0]"
            >
              <WorkspaceAvatar
                id={current.id}
                name={current.name}
                hasIcon={current.hasIcon}
                className="size-9 rounded-[8px] text-[12px]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[#172b4d]">{current.name}</span>
                <span className="block truncate text-[11px] text-[#626f86]">{ROLE_LABEL[current.role]}</span>
              </span>
              <ChevronDown size={16} className="shrink-0 text-[#626f86]" />
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pt-4 pb-4">
            {nav.map((group, index) => (
              <div key={group.label} className={index === 0 ? "" : "mt-3 border-t border-[#dfe1e6]/70 pt-4"}>
                <p className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-[#7a869a] uppercase">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const href = item.tab === "dashboard" ? "/home" : `/home?tab=${item.tab}`;
                    const active = tab === item.tab;
                    return (
                      <Link
                        key={item.tab}
                        href={href}
                        className={`flex min-h-9 items-center gap-3 rounded-[5px] px-3 py-2 text-[14px] leading-5 ${
                          active
                            ? "bg-[#e9f2ff] font-semibold text-[#0052cc] shadow-[inset_3px_0_0_#0c66e4]"
                            : "font-medium text-[#44546f] hover:bg-[#ebecf0]"
                        }`}
                      >
                        <Icon size={16} />
                        <span className="flex-1">{item.label}</span>
                        {item.tab === "notifications" && unread > 0 ? (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#ca3521] px-1.5 text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#f7f8f9]">{children}</div>
      </div>

      {open ? (
        <WorkspaceSwitcher
          workspaces={leader.workspaces}
          currentId={current.id}
          anchor={anchorRef.current}
          onClose={() => setOpen(false)}
          onSelect={(id) => {
            leader.select(id);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
