"use client";

import { CalendarDays, Check, Flag, ListTodo } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { MemberTaskDialog } from "@/components/member/member-task-dialog";
import { BUCKET_LABEL, isDueSoon, isDueToday, isOverdueTask, useMemberData, type Bucket, type MemberTask } from "@/components/member/member-data";
import { Filter } from "@/components/spaces/space-detail";
import { api } from "@/lib/api";

type Scope = "team" | "assigned" | "today" | "overdue" | "done";
type Period = "week" | "month";

export const PRIORITY_LABEL = { URGENT: "Khẩn cấp", HIGH: "Cao", MEDIUM: "Trung bình", LOW: "Thấp" } as const;
export const PRIORITY_TONE = {
  URGENT: "bg-[#ffeceb] text-[#ae2e24]",
  HIGH: "bg-[#fff3eb] text-[#c25100]",
  MEDIUM: "bg-[#fff7d6] text-[#7f5f01]",
  LOW: "bg-[#f1f2f4] text-[#44546f]",
} as const;
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

const BUCKET_TONE: Record<Bucket, string> = {
  TODO: "bg-[#f1f2f4] text-[#44546f]",
  IN_PROGRESS: "bg-[#e9f2ff] text-[#0c66e4]",
  REVIEW: "bg-[#f3f0ff] text-[#5e4db2]",
  DONE: "bg-[#dcfff1] text-[#216e4e]",
};

const SCOPE_LABEL: Record<Scope, string> = {
  team: "Tất cả công việc nhóm",
  assigned: "Được giao cho tôi",
  today: "Đến hạn hôm nay (của tôi)",
  overdue: "Quá hạn (của tôi)",
  done: "Đã hoàn thành (của tôi)",
};

function completedWithin(task: MemberTask, period: Period) {
  const stamp = new Date(task.updatedAt ?? task.createdAt ?? 0);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (period === "week") from.setDate(from.getDate() - 6);
  else from.setDate(1);
  return stamp >= from;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export function MemberDashboard() {
  const data = useMemberData();
  const [scope, setScope] = useState<Scope>("team");
  const [period, setPeriod] = useState<Period>("week");
  const [spaceId, setSpaceId] = useState("all");
  const [listId, setListId] = useState("all");
  const [bucket, setBucket] = useState("all");
  const [priority, setPriority] = useState("all");
  const [due, setDue] = useState("all");
  const [openId, setOpenId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const team = useMemo(() => data?.tasks ?? [], [data]);
  const mine = useMemo(() => (data ? data.tasks.filter((task) => task.assigneeId === data.userId) : []), [data]);
  const stats = useMemo(
    () => ({
      team: team.length,
      teamOpen: team.filter((task) => task.bucket !== "DONE").length,
      assigned: mine.length,
      open: mine.filter((task) => task.bucket !== "DONE").length,
      today: mine.filter((task) => task.bucket !== "DONE" && isDueToday(task)).length,
      overdue: mine.filter(isOverdueTask).length,
      done: mine.filter((task) => task.bucket === "DONE" && completedWithin(task, period)).length,
    }),
    [team, mine, period],
  );

  const rows = useMemo(() => {
    const source = scope === "team" ? team : mine;
    const scoped = source.filter((task) => {
      if (scope === "today") return task.bucket !== "DONE" && isDueToday(task);
      if (scope === "overdue") return isOverdueTask(task);
      if (scope === "done") return task.bucket === "DONE" && completedWithin(task, period);
      return true;
    });
    const filtered = scoped.filter((task) => {
      if (spaceId !== "all" && task.spaceId !== spaceId) return false;
      if (listId !== "all" && task.listId !== listId) return false;
      if (bucket !== "all" && task.bucket !== bucket) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (due === "today" && !isDueToday(task)) return false;
      if (due === "soon" && !isDueSoon(task)) return false;
      if (due === "overdue" && !isOverdueTask(task)) return false;
      if (due === "none" && task.dueAt) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if ((left.bucket === "DONE") !== (right.bucket === "DONE")) return left.bucket === "DONE" ? 1 : -1;
      const a = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const b = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
      if (a !== b) return a - b;
      return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    });
  }, [team, mine, scope, period, spaceId, listId, bucket, priority, due]);

  if (!data) return null;
  const space = data.spaces.find((item) => item.id === spaceId);
  const hasFilter = spaceId !== "all" || listId !== "all" || bucket !== "all" || priority !== "all" || due !== "all";

  async function changeStatus(task: MemberTask, statusId: string) {
    if (!data || statusId === task.statusId) return;
    if (task.assigneeId !== data.userId) {
      setNotice("Bạn chỉ được chuyển trạng thái công việc được giao cho mình");
      return;
    }
    setBusyId(task.id);
    setNotice("");
    try {
      await api.patch(`/workspaces/${data.workspaceId}/spaces/${task.spaceId}/tasks/${task.id}`, { statusId });
      await data.refresh();
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : "Không cập nhật được trạng thái");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-6">
      <div>
        <p className="text-[12px] text-[#626f86]">Workspace {data.workspaceName} / Công việc nhóm</p>
        <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-[#172b4d]">Công việc nhóm</h1>
        <p className="mt-1 max-w-[640px] text-[13px] text-[#626f86]">
          Thành viên cùng Space xem được toàn bộ công việc của team. Dùng thẻ bên dưới nếu chỉ muốn lọc việc của bạn.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard active={scope === "team"} onClick={() => setScope("team")} icon={<ListTodo size={18} className="text-[#0c66e4]" />} tint="#e9f2ff" label="CẢ NHÓM" detail={`${stats.teamOpen} chưa hoàn thành`} value={stats.team} />
        <StatCard active={scope === "assigned"} onClick={() => setScope("assigned")} icon={<ListTodo size={18} className="text-[#5e4db2]" />} tint="#f3f0ff" label="GIAO CHO TÔI" detail={`${stats.open} chưa hoàn thành`} value={stats.assigned} />
        <StatCard active={scope === "today"} onClick={() => setScope("today")} icon={<CalendarDays size={18} className="text-[#a54800]" />} tint="#fff3eb" label="ĐẾN HẠN HÔM NAY" detail="Của tôi · chưa xong" value={stats.today} />
        <StatCard active={scope === "overdue"} onClick={() => setScope("overdue")} icon={<Flag size={18} className="text-[#ae2e24]" />} tint="#ffeceb" label="QUÁ HẠN" detail="Của tôi" value={stats.overdue} />
        <StatCard
          active={scope === "done"}
          onClick={() => setScope("done")}
          icon={<Check size={18} className="text-[#216e4e]" />}
          tint="#dcfff1"
          label="ĐÃ HOÀN THÀNH"
          detail={
            <select
              aria-label="Khoảng thời gian hoàn thành"
              value={period}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="-ml-0.5 cursor-pointer rounded bg-transparent text-[12px] text-[#626f86] outline-none"
            >
              <option value="week">7 ngày gần nhất</option>
              <option value="month">Tháng này</option>
            </select>
          }
          value={stats.done}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[#f4f5f7] px-3 py-2.5">
        <span className="px-1 text-[11px] font-semibold tracking-wide text-[#626f86] uppercase">Bộ lọc</span>
        <Filter
          label="Space"
          value={spaceId}
          onChange={(value) => {
            setSpaceId(value);
            setListId("all");
          }}
          options={[{ id: "all", label: "Tất cả Space" }, ...data.spaces.map((item) => ({ id: item.id, label: item.name }))]}
        />
        <Filter
          label="List"
          value={listId}
          onChange={setListId}
          options={[{ id: "all", label: "Tất cả List" }, ...(space ? space.lists : []).map((item) => ({ id: item.id, label: item.name }))]}
        />
        <Filter
          label="Trạng thái"
          value={bucket}
          onChange={setBucket}
          options={[{ id: "all", label: "Mọi trạng thái" }, ...(Object.keys(BUCKET_LABEL) as Bucket[]).map((id) => ({ id, label: BUCKET_LABEL[id] }))]}
        />
        <Filter
          label="Mức độ ưu tiên"
          value={priority}
          onChange={setPriority}
          options={[{ id: "all", label: "Mọi mức ưu tiên" }, ...Object.entries(PRIORITY_LABEL).map(([id, label]) => ({ id, label }))]}
        />
        <Filter
          label="Hạn chót"
          value={due}
          onChange={setDue}
          options={[
            { id: "all", label: "Mọi hạn chót" },
            { id: "today", label: "Hôm nay" },
            { id: "soon", label: "Sắp đến hạn (7 ngày)" },
            { id: "overdue", label: "Quá hạn" },
            { id: "none", label: "Chưa có hạn" },
          ]}
        />
        {hasFilter ? (
          <button
            type="button"
            onClick={() => {
              setSpaceId("all");
              setListId("all");
              setBucket("all");
              setPriority("all");
              setDue("all");
            }}
            className="h-8 rounded px-2 text-[12px] font-semibold text-[#0c66e4] hover:bg-white"
          >
            Xóa bộ lọc
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#eef0f3] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#172b4d]">
            {SCOPE_LABEL[scope]} <span className="ml-1 font-normal text-[#626f86]">{rows.length}</span>
          </h2>
          {notice ? <p className="text-[12px] text-[#ae2e24]">{notice}</p> : null}
        </div>
        {data.loading ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#626f86]">Đang tải công việc...</p>
        ) : data.error ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#ae2e24]">{data.error}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#626f86]">
            {hasFilter
              ? "Không có công việc khớp bộ lọc."
              : scope === "team"
                ? team.length === 0
                  ? "Nhóm chưa có công việc nào trong các Space bạn được truy cập."
                  : "Không có công việc trong mục này."
                : mine.length === 0
                  ? "Chưa có công việc nào được giao cho bạn."
                  : "Không có công việc trong mục này."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#eef0f3] text-[11px] font-bold tracking-wide text-[#7a869a]">
                  <th className="w-[84px] px-4 py-2">MÃ</th>
                  <th className="px-3 py-2">CÔNG VIỆC</th>
                  <th className="w-[160px] px-3 py-2">NGƯỜI LÀM</th>
                  <th className="w-[180px] px-3 py-2">SPACE / LIST</th>
                  <th className="w-[100px] px-3 py-2">ƯU TIÊN</th>
                  <th className="w-[104px] px-3 py-2">HẠN CHÓT</th>
                  <th className="w-[170px] px-3 py-2">TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => {
                  const space = data.spaces.find((item) => item.id === task.spaceId);
                  const overdue = isOverdueTask(task);
                  return (
                    <tr key={task.id} className="border-b border-[#eef0f3] text-[13px] text-[#172b4d] hover:bg-[#f7f8f9]">
                      <td className="px-4 py-2.5 font-semibold text-[#0c66e4]">{task.code}</td>
                      <td className="max-w-[280px] px-3 py-2.5 font-medium">
                        <button type="button" onClick={() => setOpenId(task.id)} className="block w-full truncate text-left hover:text-[#0c66e4]">
                          {task.title}
                        </button>
                      </td>
                      <td className="truncate px-3 py-2.5 text-[#44546f]">{task.assigneeName ?? "Chưa gán"}</td>
                      <td className="truncate px-3 py-2.5 text-[#44546f]">
                        {task.spaceName} / {task.listName}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${PRIORITY_TONE[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>
                      </td>
                      <td className={`px-3 py-2.5 text-[12px] ${overdue ? "font-semibold text-[#ae2e24]" : "text-[#626f86]"}`}>{formatDate(task.dueAt)}</td>
                      <td className="px-3 py-2.5">
                        <select
                          aria-label={`Trạng thái ${task.code}`}
                          value={task.statusId}
                          disabled={busyId === task.id || task.assigneeId !== data.userId}
                          title={task.assigneeId !== data.userId ? "Chỉ người được giao mới đổi được trạng thái" : undefined}
                          onChange={(event) => void changeStatus(task, event.target.value)}
                          className={`h-7 max-w-full rounded-full px-2.5 text-[11px] font-bold outline-none disabled:opacity-60 ${BUCKET_TONE[task.bucket]}`}
                        >
                          {(space?.statuses ?? []).map((status) => (
                            <option key={status.id} value={status.id}>
                              {status.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId ? <MemberTaskDialog taskId={openId} onClose={() => setOpenId("")} /> : null}
    </section>
  );
}

function StatCard({
  icon,
  tint,
  label,
  detail,
  value,
  active,
  onClick,
}: {
  icon: ReactNode;
  tint: string;
  label: string;
  detail: ReactNode;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-left ${active ? "border-[#0c66e4] ring-1 ring-[#0c66e4]" : "border-[#dfe1e6] hover:border-[#b3b9c4]"}`}
    >
      <span className="grid size-9 place-items-center rounded-lg" style={{ backgroundColor: tint }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-wide text-[#7a869a]">{label}</span>
        <span className="block truncate text-[12px] text-[#626f86]">{detail}</span>
      </span>
      <span className="text-[28px] leading-none font-semibold text-[#172b4d]">{value}</span>
    </div>
  );
}
