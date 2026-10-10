"use client";

import { Building2, ChartColumn, Sparkles, SquareCheckBig, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";
import { WorkspaceInvites } from "@/components/workspaces/workspace-invites";

type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

type DashboardSummary = {
  workspaces: { active: number };
  members: { total: number; active: number };
  tasks: {
    total: number;
    done: number;
    percent: number;
    byStatus: Record<TaskStatus, number>;
  };
  membersPreview: Array<{
    id: string;
    name: string;
    email: string;
    role: Role;
    active: boolean;
  }>;
};

const STATUS_ROWS: Array<{ status: TaskStatus; label: string; color: string }> = [
  { status: "TODO", label: "Cần làm", color: "#8590a2" },
  { status: "IN_PROGRESS", label: "Đang thực hiện", color: "#0c66e4" },
  { status: "REVIEW", label: "Đánh giá", color: "#8f7ee7" },
  { status: "DONE", label: "Hoàn thành", color: "#22a06b" },
];

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-[#f3f0ff] text-[#5e4db2]",
  LEADER: "bg-[#e9f2ff] text-[#0c66e4]",
  MEMBER: "bg-[#f1f2f4] text-[#44546f]",
};

const AVATAR_COLORS = ["#6554c0", "#0c66e4", "#e56910", "#22a06b", "#ae2e24"];

function avatarColor(name: string) {
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardSummary>("/dashboard")
      .then((response) => setSummary(response.data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Không tải được tổng quan");
      });
  }, []);

  if (error) {
    return <p className="px-8 py-6 text-sm text-[#ca3521]">{error}</p>;
  }

  if (!summary) {
    return <p className="px-8 py-6 text-sm text-[#626f86]">Đang tải tổng quan…</p>;
  }

  const maxStatus = Math.max(...STATUS_ROWS.map((row) => summary.tasks.byStatus[row.status]), 1);

  return (
    <div className="px-8 pt-8 pb-8 text-[#172b4d]">
      <p className="text-[12px] leading-none text-[#626f86]">
        Không gian Northstar / Tổng quan hệ thống
      </p>
      <h1 className="mt-[18px] text-[24px] leading-none font-semibold tracking-tight">
        Dashboard Quản trị viên
      </h1>
      <p className="mt-3 text-[13px] text-[#626f86]">
        Theo dõi Workspace, tài khoản và tình hình công việc toàn tổ chức.
      </p>
      <WorkspaceInvites />

      <div className="mt-5 grid grid-cols-4 gap-[14px]">
        <StatCard
          icon={<Building2 size={18} />}
          iconClass="bg-[#e9f2ff]"
          label="Không gian"
          hint="Đang hoạt động"
          value={summary.workspaces.active}
        />
        <StatCard
          icon={<Users size={18} />}
          iconClass="bg-[#f3f0ff]"
          label="Thành viên"
          hint={`${summary.members.active} đang hoạt động`}
          value={summary.members.total}
        />
        <StatCard
          icon={<SquareCheckBig size={18} />}
          iconClass="bg-[#fff7d6]"
          label="Công việc"
          hint="Trên toàn hệ thống"
          value={summary.tasks.total}
        />
        <StatCard
          icon={<Sparkles size={18} />}
          iconClass="bg-[#dffcf0]"
          label="Đã hoàn thành"
          hint={`${summary.tasks.percent}% tổng công việc`}
          value={summary.tasks.done}
        />
      </div>

      <div className="mt-[18px] grid grid-cols-[minmax(0,643fr)_minmax(0,582fr)] gap-[18px]">
        <section className="min-h-[313px] rounded-[7px] border border-[#dfe1e6] px-5 py-4 shadow-[0_1px_1px_rgba(9,30,66,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Tình hình công việc</h2>
              <p className="mt-0.5 text-[12px] text-[#626f86]">
                Phân bổ công việc theo trạng thái hiện tại
              </p>
            </div>
            <span className="flex items-center gap-1 text-[12px] font-medium text-[#626f86]">
              <ChartColumn size={14} />
              Xem báo cáo
            </span>
          </div>
          <div className="mt-8 flex items-center gap-10">
            <div className="w-[88px] shrink-0 text-center">
              <p className="text-[40px] leading-none font-semibold tracking-tight">
                {summary.tasks.percent}%
              </p>
              <p className="mt-2 text-[12px] text-[#626f86]">Hoàn thành</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              {STATUS_ROWS.map((row) => {
                const count = summary.tasks.byStatus[row.status];
                return (
                  <div key={row.status} className="flex items-center gap-3 text-[13px]">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="w-[132px] shrink-0 text-[#44546f]">{row.label}</span>
                    <span className="h-1.5 w-24 shrink-0">
                      <span
                        className="block h-1.5 rounded-full"
                        style={{
                          width: `${Math.max((count / maxStatus) * 100, count > 0 ? 18 : 0)}%`,
                          background: row.color,
                        }}
                      />
                    </span>
                    <span className="ml-auto w-4 text-right font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="min-h-[313px] rounded-[7px] border border-[#dfe1e6] px-5 py-4 shadow-[0_1px_1px_rgba(9,30,66,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Tổng quan thành viên</h2>
              <p className="mt-0.5 text-[12px] text-[#626f86]">
                Tài khoản và quyền truy cập cấp đây
              </p>
            </div>
            <span className="text-[12px] font-medium text-[#626f86]">Xem tất cả</span>
          </div>
          <div className="mt-2 divide-y divide-[#f1f2f4]">
            {summary.membersPreview.map((member) => (
              <div key={member.id} className="flex items-center gap-3 py-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                  style={{ background: avatarColor(member.name) }}
                >
                  {initials(member.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{member.name}</span>
                  <span className="block truncate text-[11px] text-[#626f86]">{member.email}</span>
                </span>
                <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[member.role]}`}>
                  {ROLE_LABEL[member.role]}
                </span>
                <span className="rounded bg-[#dffcf0] px-2 py-0.5 text-[11px] font-medium text-[#216e4e]">
                  {member.active ? "Hoạt động" : "Đã khóa"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconClass,
  label,
  hint,
  value,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  hint: string;
  value: number;
}) {
  return (
    <article className="flex h-[108px] items-center gap-4 rounded-[7px] border border-[#dfe1e6] bg-white px-[18px] shadow-[0_1px_1px_rgba(9,30,66,0.05)]">
      <span className={`grid size-[42px] shrink-0 place-items-center rounded-[9px] text-[#626f86] ${iconClass}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="block truncate text-[12px] text-[#626f86]">{hint}</span>
      </span>
      <span className="ml-auto text-[32px] leading-none font-semibold tracking-tight">{value}</span>
    </article>
  );
}
