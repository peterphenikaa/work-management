"use client";

import { CalendarDays, ChartColumn, Check, ChevronDown, Copy, Flag, MoreHorizontal, Pencil, Plus, Search, SquareKanban, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";
import { useLeader } from "@/components/leader/leader-shell";
import { LeaderProjects } from "@/components/leader/leader-projects";
import { BoardView } from "@/components/spaces/space-detail";
import { LeaderSprints } from "@/components/leader/leader-sprints";
import { ListDialog } from "@/components/spaces/list-dialog";
import TaskDialog, { type TaskDraft } from "@/components/spaces/task-detail";
import { useShellUser } from "@/components/shell/shell-user";

type Bucket = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

type Overview = {
  workspaceId: string;
  workspaceName: string;
  role: Role;
  period: "week" | "30d" | "month" | "all";
  generatedAt: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number | null;
  overdueTasks: number;
  activeSprints: number;
  spaces: { id: string; name: string; color: "BLUE" | "PURPLE" | "TEAL" | "ORANGE"; icon: string; taskCount: number }[];
  statusDistribution: { name: string; bucket: Bucket; color: string; count: number; percent: number }[];
  attention: {
    id: string;
    code: string;
    title: string;
    priority: Priority;
    dueAt: string;
    overdue: boolean;
    spaceName: string;
  }[];
  members: { userId: string; name: string; role: Role; assigned: number; done: number; workload: number }[];
  activity: { id: string; title: string; spaceName: string | null; createdAt: string }[];
  tasks: {
    id: string;
    code: string;
    title: string;
    bucket: Bucket;
    priority: Priority;
    dueAt: string | null;
    assigneeName: string | null;
    spaceId: string;
    spaceName: string;
  }[];
};

const BUCKET_LABEL: Record<Bucket, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Đánh giá",
  DONE: "Hoàn thành",
};

const BUCKET_TONE: Record<Bucket, string> = {
  TODO: "bg-[#f1f2f4] text-[#44546f]",
  IN_PROGRESS: "bg-[#e9f2ff] text-[#0c66e4]",
  REVIEW: "bg-[#f3f0ff] text-[#5e4db2]",
  DONE: "bg-[#dcfff1] text-[#1f845a]",
};

const BUCKET_COLOR: Record<Bucket, string> = {
  TODO: "#8590a2",
  IN_PROGRESS: "#0c66e4",
  REVIEW: "#6e5dc6",
  DONE: "#22a06b",
};

const PERIODS = [
  { id: "week", label: "Tuần này" },
  { id: "30d", label: "30 ngày" },
  { id: "month", label: "Tháng này" },
  { id: "all", label: "Tất cả" },
] as const;

const SPACE_COLOR = {
  BLUE: "#0C66E4",
  PURPLE: "#6E5DC6",
  TEAL: "#159B91",
  ORANGE: "#E56910",
};

const AVATAR = ["#0c66e4", "#6e5dc6", "#e56910", "#22a06b", "#ae4787", "#334563"];
const PRIORITY_COLOR: Record<Priority, string> = {
  URGENT: "#ca3521",
  HIGH: "#e56910",
  MEDIUM: "#e2b203",
  LOW: "#8590a2",
};

function personColor(name: string) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return AVATAR[hash % AVATAR.length];
}

function formatDue(iso: string) {
  const date = new Date(iso);
  return `Hạn ${date.getDate()} thg ${date.getMonth() + 1}`;
}

function formatAgo(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function donut(rows: { color: string; count: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return "#dfe1e6";
  let cursor = 0;
  const stops = rows
    .filter((row) => row.count > 0)
    .map((row) => {
      const start = cursor;
      cursor += (row.count / total) * 100;
      return `${row.color} ${start}% ${cursor}%`;
    });
  return `conic-gradient(${stops.join(",")})`;
}

export function LeaderDashboard() {
  const leader = useLeader();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "dashboard";
  const current = leader?.current;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("week");
  const [spaceId, setSpaceId] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<Overview>(`/workspaces/${current.id}/overview`, {
        params: { period, ...(spaceId ? { spaceId } : {}) },
      })
      .then((response) => {
        if (!cancelled) setOverview(response.data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được tổng quan");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current, period, spaceId, revision]);

  useEffect(() => {
    setSpaceId("");
    setOverview(null);
  }, [current?.id]);

  if (!current) return null;

  if (tab === "projects") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <LeaderProjects workspaceId={current.id} workspaceName={current.name} />
      </div>
    );
  }

  const spaces = overview?.spaces ?? [];
  const scopeLabel = spaces.find((space) => space.id === spaceId)?.name ?? "Toàn bộ Workspace";

  return (
    <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#626f86]">
            Workspace {current.name} / {tabLabel(tab)}
          </p>
          <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-[#172b4d]">
            {tab === "dashboard" ? `Tổng quan Workspace ${current.name}` : tabLabel(tab)}
          </h1>
          <p className="mt-1 max-w-[640px] text-[13px] text-[#626f86]">{tabDetail(tab)}</p>
        </div>
        <div className="flex items-center gap-2">
          {tab !== "reports" && tab !== "sprint" ? (
            <Link
              href="/home?tab=sprint"
              className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-[#dfe1e6] bg-white px-3 text-[13px] font-semibold text-[#172b4d] hover:bg-[#f7f8f9]"
            >
              <CalendarDays size={15} />
              Quản lý Sprint
            </Link>
          ) : null}
          {tab !== "reports" ? (
            <button
              type="button"
              onClick={() => setCreatingTask(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[#0c66e4] px-3 text-[13px] font-semibold text-white hover:bg-[#0055cc]"
            >
              <Plus size={15} />
              Tạo công việc
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[#f4f5f7] px-3 py-2.5">
        <span className="px-1 text-[11px] font-semibold tracking-wide text-[#626f86] uppercase">Phạm vi tổng quan</span>
        <FilterSelect
          value={spaceId}
          onChange={setSpaceId}
          options={[{ id: "", label: "Toàn bộ Workspace" }, ...spaces.map((space) => ({ id: space.id, label: space.name }))]}
          icon={<SquareKanban size={14} />}
          label={scopeLabel}
        />
        <FilterSelect
          value={period}
          onChange={(value) => setPeriod(value as (typeof PERIODS)[number]["id"])}
          options={PERIODS.map((item) => ({ id: item.id, label: item.label }))}
          icon={<CalendarDays size={14} />}
          label={PERIODS.find((item) => item.id === period)?.label ?? "Tuần này"}
        />
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#22a06b]">
          <span className="size-1.5 rounded-full bg-[#22a06b]" />
          Dữ liệu được cập nhật vừa xong
        </span>
      </div>

      {error ? <p className="text-[13px] text-[#ca3521]">{error}</p> : null}
      {loading && !overview ? <p className="text-[13px] text-[#626f86]">Đang tải tổng quan…</p> : null}

      {overview ? (
        <TabBody
          tab={tab}
          overview={overview}
          workspaceId={current.id}
          workspaceName={current.name}
          spaceId={spaceId}
          refreshKey={revision}
          onChanged={() => setRevision((value) => value + 1)}
          onCreate={() => setCreatingTask(true)}
        />
      ) : null}
      {creatingTask ? (
        <TaskCreator
          workspaceId={current.id}
          workspaceName={current.name}
          spaceId={spaceId}
          spaces={spaces}
          onClose={() => setCreatingTask(false)}
          onSaved={() => {
            setCreatingTask(false);
            setRevision((value) => value + 1);
          }}
        />
      ) : null}
    </section>
  );
}

function TabBody({
  tab,
  overview,
  workspaceId,
  workspaceName,
  spaceId,
  refreshKey,
  onChanged,
  onCreate,
}: {
  tab: string;
  overview: Overview;
  workspaceId: string;
  workspaceName: string;
  spaceId: string;
  refreshKey: number;
  onChanged: () => void;
  onCreate: () => void;
}) {
  if (tab === "projects") return <Projects overview={overview} />;
  if (tab === "board") {
    return (
      <LeaderBoard
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        spaceId={spaceId}
        refreshKey={refreshKey}
        onChanged={onChanged}
      />
    );
  }
  if (tab === "list") {
    return (
      <TaskTable
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        spaceId={spaceId}
        members={overview.members}
        tasks={overview.tasks}
        title="Danh sách công việc"
        onCreate={onCreate}
        onChanged={onChanged}
      />
    );
  }
  if (tab === "backlog") {
    return (
      <TaskTable
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        spaceId={spaceId}
        members={overview.members}
        tasks={overview.tasks.filter((task) => task.bucket === "TODO")}
        title="Product Backlog"
        empty="Chưa có task ở trạng thái cần làm."
        backlog
        onCreate={onCreate}
        onChanged={onChanged}
      />
    );
  }
  if (tab === "sprint") return <LeaderSprints workspaceId={workspaceId} workspaceName={workspaceName} onChanged={onChanged} />;
  if (tab === "reports") return <Reports overview={overview} />;
  return <DashboardBody overview={overview} />;
}

function DashboardBody({ overview }: { overview: Overview }) {
  const rate = overview.completionRate;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Check size={16} className="text-[#0c66e4]" />}
          iconClass="bg-[#e9f2ff]"
          label="Tổng công việc"
          detail="Trên tất cả Space"
          value={String(overview.totalTasks)}
        />
        <Metric
          icon={<ChartColumn size={16} className="text-[#22a06b]" />}
          iconClass="bg-[#dcfff1]"
          label="Tỷ lệ hoàn thành"
          detail={rate === null ? "Chưa có task" : `${overview.completedTasks}/${overview.totalTasks} Task đã Done`}
          value={rate === null ? "—" : `${rate}%`}
        />
        <Metric
          icon={<CalendarDays size={16} className="text-[#ca3521]" />}
          iconClass="bg-[#ffeceb]"
          label="Trễ hạn"
          detail="Cần xử lý sớm"
          value={String(overview.overdueTasks)}
        />
        <Metric
          icon={<RepeatIcon />}
          iconClass="bg-[#f3f0ff]"
          label="Sprint đang hoạt động"
          detail="Đang chạy trong Workspace"
          value={String(overview.activeSprints)}
        />
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="flex flex-col gap-3">
          <article className="rounded-[12px] border border-[#dfe1e6] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold">Phân bố trạng thái công việc</h2>
                <p className="mt-0.5 text-[12px] text-[#626f86]">To Do, In Progress, Review và Done trong phạm vi lọc</p>
              </div>
              <Link href="/home?tab=board" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0c66e4]">
                <SquareKanban size={14} />
                Mở Board
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-8">
              <div className="relative grid size-[148px] place-items-center">
                <div
                  className="size-[148px] rounded-full"
                  style={{ background: donut(overview.statusDistribution) }}
                />
                <div className="absolute grid size-[92px] place-items-center rounded-full bg-white text-center">
                  <span>
                    <span className="block text-[28px] leading-none font-semibold">{overview.totalTasks}</span>
                    <span className="mt-1 block text-[12px] text-[#626f86]">Tổng Task</span>
                  </span>
                </div>
              </div>
              <ul className="min-w-[220px] flex-1">
                {overview.statusDistribution.map((row) => (
                  <li key={row.bucket} className="flex items-center gap-3 border-b border-[#f1f2f4] py-2.5 text-[13px] last:border-b-0">
                    <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="flex-1 text-[#44546f]">{row.name}</span>
                    <span className="w-6 text-right font-semibold">{row.count}</span>
                    <span className="w-10 text-right text-[#626f86]">{row.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <Attention items={overview.attention} />
        </div>
        <div className="flex flex-col gap-3">
          <Members members={overview.members} />
          <Activity items={overview.activity} />
        </div>
      </div>
    </>
  );
}

function Projects({ overview }: { overview: Overview }) {
  if (overview.spaces.length === 0) {
    return <EmptyCard title="Chưa có Space" detail="Workspace này chưa có dự án nào." />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {overview.spaces.map((space) => (
        <article key={space.id} className="rounded-[12px] border border-[#dfe1e6] bg-white p-4">
          <span
            className="grid size-9 place-items-center rounded-[8px] text-[12px] font-semibold text-white"
            style={{ backgroundColor: SPACE_COLOR[space.color] }}
          >
            {initials(space.name)}
          </span>
          <h2 className="mt-3 text-[15px] font-semibold">{space.name}</h2>
          <p className="mt-1 text-[12px] text-[#626f86]">{space.taskCount} công việc</p>
        </article>
      ))}
    </div>
  );
}

type BoardSpace = {
  id: string;
  name: string;
  workspaceName: string;
  statuses: { id: string; name: string; position: number }[];
  members: { userId: string; name: string }[];
  lists: { id: string; name: string; description: string | null; taskCount: number }[];
  tasks: (TaskDraft & { assigneeName: string | null })[];
};

function LeaderBoard({
  workspaceId,
  workspaceName,
  spaceId,
  refreshKey,
  onChanged,
}: {
  workspaceId: string;
  workspaceName: string;
  spaceId: string;
  refreshKey: number;
  onChanged: () => void;
}) {
  const user = useShellUser();
  const [space, setSpace] = useState<BoardSpace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [creatingList, setCreatingList] = useState(false);
  const [picking, setPicking] = useState<string | undefined>();
  const [editor, setEditor] = useState<{ taskId?: string; listId: string; statusId?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  useEffect(() => {
    if (!spaceId) {
      setSpace(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<BoardSpace>(`/workspaces/${workspaceId}/spaces/${spaceId}`)
      .then((response) => {
        if (!cancelled) setSpace(response.data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được board");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, spaceId, reloadKey, refreshKey]);

  function reload() {
    setReloadKey((value) => value + 1);
    onChanged();
  }

  function createTask(statusId?: string) {
    if (!space) return;
    if (space.lists.length === 0) {
      setCreatingList(true);
      return;
    }
    const listId = space.lists.length === 1 ? space.lists[0].id : "";
    if (!listId) {
      setPicking(statusId);
      return;
    }
    setEditor({ listId, statusId });
  }

  async function moveTask(taskId: string, statusId: string) {
    if (!space) return;
    const previous = space;
    const current = space.tasks.find((task) => task.id === taskId);
    if (!current || current.statusId === statusId) return;
    setSpace({ ...space, tasks: space.tasks.map((task) => (task.id === taskId ? { ...task, statusId } : task)) });
    try {
      await api.patch(`/workspaces/${workspaceId}/spaces/${space.id}/tasks/${taskId}`, { statusId });
      onChanged();
    } catch (reason: unknown) {
      setSpace(previous);
      const message = reason instanceof Error ? reason.message : "Không đổi được trạng thái";
      setError(message);
      window.alert(message);
    }
  }

  const filteredTasks = useMemo(() => {
    if (!space) return [];
    const needle = query.trim().toLocaleLowerCase("vi");
    return space.tasks.filter((task) => {
      if (assigneeFilter !== "all" && (task.assigneeId ?? "") !== assigneeFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (!needle) return true;
      return task.title.toLocaleLowerCase("vi").includes(needle) || task.code.toLocaleLowerCase("vi").includes(needle);
    });
  }, [space, query, assigneeFilter, priorityFilter]);

  if (!spaceId) {
    return <p className="px-1 text-[13px] text-[#626f86]">Chọn một space trong phạm vi tổng quan để kéo thả trạng thái và thêm công việc.</p>;
  }
  if (loading && !space) return <p className="px-1 text-[13px] text-[#626f86]">Đang tải board…</p>;
  if (!space) return error ? <p className="text-[13px] text-[#ca3521]">{error}</p> : null;

  const openTask = editor?.taskId ? (space.tasks.find((task) => task.id === editor.taskId) ?? null) : null;

  return (
    <div className="min-w-0 overflow-hidden rounded-[12px] border border-[#dfe1e6] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#eef0f3] px-4 py-2.5">
        <label className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#626f86]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã hoặc tên…"
            className="h-8 w-full rounded-md border border-[#dfe1e6] pr-3 pl-8 text-[12px] text-[#172b4d] outline-none"
          />
        </label>
        <select
          aria-label="Lọc người thực hiện"
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
          className="h-8 rounded-md border border-[#dfe1e6] bg-white px-2 text-[12px] text-[#172b4d]"
        >
          <option value="all">Mọi người</option>
          {space.members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc ưu tiên"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="h-8 rounded-md border border-[#dfe1e6] bg-white px-2 text-[12px] text-[#172b4d]"
        >
          <option value="all">Mọi ưu tiên</option>
          <option value="URGENT">Khẩn cấp</option>
          <option value="HIGH">Cao</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="LOW">Thấp</option>
        </select>
      </div>
      {error ? <p className="px-4 pt-3 text-[13px] text-[#ca3521]">{error}</p> : null}
      {picking !== undefined && space.lists.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#dfe1e6] px-4 py-2">
          <span className="text-[12px] font-semibold text-[#626f86]">Công việc thuộc list</span>
          {space.lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => {
                setEditor({ listId: list.id, statusId: picking });
                setPicking(undefined);
              }}
              className="rounded-[4px] px-2 py-1 text-[13px] text-[#172b4d] hover:bg-[#f4f5f7]"
            >
              {list.name}
            </button>
          ))}
          <button type="button" onClick={() => setPicking(undefined)} className="text-[12px] text-[#626f86]">
            Hủy
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <BoardView
          statuses={space.statuses}
          tasks={filteredTasks}
          onCreate={createTask}
          onMove={(taskId, statusId) => void moveTask(taskId, statusId)}
          onOpen={(taskId) => {
            const task = space.tasks.find((item) => item.id === taskId);
            if (!task) return;
            setEditor({ taskId, listId: task.listId });
          }}
        />
      </div>
      {creatingList ? (
        <ListDialog
          open
          mode="create"
          workspaceId={workspaceId}
          spaceId={space.id}
          list={null}
          onClose={() => setCreatingList(false)}
          onSaved={() => {
            setCreatingList(false);
            reload();
          }}
        />
      ) : null}
      {editor ? (
        <TaskDialog
          key={editor.taskId ?? `new-${editor.listId}-${editor.statusId ?? ""}`}
          workspaceId={workspaceId}
          spaceId={space.id}
          workspaceName={space.workspaceName || workspaceName}
          spaceName={space.name}
          lists={space.lists}
          statuses={space.statuses}
          members={space.members}
          task={openTask}
          presetListId={editor.listId}
          presetStatusId={editor.statusId}
          currentUserId={user?.id ?? ""}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function TaskTable({
  workspaceId,
  workspaceName,
  spaceId,
  members,
  tasks,
  title,
  empty = "Chưa có công việc trong phạm vi này.",
  backlog = false,
  onCreate,
  onChanged,
}: {
  workspaceId: string;
  workspaceName: string;
  spaceId: string;
  members: Overview["members"];
  tasks: Overview["tasks"];
  title: string;
  empty?: string;
  backlog?: boolean;
  onCreate?: () => void;
  onChanged: () => void;
}) {
  const user = useShellUser();
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [spaceMeta, setSpaceMeta] = useState<{
    id: string;
    name: string;
    workspaceName: string;
    statuses: { id: string; name: string }[];
    members: { userId: string; name: string }[];
    lists: { id: string; name: string }[];
    tasks: (TaskDraft & { assigneeName: string | null })[];
  } | null>(null);
  const [editor, setEditor] = useState<{ taskId?: string; listId: string; spaceId: string } | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId) {
      setSpaceMeta(null);
      return;
    }
    let cancelled = false;
    api
      .get<NonNullable<typeof spaceMeta>>(`/workspaces/${workspaceId}/spaces/${spaceId}`)
      .then((response) => {
        if (!cancelled) setSpaceMeta(response.data);
      })
      .catch(() => {
        if (!cancelled) setSpaceMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, spaceId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return tasks.filter((task) => {
      if (assigneeFilter === "__none__" && task.assigneeName) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "__none__" && task.assigneeName !== assigneeFilter) return false;
      if (statusFilter !== "all" && task.bucket !== statusFilter) return false;
      if (!needle) return true;
      return task.title.toLocaleLowerCase("vi").includes(needle) || task.code.toLocaleLowerCase("vi").includes(needle);
    });
  }, [tasks, query, assigneeFilter, statusFilter]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const task of tasks) if (task.assigneeName) names.add(task.assigneeName);
    return [...names].sort((a, b) => a.localeCompare(b, "vi"));
  }, [tasks]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? filtered.map((task) => task.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((row) => row !== id)));
  }

  async function bulkPatch(payload: { statusId?: string; assigneeId?: string | null }) {
    const rows = filtered.filter((task) => selected.includes(task.id));
    if (rows.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const bySpace = new Map<string, string[]>();
      for (const row of rows) {
        if (!row.spaceId) continue;
        const list = bySpace.get(row.spaceId) ?? [];
        list.push(row.id);
        bySpace.set(row.spaceId, list);
      }
      if (bySpace.size === 0) {
        setError("Không xác định được space để cập nhật hàng loạt");
        return;
      }
      for (const [targetSpaceId, taskIds] of bySpace) {
        await api.post(`/workspaces/${workspaceId}/spaces/${targetSpaceId}/tasks/bulk`, { taskIds, ...payload });
      }
      setSelected([]);
      onChanged();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được hàng loạt");
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    const rows = filtered.filter((task) => selected.includes(task.id));
    if (rows.length === 0) return;
    if (!window.confirm(`Xóa ${rows.length} công việc đã chọn?`)) return;
    setBusy(true);
    setError("");
    try {
      await Promise.all(
        rows.map((task) => api.delete(`/workspaces/${workspaceId}/spaces/${task.spaceId}/tasks/${task.id}`)),
      );
      setSelected([]);
      onChanged();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không xóa được công việc");
    } finally {
      setBusy(false);
    }
  }

  async function openTask(task: Overview["tasks"][number]) {
    try {
      const response = await api.get<{
        id: string;
        name: string;
        workspaceName: string;
        statuses: { id: string; name: string }[];
        members: { userId: string; name: string }[];
        lists: { id: string; name: string }[];
        tasks: (TaskDraft & { assigneeName: string | null })[];
      }>(`/workspaces/${workspaceId}/spaces/${task.spaceId}`);
      const found = response.data.tasks.find((row) => row.id === task.id);
      if (!found) return;
      setSpaceMeta(response.data);
      setEditor({ taskId: found.id, listId: found.listId, spaceId: task.spaceId });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không mở được công việc");
    }
  }

  async function assignTask(task: Overview["tasks"][number], assigneeId: string) {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/workspaces/${workspaceId}/spaces/${task.spaceId}/tasks/${task.id}`, {
        assigneeId: assigneeId || null,
      });
      onChanged();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không giao được việc");
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  async function deleteTask(task: Overview["tasks"][number]) {
    if (!window.confirm(`Xóa ${task.code}?`)) return;
    setBusy(true);
    try {
      await api.delete(`/workspaces/${workspaceId}/spaces/${task.spaceId}/tasks/${task.id}`);
      onChanged();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không xóa được công việc");
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  }

  async function copyLink(task: Overview["tasks"][number]) {
    const url = `${window.location.origin}/workspaces/${workspaceId}/spaces/${task.spaceId}`;
    try {
      await navigator.clipboard.writeText(`${task.code} · ${task.title}\n${url}`);
    } catch {
      // ignore
    }
    setMenuId(null);
  }

  const openDraft =
    editor && spaceMeta ? (editor.taskId ? (spaceMeta.tasks.find((task) => task.id === editor.taskId) ?? null) : null) : null;

  return (
    <article className="overflow-hidden rounded-[12px] border border-[#dfe1e6] bg-white">
      <div className="border-b border-[#dfe1e6] px-4 py-3">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {backlog ? (
          <p className="mt-1 text-[12px] text-[#626f86]">
            Backlog hiển thị task cần làm trong phạm vi đang lọc — không phụ thuộc khoảng “Tuần này”.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#626f86]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã hoặc tên…"
              className="h-8 w-full rounded-md border border-[#dfe1e6] pr-3 pl-8 text-[12px] outline-none"
            />
          </label>
          <select
            aria-label="Lọc người thực hiện"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="h-8 rounded-md border border-[#dfe1e6] bg-white px-2 text-[12px]"
          >
            <option value="all">Mọi người</option>
            <option value="__none__">Chưa giao</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-8 rounded-md border border-[#dfe1e6] bg-white px-2 text-[12px]"
          >
            <option value="all">Mọi trạng thái</option>
            {(Object.keys(BUCKET_LABEL) as Bucket[]).map((bucket) => (
              <option key={bucket} value={bucket}>
                {BUCKET_LABEL[bucket]}
              </option>
            ))}
          </select>
        </div>
        {backlog && onCreate ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!quickTitle.trim()) return;
              onCreate();
              setQuickTitle("");
            }}
          >
            <input
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
              placeholder="Thêm nhanh vào backlog…"
              className="h-8 min-w-0 flex-1 rounded-md border border-[#dfe1e6] px-2.5 text-[12px] outline-none"
            />
            <button type="submit" className="h-8 rounded-md bg-[#0c66e4] px-3 text-[12px] font-semibold text-white">
              Thêm
            </button>
          </form>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#eef0f3] bg-[#f7f8f9] px-4 py-2">
          <span className="text-[12px] font-semibold text-[#44546f]">Đã chọn {selected.length}</span>
          <button type="button" disabled={busy} onClick={() => void bulkDelete()} className="h-7 rounded border border-[#dfe1e6] bg-white px-2 text-[12px] font-semibold text-[#ae2e24]">
            Xóa
          </button>
          {spaceMeta ? (
            <select
              aria-label="Đổi trạng thái hàng loạt"
              disabled={busy}
              defaultValue=""
              onChange={(event) => {
                const statusId = event.target.value;
                if (statusId) void bulkPatch({ statusId });
                event.target.value = "";
              }}
              className="h-7 rounded border border-[#dfe1e6] bg-white px-2 text-[12px]"
            >
              <option value="">Đổi trạng thái…</option>
              {spaceMeta.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Giao việc hàng loạt"
            disabled={busy}
            defaultValue=""
            onChange={(event) => {
              const assigneeId = event.target.value;
              if (assigneeId !== "") void bulkPatch({ assigneeId: assigneeId === "__none__" ? null : assigneeId });
              event.target.value = "";
            }}
            className="h-7 rounded border border-[#dfe1e6] bg-white px-2 text-[12px]"
          >
            <option value="">Giao cho…</option>
            <option value="__none__">Chưa giao</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setSelected([])} className="ml-auto text-[12px] text-[#626f86]">
            Bỏ chọn
          </button>
        </div>
      ) : null}

      {error ? <p className="px-4 pt-2 text-[12px] text-[#ae2e24]">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#eef0f3] text-[11px] font-bold tracking-wide text-[#7a869a]">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  checked={filtered.length > 0 && selected.length === filtered.length}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
              <th className="w-[88px] px-2 py-2 font-bold">MÃ</th>
              <th className="px-2 py-2 font-bold">TÊN</th>
              <th className="w-[120px] px-2 py-2 font-bold">STATUS</th>
              <th className="w-[140px] px-2 py-2 font-bold">NGƯỜI THỰC HIỆN</th>
              <th className="w-[100px] px-2 py-2 font-bold">HẠN</th>
              <th className="w-10 px-2 py-2">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-[#626f86]">
                  {empty}
                </td>
              </tr>
            ) : (
              filtered.map((task) => (
                <tr key={task.id} className="group border-b border-[#f1f2f4] text-[13px] last:border-b-0 hover:bg-[#f7f8f9]">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${task.code}`}
                      checked={selected.includes(task.id)}
                      onChange={(event) => toggleOne(task.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-2.5 font-semibold text-[#0c66e4]">
                    <button type="button" onClick={() => void openTask(task)} className="text-left hover:underline">
                      {task.code}
                    </button>
                  </td>
                  <td className="max-w-[240px] truncate px-2 py-2.5 font-medium">
                    <button type="button" onClick={() => void openTask(task)} className="block w-full truncate text-left">
                      {task.title}
                    </button>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${BUCKET_TONE[task.bucket]}`}>
                      {BUCKET_LABEL[task.bucket]}
                    </span>
                  </td>
                  <td className="truncate px-2 py-2.5 text-[#626f86]">{task.assigneeName ?? "Chưa giao"}</td>
                  <td className={`px-2 py-2.5 ${task.dueAt ? "text-[#626f86]" : "text-[#7a869a]"}`}>
                    {task.dueAt ? formatDue(task.dueAt) : "Không hạn"}
                  </td>
                  <td className="relative px-2 py-2.5">
                    <button
                      type="button"
                      aria-label={`Thao tác ${task.code}`}
                      onClick={() => setMenuId((current) => (current === task.id ? null : task.id))}
                      className="grid size-7 place-items-center rounded text-[#626f86] opacity-0 group-hover:opacity-100 hover:bg-white"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {menuId === task.id ? (
                      <div className="absolute top-9 right-2 z-20 w-48 rounded-md border border-[#dfe1e6] bg-white p-1 shadow-[0_8px_24px_rgba(9,30,66,0.16)]">
                        <button type="button" onClick={() => void openTask(task)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[#f7f8f9]">
                          <Pencil size={13} /> Sửa
                        </button>
                        <label className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-[#f7f8f9]">
                          Giao
                          <select
                            aria-label={`Giao ${task.code}`}
                            defaultValue="__pick__"
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "__pick__") return;
                              void assignTask(task, value === "__none__" ? "" : value);
                            }}
                            className="h-6 min-w-0 flex-1 rounded border border-[#dfe1e6] text-[11px]"
                          >
                            <option value="__pick__">Chọn…</option>
                            <option value="__none__">Chưa giao</option>
                            {members.map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" onClick={() => void copyLink(task)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[#f7f8f9]">
                          <Copy size={13} /> Sao chép liên kết
                        </button>
                        <button type="button" onClick={() => void deleteTask(task)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[#ae2e24] hover:bg-[#fff5f4]">
                          <Trash2 size={13} /> Xóa
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onCreate ? (
        <button type="button" onClick={onCreate} className="flex h-10 items-center gap-1.5 px-4 text-[13px] font-semibold text-[#0c66e4] hover:bg-[#f7f8f9]">
          <Plus size={14} />
          Thêm công việc
        </button>
      ) : null}

      {editor && spaceMeta ? (
        <TaskDialog
          key={editor.taskId ?? `new-${editor.listId}`}
          workspaceId={workspaceId}
          spaceId={editor.spaceId}
          workspaceName={spaceMeta.workspaceName || workspaceName}
          spaceName={spaceMeta.name}
          lists={spaceMeta.lists}
          statuses={spaceMeta.statuses}
          members={spaceMeta.members}
          task={openDraft}
          presetListId={editor.listId}
          currentUserId={user?.id ?? ""}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            onChanged();
          }}
        />
      ) : null}
    </article>
  );
}

function TaskCreator({
  workspaceId,
  workspaceName,
  spaceId,
  spaces,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  workspaceName: string;
  spaceId: string;
  spaces: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useShellUser();
  const [chosenSpace, setChosenSpace] = useState(spaceId);
  const [space, setSpace] = useState<BoardSpace | null>(null);
  const [error, setError] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [editor, setEditor] = useState<{ listId: string } | null>(null);

  useEffect(() => {
    if (!chosenSpace) return;
    let cancelled = false;
    setError("");
    api
      .get<BoardSpace>(`/workspaces/${workspaceId}/spaces/${chosenSpace}`)
      .then((response) => {
        if (cancelled) return;
        const data = response.data;
        setSpace(data);
        if (data.lists.length === 0) setCreatingList(true);
        else if (data.lists.length === 1) setEditor({ listId: data.lists[0].id });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không mở được form tạo công việc");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, chosenSpace]);

  if (!chosenSpace) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/50 p-4" onMouseDown={onClose}>
        <div role="dialog" aria-labelledby="pick-space-title" className="w-full max-w-sm rounded-xl bg-white p-4 shadow-[0_18px_50px_rgba(9,30,66,0.28)]" onMouseDown={(event) => event.stopPropagation()}>
          <h2 id="pick-space-title" className="text-[16px] font-semibold text-[#172b4d]">Chọn space</h2>
          <p className="mt-1 text-[13px] text-[#626f86]">Công việc được tạo trong space đang lọc.</p>
          {spaces.length === 0 ? <p className="mt-3 text-[13px] text-[#626f86]">Workspace chưa có space.</p> : null}
          <div className="mt-3 flex flex-col gap-1">
            {spaces.map((item) => (
              <button key={item.id} type="button" onClick={() => setChosenSpace(item.id)} className="rounded-md px-2 py-2 text-left text-[13px] text-[#172b4d] hover:bg-[#f4f5f7]">
                {item.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="mt-3 text-[13px] font-semibold text-[#626f86]">
            Hủy
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/50 p-4" onMouseDown={onClose}>
        <div className="w-full max-w-sm rounded-xl bg-white p-4" onMouseDown={(event) => event.stopPropagation()}>
          <p className="text-[13px] text-[#ca3521]">{error}</p>
          <button type="button" onClick={onClose} className="mt-3 text-[13px] font-semibold text-[#0c66e4]">
            Đóng
          </button>
        </div>
      </div>
    );
  }

  if (!space) return null;

  if (creatingList) {
    return (
      <ListDialog
        open
        mode="create"
        workspaceId={workspaceId}
        spaceId={space.id}
        list={null}
        onClose={onClose}
        onSaved={() => {
          setCreatingList(false);
          setSpace(null);
          setEditor(null);
          onSaved();
        }}
      />
    );
  }

  if (!editor) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/50 p-4" onMouseDown={onClose}>
        <div role="dialog" aria-labelledby="pick-list-title" className="w-full max-w-sm rounded-xl bg-white p-4 shadow-[0_18px_50px_rgba(9,30,66,0.28)]" onMouseDown={(event) => event.stopPropagation()}>
          <h2 id="pick-list-title" className="text-[16px] font-semibold text-[#172b4d]">Công việc thuộc list</h2>
          <div className="mt-3 flex flex-col gap-1">
            {space.lists.map((list) => (
              <button key={list.id} type="button" onClick={() => setEditor({ listId: list.id })} className="rounded-md px-2 py-2 text-left text-[13px] text-[#172b4d] hover:bg-[#f4f5f7]">
                {list.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="mt-3 text-[13px] font-semibold text-[#626f86]">
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <TaskDialog
      workspaceId={workspaceId}
      spaceId={space.id}
      workspaceName={space.workspaceName || workspaceName}
      spaceName={space.name}
      lists={space.lists}
      statuses={space.statuses}
      members={space.members}
      task={null}
      presetListId={editor.listId}
      currentUserId={user?.id ?? ""}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function Reports({ overview }: { overview: Overview }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <article className="rounded-[12px] border border-[#dfe1e6] bg-white p-5">
        <h2 className="text-[16px] font-semibold">Tiến độ</h2>
        <p className="mt-2 text-[28px] font-semibold">{overview.completionRate === null ? "—" : `${overview.completionRate}%`}</p>
        <p className="text-[13px] text-[#626f86]">
          {overview.completedTasks} hoàn thành / {overview.totalTasks} công việc · {overview.overdueTasks} trễ hạn
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <div className="relative grid size-[120px] place-items-center">
            <div className="size-[120px] rounded-full" style={{ background: donut(overview.statusDistribution) }} />
            <div className="absolute grid size-[72px] place-items-center rounded-full bg-white text-center">
              <span className="text-[20px] leading-none font-semibold">{overview.totalTasks}</span>
            </div>
          </div>
          <ul className="min-w-[180px] flex-1">
            {overview.statusDistribution.map((row) => (
              <li key={row.bucket} className="flex items-center gap-2 py-1 text-[12px]">
                <span className="size-2 rounded-full" style={{ backgroundColor: row.color || BUCKET_COLOR[row.bucket] }} />
                <span className="flex-1 text-[#44546f]">{row.name}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </article>
      <Members members={overview.members} coloredBars />
    </div>
  );
}

function Attention({ items }: { items: Overview["attention"] }) {
  return (
    <article className="rounded-[12px] border border-[#dfe1e6] bg-white">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-[16px] font-semibold">Công việc cần chú ý</h2>
          <p className="mt-0.5 text-[12px] text-[#626f86]">Task quá hạn hoặc sắp đến deadline</p>
        </div>
        {items.length > 0 ? (
          <span className="rounded-full bg-[#ffeceb] px-2 py-0.5 text-[12px] font-semibold text-[#ca3521]">
            {items.length} cần xử lý
          </span>
        ) : null}
      </div>
      {items.length === 0 ? <p className="px-5 py-6 text-[13px] text-[#626f86]">Không có task sắp đến hạn.</p> : null}
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 border-t border-[#f1f2f4] px-5 py-3">
            <span className="grid size-5 shrink-0 place-items-center rounded-[4px] bg-[#0c66e4] text-white">
              <Check size={12} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-[#172b4d]">{item.title}</span>
              <span className={`mt-0.5 block text-[12px] ${item.overdue ? "text-[#ca3521]" : "text-[#e56910]"}`}>
                {item.code} · {formatDue(item.dueAt)}
              </span>
            </span>
            <Flag size={14} style={{ color: PRIORITY_COLOR[item.priority] }} />
          </li>
        ))}
      </ul>
      <div className="px-5 py-3">
        <Link href="/home?tab=list" className="text-[13px] font-semibold text-[#44546f] hover:text-[#0c66e4]">
          Xem tất cả công việc
        </Link>
      </div>
    </article>
  );
}

function workloadBarColor(percent: number) {
  if (percent >= 80) return "#22a06b";
  if (percent >= 50) return "#0c66e4";
  if (percent >= 25) return "#e56910";
  return "#8590a2";
}

function Members({ members, coloredBars = false }: { members: Overview["members"]; coloredBars?: boolean }) {
  return (
    <article className="rounded-[12px] border border-[#dfe1e6] bg-white">
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <h2 className="text-[16px] font-semibold">Năng suất thành viên</h2>
          <p className="mt-0.5 text-[12px] text-[#626f86]">Task được giao, hoàn thành và khối lượng hiện tại</p>
        </div>
        <Link href="/home?tab=reports" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#44546f]">
          <ChartColumn size={14} />
          Chi tiết
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1.4fr)_72px_56px_minmax(90px,1fr)] px-5 pb-1 text-[11px] font-semibold tracking-wide text-[#7a869a] uppercase">
        <span>Thành viên</span>
        <span className="text-center">Được giao</span>
        <span className="text-center">Done</span>
        <span>Khối lượng</span>
      </div>
      <ul>
        {members.map((member) => (
          <li key={member.userId} className="grid grid-cols-[minmax(0,1.4fr)_72px_56px_minmax(90px,1fr)] items-center px-5 py-2.5">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: personColor(member.name) }}
              >
                {initials(member.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{member.name}</span>
                <span className="block text-[11px] text-[#626f86]">{ROLE_LABEL[member.role]}</span>
              </span>
            </span>
            <span className="text-center text-[13px]">{member.assigned}</span>
            <span className="text-center text-[13px]">{member.done}</span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ebecf0]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${member.workload}%`,
                    backgroundColor: coloredBars ? workloadBarColor(member.workload) : "#0c66e4",
                  }}
                />
              </span>
              <span className="w-8 text-right text-[12px] text-[#626f86]">{member.workload}%</span>
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Activity({ items }: { items: Overview["activity"] }) {
  return (
    <article className="rounded-[12px] border border-[#dfe1e6] bg-white">
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <h2 className="text-[16px] font-semibold">Hoạt động gần đây</h2>
          <p className="mt-0.5 text-[12px] text-[#626f86]">Cập nhật mới trên toàn Workspace</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#22a06b]">
          <span className="size-1.5 rounded-full bg-[#22a06b]" />
          Trực tiếp
        </span>
      </div>
      {items.length === 0 ? <p className="px-5 py-6 text-[13px] text-[#626f86]">Chưa có hoạt động trong kỳ này.</p> : null}
      <ul className="mt-2 pb-2">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 border-t border-[#f1f2f4] px-5 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9f2ff] text-[#0c66e4]">
              <Check size={14} />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-[#172b4d]">{item.title}</span>
              <span className="mt-0.5 block text-[12px] text-[#626f86]">
                {formatAgo(item.createdAt)}
                {item.spaceName ? ` · ${item.spaceName}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Metric({
  icon,
  iconClass,
  label,
  detail,
  value,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <article className="flex items-center gap-3 rounded-[12px] border border-[#dfe1e6] bg-white px-4 py-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-[8px] ${iconClass}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[#172b4d]">{label}</span>
        <span className="block truncate text-[12px] text-[#626f86]">{detail}</span>
      </span>
      <span className="text-[28px] leading-none font-semibold tracking-[-0.03em]">{value}</span>
    </article>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  icon,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label className="relative inline-flex h-8 items-center">
      <span className="pointer-events-none absolute left-2.5 text-[#44546f]">{icon}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 appearance-none rounded-[6px] border border-[#dfe1e6] bg-white pr-7 pl-8 text-[13px] font-medium text-[#172b4d] outline-none"
      >
        {options.map((option) => (
          <option key={option.id || "all"} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 text-[#626f86]" />
    </label>
  );
}

function EmptyCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="rounded-[12px] border border-[#dfe1e6] bg-white px-5 py-10">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <p className="mt-1 text-[13px] text-[#626f86]">{detail}</p>
    </article>
  );
}

function RepeatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8a5 5 0 0 1 8.3-3.7L13 6" stroke="#6e5dc6" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 3.5V6h-2.5" stroke="#6e5dc6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8a5 5 0 0 1-8.3 3.7L3 10" stroke="#6e5dc6" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 12.5V10h2.5" stroke="#6e5dc6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function tabLabel(tab: string) {
  const labels: Record<string, string> = {
    dashboard: "Tổng quan",
    projects: "Dự án",
    board: "Board",
    list: "List",
    backlog: "Backlog",
    sprint: "Sprint",
    reports: "Báo cáo",
  };
  return labels[tab] ?? "Tổng quan";
}

function tabDetail(tab: string) {
  if (tab === "projects") return "Các Space trong workspace bạn đang làm trưởng nhóm hoặc thành viên.";
  if (tab === "board") return "Công việc nhóm theo trạng thái trong phạm vi đang lọc.";
  if (tab === "list") return "Danh sách công việc trong phạm vi đang lọc.";
  if (tab === "backlog") return "Task đang ở trạng thái cần làm, chưa tính là đã xong.";
  if (tab === "sprint") return "Theo dõi Sprint đang chạy. Mỗi Space có tối đa một Sprint active.";
  if (tab === "reports") return "Tỷ lệ hoàn thành và khối lượng của từng thành viên.";
  return "Theo dõi toàn bộ Space, Sprint, tiến độ và các cập nhật quan trọng trước khi đi sâu vào dự án.";
}
