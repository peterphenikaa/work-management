"use client";

import { AlertTriangle, CheckCheck, FileDown, FileSpreadsheet, ListTodo, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { initials } from "@/lib/roles";
import { useShellUser } from "@/components/shell/app-shell";

type Period = "7d" | "30d" | "month" | "quarter";
type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

type Report = {
  applied: {
    period: Period;
    rangeLabel: string;
    startDate: string;
    endDate: string;
    workspaceId: string | null;
    spaceId: string | null;
    assigneeId: string | null;
  };
  truncated: boolean;
  options: {
    workspaces: Array<{ id: string; name: string }>;
    spaces: Array<{ id: string; name: string; workspaceId: string; workspaceName: string }>;
    members: Array<{ id: string; name: string }>;
  };
  kpis: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number | null;
  };
  statusDistribution: Array<{ name: string; count: number; color: string; percent: number }>;
  trend: Array<{ label: string; created: number; completed: number }>;
  members: Array<{
    memberId: string | null;
    memberName: string;
    assignedTasks: number;
    completedTasks: number;
    onTimeTasks: number;
    lateTasks: number;
    overdueOpenTasks: number;
    onTimeRate: number | null;
  }>;
  overdueTasks: Array<{
    taskId: string;
    code: string;
    taskName: string;
    workspaceId: string;
    workspaceName: string;
    spaceId: string;
    spaceName: string;
    listName: string;
    assigneeName: string | null;
    dueDate: string | null;
    daysOverdue: number;
    priority: Priority;
    status: string;
  }>;
  completedTasks: Array<{
    taskId: string;
    code: string;
    taskName: string;
    workspaceId: string;
    spaceId: string;
    spaceName: string;
    assigneeName: string | null;
    completedAt: string;
    onTime: boolean | null;
    priority: Priority;
  }>;
};

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "7d", label: "7 ngày" },
  { id: "30d", label: "30 ngày" },
  { id: "month", label: "Tháng này" },
  { id: "quarter", label: "Quý này" },
];

const PRIORITY: Record<Priority, { label: string; className: string }> = {
  URGENT: { label: "Khẩn cấp", className: "bg-[#ffeceb] text-[#ae2e24]" },
  HIGH: { label: "Cao", className: "bg-[#fff3eb] text-[#c25100]" },
  MEDIUM: { label: "Trung bình", className: "bg-[#e9f2ff] text-[#0c66e4]" },
  LOW: { label: "Thấp", className: "bg-[#f1f2f4] text-[#44546f]" },
};

const AVATAR = ["#6554c0", "#0c66e4", "#e56910", "#22a06b", "#ae2e24"];
const SELECT =
  "h-9 w-full appearance-none rounded-md border border-[#dfe1e6] bg-white px-3 text-[13px] text-[#172b4d] outline-none focus:border-[#0c66e4]";

function avatarColor(name: string) {
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR[index % AVATAR.length];
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

export function ReportsScreen() {
  const user = useShellUser();
  const [period, setPeriod] = useState<Period>("30d");
  const [workspaceId, setWorkspaceId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user || user.role === "MEMBER") return;
    const controller = new AbortController();
    setLoading(true);
    api
      .get<Report>("/reports", {
        signal: controller.signal,
        params: {
          period,
          ...(workspaceId ? { workspaceId } : {}),
          ...(spaceId ? { spaceId } : {}),
          ...(assigneeId ? { assigneeId } : {}),
        },
      })
      .then((response) => {
        setReport(response.data);
        setError("");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Không tải được báo cáo");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, period, workspaceId, spaceId, assigneeId]);

  async function exportExcel() {
    setExporting(true);
    setError("");
    try {
      const response = await api.get<Blob>("/reports/export", {
        responseType: "blob",
        params: {
          period,
          ...(workspaceId ? { workspaceId } : {}),
          ...(spaceId ? { spaceId } : {}),
          ...(assigneeId ? { assigneeId } : {}),
        },
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.xls`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không xuất được Excel");
    } finally {
      setExporting(false);
    }
  }

  if (user && user.role === "MEMBER") {
    return (
      <section className="px-8 pt-8 text-[14px] text-[#626f86]">
        Chỉ quản trị viên và trưởng nhóm xem được báo cáo.
      </section>
    );
  }

  const maxStatus = Math.max(1, ...(report?.statusDistribution.map((row) => row.count) ?? [1]));
  const maxAssigned = Math.max(1, ...(report?.members.map((row) => row.assignedTasks) ?? [1]));

  return (
    <section className="min-h-full bg-white px-8 py-6 text-[#172b4d] print:px-0">
      <p className="text-[13px] text-[#626f86] print:hidden">Phân tích / Báo cáo</p>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <span>
          <h1 className="text-[24px] leading-8 font-semibold">Báo cáo tiến độ</h1>
          <p className="mt-1 text-[14px] text-[#626f86]">
            {report
              ? `${report.applied.rangeLabel} · ${formatDate(report.applied.startDate)} – ${formatDate(report.applied.endDate)}`
              : "Theo dõi hoàn thành, quá hạn và khối lượng theo thành viên."}
          </p>
        </span>
        <span className="flex shrink-0 gap-2 print:hidden">
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || !report}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#dfe1e6] bg-white px-3 text-[13px] font-semibold text-[#44546f] hover:bg-[#f7f8f9] disabled:opacity-60"
          >
            <FileSpreadsheet size={15} />
            {exporting ? "Đang xuất…" : "Xuất Excel"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#0c66e4] px-3 text-[13px] font-semibold text-white hover:bg-[#0055cc] disabled:opacity-60"
          >
            <FileDown size={15} />
            Xuất PDF
          </button>
        </span>
      </header>

      <div className="mt-5 grid gap-3 rounded-xl border border-[#dfe1e6] bg-[#f7f8f9] p-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <Filter label="Khoảng thời gian">
          <select aria-label="Khoảng thời gian" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className={SELECT}>
            {PERIODS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Workspace">
          <select
            aria-label="Workspace"
            value={workspaceId}
            onChange={(event) => {
              setWorkspaceId(event.target.value);
              setSpaceId("");
            }}
            className={SELECT}
          >
            <option value="">Tất cả workspace</option>
            {report?.options.workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Space">
          <select aria-label="Space" value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className={SELECT}>
            <option value="">Tất cả space</option>
            {report?.options.spaces.map((item) => (
              <option key={item.id} value={item.id}>
                {workspaceId ? item.name : `${item.name} · ${item.workspaceName}`}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Thành viên">
          <select aria-label="Thành viên" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={SELECT}>
            <option value="">Tất cả thành viên</option>
            {report?.options.members.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
      </div>

      {error ? <p className="mt-3 text-[13px] text-[#ae2e24]">{error}</p> : null}
      {report?.truncated ? (
        <p className="mt-3 text-[13px] text-[#c25100]">
          Dữ liệu vượt 5.000 công việc. Hãy thu hẹp workspace hoặc khoảng thời gian.
        </p>
      ) : null}
      {loading && !report ? <p className="mt-6 text-[13px] text-[#626f86]">Đang tải báo cáo…</p> : null}

      {report ? (
        <div className={loading ? "opacity-70" : undefined}>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={<ListTodo size={18} />} tone="bg-[#e9f2ff] text-[#0c66e4]" label="Tổng công việc" value={String(report.kpis.totalTasks)} hint="Trong khoảng đã chọn" />
            <Kpi
              icon={<CheckCheck size={18} />}
              tone="bg-[#dcfff1] text-[#216e4e]"
              label="Tỷ lệ hoàn thành"
              value={report.kpis.completionRate == null ? "—" : `${report.kpis.completionRate}%`}
              hint={`${report.kpis.completedTasks} đã xong`}
            />
            <Kpi icon={<AlertTriangle size={18} />} tone="bg-[#ffeceb] text-[#ae2e24]" label="Quá hạn" value={String(report.kpis.overdueTasks)} hint="Chưa xong và đã quá hạn" />
            <Kpi icon={<Timer size={18} />} tone="bg-[#fff7d6] text-[#7f5f01]" label="Đang thực hiện" value={String(report.kpis.inProgressTasks)} hint="Đang làm và review" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <article className="rounded-xl border border-[#dfe1e6] p-5">
              <h2 className="text-[15px] font-semibold">Phân bổ trạng thái</h2>
              <p className="mt-0.5 text-[12px] text-[#626f86]">Số công việc theo trạng thái hiện tại</p>
              {report.statusDistribution.length === 0 ? (
                <p className="mt-8 text-[13px] text-[#626f86]">Chưa có công việc trong khoảng này.</p>
              ) : (
                <div className="mt-5 flex flex-col gap-3.5">
                  {report.statusDistribution.map((row) => (
                    <div key={row.name} className="grid grid-cols-[132px_minmax(0,1fr)_52px] items-center gap-3 text-[13px]">
                      <span className="flex items-center gap-2 text-[#44546f]">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className="h-2 rounded-full bg-[#f1f2f4]">
                        <span
                          className="block h-2 rounded-full"
                          style={{ width: `${Math.max((row.count / maxStatus) * 100, row.count > 0 ? 8 : 0)}%`, background: row.color }}
                        />
                      </span>
                      <span className="text-right font-medium">
                        {row.count}
                        <span className="ml-1 text-[11px] font-normal text-[#7a869a]">{row.percent}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-xl border border-[#dfe1e6] p-5">
              <div className="flex items-start justify-between gap-3">
                <span>
                  <h2 className="text-[15px] font-semibold">Xu hướng hoàn thành</h2>
                  <p className="mt-0.5 text-[12px] text-[#626f86]">Công việc tạo mới và hoàn thành theo mốc</p>
                </span>
                <span className="flex gap-3 text-[11px] text-[#626f86]">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-sm bg-[#c1c7d0]" /> Tạo mới
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-sm bg-[#22a06b]" /> Hoàn thành
                  </span>
                </span>
              </div>
              <TrendChart points={report.trend} />
            </article>
          </div>

          <article className="mt-4 overflow-hidden rounded-xl border border-[#dfe1e6]">
            <header className="border-b border-[#eef0f3] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Hiệu suất thành viên</h2>
              <p className="mt-0.5 text-[12px] text-[#626f86]">Khối lượng được giao, đúng hạn và việc đang trễ</p>
            </header>
            {report.members.length === 0 ? (
              <p className="px-5 py-8 text-[13px] text-[#626f86]">Chưa có công việc để tính hiệu suất.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="text-[11px] font-bold tracking-wide text-[#7a869a]">
                      <th className="px-5 py-3 font-bold">THÀNH VIÊN</th>
                      <th className="px-3 py-3 font-bold">ĐƯỢC GIAO</th>
                      <th className="px-3 py-3 font-bold">HOÀN THÀNH</th>
                      <th className="px-3 py-3 font-bold">ĐÚNG HẠN</th>
                      <th className="px-3 py-3 font-bold">TRỄ HẠN</th>
                      <th className="px-3 py-3 font-bold">ĐANG QUÁ HẠN</th>
                      <th className="px-5 py-3 text-right font-bold">TỶ LỆ ĐÚNG HẠN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.members.map((row) => (
                      <tr key={row.memberId ?? "none"} className="border-t border-[#eef0f3] text-[13px]">
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2.5">
                            <span
                              className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                              style={{ background: avatarColor(row.memberName) }}
                            >
                              {initials(row.memberName)}
                            </span>
                            <span className="min-w-[140px]">
                              <span className="block font-semibold">{row.memberName}</span>
                              <span className="mt-1 block h-1.5 w-28 rounded-full bg-[#f1f2f4]">
                                <span
                                  className="block h-1.5 rounded-full bg-[#0c66e4]"
                                  style={{ width: `${(row.assignedTasks / maxAssigned) * 100}%` }}
                                />
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3">{row.assignedTasks}</td>
                        <td className="px-3 py-3">{row.completedTasks}</td>
                        <td className="px-3 py-3 text-[#216e4e]">{row.onTimeTasks}</td>
                        <td className="px-3 py-3 text-[#c25100]">{row.lateTasks}</td>
                        <td className="px-3 py-3 text-[#ae2e24]">{row.overdueOpenTasks}</td>
                        <td className="px-5 py-3 text-right font-semibold">{row.onTimeRate == null ? "—" : `${row.onTimeRate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="mt-4 overflow-hidden rounded-xl border border-[#dfe1e6]">
            <header className="border-b border-[#eef0f3] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Công việc quá hạn</h2>
              <p className="mt-0.5 text-[12px] text-[#626f86]">Việc chưa hoàn thành và đã qua hạn</p>
            </header>
            {report.overdueTasks.length === 0 ? (
              <p className="px-5 py-8 text-[13px] text-[#626f86]">Không có công việc quá hạn.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="text-[11px] font-bold tracking-wide text-[#7a869a]">
                      <th className="px-5 py-3 font-bold">CÔNG VIỆC</th>
                      <th className="px-3 py-3 font-bold">SPACE</th>
                      <th className="px-3 py-3 font-bold">NGƯỜI THỰC HIỆN</th>
                      <th className="px-3 py-3 font-bold">HẠN</th>
                      <th className="px-3 py-3 font-bold">TRỄ</th>
                      <th className="px-5 py-3 font-bold">ƯU TIÊN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.overdueTasks.map((row) => (
                      <tr key={row.taskId} className="border-t border-[#eef0f3] text-[13px]">
                        <td className="px-5 py-3">
                          <Link
                            href={`/workspaces/${row.workspaceId}/spaces/${row.spaceId}/tasks/${row.taskId}`}
                            className="font-semibold hover:text-[#0c66e4]"
                          >
                            {row.taskName}
                          </Link>
                          <span className="mt-0.5 block text-[11px] text-[#7a869a]">
                            {row.code} · {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#44546f]">
                          {row.spaceName}
                          <span className="mt-0.5 block text-[11px] text-[#7a869a]">{row.workspaceName}</span>
                        </td>
                        <td className="px-3 py-3">{row.assigneeName ?? "Chưa giao"}</td>
                        <td className="px-3 py-3">{formatDate(row.dueDate)}</td>
                        <td className="px-3 py-3 font-semibold text-[#ae2e24]">{row.daysOverdue} ngày</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY[row.priority].className}`}>
                            {PRIORITY[row.priority].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="mt-4 overflow-hidden rounded-xl border border-[#dfe1e6]">
            <header className="border-b border-[#eef0f3] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Vừa hoàn thành</h2>
              <p className="mt-0.5 text-[12px] text-[#626f86]">20 công việc hoàn thành gần nhất trong phạm vi lọc</p>
            </header>
            {report.completedTasks.length === 0 ? (
              <p className="px-5 py-8 text-[13px] text-[#626f86]">Chưa có công việc hoàn thành.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="text-[11px] font-bold tracking-wide text-[#7a869a]">
                      <th className="px-5 py-3 font-bold">CÔNG VIỆC</th>
                      <th className="px-3 py-3 font-bold">SPACE</th>
                      <th className="px-3 py-3 font-bold">NGƯỜI THỰC HIỆN</th>
                      <th className="px-3 py-3 font-bold">HOÀN THÀNH</th>
                      <th className="px-5 py-3 font-bold">ĐÚNG HẠN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.completedTasks.map((row) => (
                      <tr key={row.taskId} className="border-t border-[#eef0f3] text-[13px]">
                        <td className="px-5 py-3">
                          <Link
                            href={`/workspaces/${row.workspaceId}/spaces/${row.spaceId}/tasks/${row.taskId}`}
                            className="font-semibold hover:text-[#0c66e4]"
                          >
                            {row.taskName}
                          </Link>
                          <span className="mt-0.5 block text-[11px] text-[#7a869a]">{row.code}</span>
                        </td>
                        <td className="px-3 py-3 text-[#44546f]">{row.spaceName}</td>
                        <td className="px-3 py-3">{row.assigneeName ?? "Chưa giao"}</td>
                        <td className="px-3 py-3">{formatDate(row.completedAt)}</td>
                        <td className="px-5 py-3">
                          {row.onTime == null ? (
                            <span className="text-[#7a869a]">Không hạn</span>
                          ) : row.onTime ? (
                            <span className="font-semibold text-[#216e4e]">Đúng hạn</span>
                          ) : (
                            <span className="font-semibold text-[#c25100]">Trễ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      ) : null}
    </section>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold tracking-wide text-[#7a869a] uppercase">{label}</span>
      {children}
    </label>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="flex h-[108px] items-center gap-3 rounded-xl border border-[#dfe1e6] bg-white px-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-[#626f86]">{label}</span>
        <span className="block text-[28px] leading-8 font-semibold tracking-tight">{value}</span>
        <span className="block truncate text-[11px] text-[#7a869a]">{hint}</span>
      </span>
    </article>
  );
}

function TrendChart({ points }: { points: Report["trend"] }) {
  const width = 640;
  const height = 210;
  const pad = { left: 28, right: 8, top: 12, bottom: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.flatMap((point) => [point.created, point.completed]));
  const group = innerW / Math.max(points.length, 1);
  const bar = Math.min(12, Math.max(3, group * 0.28));
  const ticks = [...new Set([0, Math.round(max / 2), max])];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-[210px] w-full" role="img" aria-label="Biểu đồ xu hướng hoàn thành">
      {ticks.map((tick) => {
        const y = pad.top + innerH - (tick / max) * innerH;
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#eef0f3" />
            <text x={0} y={y + 4} fill="#7a869a" fontSize="11">
              {tick}
            </text>
          </g>
        );
      })}
      {points.map((point, index) => {
        const x = pad.left + index * group + group / 2;
        const createdH = (point.created / max) * innerH;
        const completedH = (point.completed / max) * innerH;
        return (
          <g key={`${point.label}-${index}`}>
            <rect x={x - bar - 1} y={pad.top + innerH - createdH} width={bar} height={createdH} rx="2" fill="#c1c7d0" />
            <rect x={x + 1} y={pad.top + innerH - completedH} width={bar} height={completedH} rx="2" fill="#22a06b" />
            <text x={x} y={height - 8} textAnchor="middle" fill="#7a869a" fontSize="11">
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
