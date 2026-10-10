"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Ellipsis,
  List,
  Pencil,
  Plus,
  Search,
  Sparkles,
  SquareCheckBig,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListDialog, type ListDraft } from "@/components/spaces/list-dialog";
import TaskDialog from "@/components/spaces/task-detail";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";
import { useShellUser } from "@/components/shell/app-shell";
import { CreateSpaceDialog, spaceIcon, spaceSwatch, type EditableSpace, type SpaceColor, type SpaceIcon, type SpaceView } from "@/components/workspaces/space-dialog";

type Status = { id: string; name: string; position: number };
type Member = { userId: string; name: string; email: string; role: Role };
type WorkList = { id: string; name: string; description: string | null; taskCount: number };
type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type TaskItem = {
  id: string;
  listId: string;
  code: string;
  title: string;
  description: string | null;
  statusId: string;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  reporterId: string;
  reporterName: string;
  dueAt: string | null;
  createdAt?: string;
};
type SpaceDetailData = {
  id: string;
  name: string;
  description: string | null;
  icon: SpaceIcon;
  color: SpaceColor;
  accessType: "PRIVATE" | "PUBLIC";
  views: SpaceView[];
  workspaceName: string;
  statuses: Status[];
  members: Member[];
  lists: WorkList[];
  tasks: TaskItem[];
};

const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Khẩn cấp",
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};

const VIEW_META: { id: SpaceView; label: string; src: string }[] = [
  { id: "LIST", label: "List", src: "/space/list.svg" },
  { id: "KANBAN", label: "Board", src: "/space/kanban.svg" },
  { id: "CALENDAR", label: "Calendar", src: "/space/calendar.svg" },
  { id: "AGILE", label: "Gantt", src: "/space/sprint.svg" },
];

const AVATAR = ["#0c66e4", "#6e5dc6", "#e56910", "#22a06b", "#ae4787", "#334563"];
const WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const SELECT =
  "h-8 appearance-none rounded-md border border-[#dfe1e6] bg-white pr-7 pl-2.5 text-[12px] text-[#44546f] outline-none";

export function SpaceDetail() {
  const params = useParams<{ id: string; spaceId: string }>();
  const user = useShellUser();
  const [space, setSpace] = useState<SpaceDetailData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<SpaceView>("LIST");
  const [query, setQuery] = useState("");
  const [statusId, setStatusId] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [listId, setListId] = useState("all");
  const [priority, setPriority] = useState("all");
  const [due, setDue] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);
  const loadedSpaceId = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (user?.role !== "ADMIN" || !params.id || !params.spaceId) return;
    let cancelled = false;
    if (loadedSpaceId.current !== params.spaceId) setLoading(true);
    api
      .get<SpaceDetailData>(`/workspaces/${params.id}/spaces/${params.spaceId}`)
      .then((response) => {
        if (cancelled) return;
        loadedSpaceId.current = params.spaceId;
        setSpace(response.data);
        const available = response.data.views.length > 0 ? response.data.views : VIEW_META.map((item) => item.id);
        setView((current) => (available.includes(current) ? current : (available[0] ?? "LIST")));
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Không tải được space");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, params.spaceId, reloadKey, user?.role]);

  const views = useMemo(() => {
    const enabled = new Set(space?.views.length ? space.views : VIEW_META.map((item) => item.id));
    return VIEW_META.filter((item) => enabled.has(item.id));
  }, [space]);

  if (user && user.role !== "ADMIN") {
    return <section className="px-8 pt-8 text-[14px] text-[#626f86]">Chỉ quản trị viên xem được space này.</section>;
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-[#f7f8f9] px-6 py-5">
      {loading ? <p className="text-[13px] text-[#626f86]">Đang tải space…</p> : null}
      {!loading && error ? <p className="text-[13px] text-[#ae2e24]">{error}</p> : null}
      {space ? (
        <SpaceBoard
          workspaceId={params.id}
          space={space}
          view={view}
          views={views}
          query={query}
          statusId={statusId}
          memberId={memberId}
          priority={priority}
          due={due}
          listId={listId}
          onView={setView}
          onQuery={setQuery}
          onStatus={setStatusId}
          onMember={setMemberId}
          onPriority={setPriority}
          onDue={setDue}
          onList={setListId}
          onMove={async (taskId, nextStatusId) => {
            const current = space?.tasks.find((task) => task.id === taskId);
            if (!current || current.statusId === nextStatusId) return;
            setSpace((value) =>
              value
                ? { ...value, tasks: value.tasks.map((task) => (task.id === taskId ? { ...task, statusId: nextStatusId } : task)) }
                : value,
            );
            try {
              await api.patch(`/workspaces/${params.id}/spaces/${params.spaceId}/tasks/${taskId}`, { statusId: nextStatusId });
            } catch {
              setReloadKey((value) => value + 1);
            }
          }}
          currentUserId={user?.id ?? ""}
          onRefresh={() => setReloadKey((value) => value + 1)}
          onSaved={(nextSpaceId, nextListId) => {
            if (nextSpaceId !== params.spaceId) {
              router.push(`/workspaces/${params.id}/spaces/${nextSpaceId}`);
              return;
            }
            setListId(nextListId);
            setReloadKey((value) => value + 1);
          }}
        />
      ) : null}
    </section>
  );
}

function toEditableSpace(space: SpaceDetailData): EditableSpace {
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    icon: space.icon,
    color: space.color,
    accessType: space.accessType,
    views: space.views,
    statuses: space.statuses.map((status) => ({ id: status.id, name: status.name })),
    members: space.members.map((member) => ({ userId: member.userId, role: member.role })),
  };
}

function SpaceBoard({
  workspaceId,
  space,
  view,
  views,
  query,
  statusId,
  memberId,
  priority,
  due,
  listId,
  onView,
  onQuery,
  onStatus,
  onMember,
  onPriority,
  onDue,
  onList,
  onMove,
  currentUserId,
  onRefresh,
  onSaved,
}: {
  workspaceId: string;
  space: SpaceDetailData;
  view: SpaceView;
  views: typeof VIEW_META;
  query: string;
  statusId: string;
  memberId: string;
  priority: string;
  due: string;
  listId: string;
  onView: (view: SpaceView) => void;
  onQuery: (value: string) => void;
  onStatus: (value: string) => void;
  onMember: (value: string) => void;
  onPriority: (value: string) => void;
  onDue: (value: string) => void;
  onList: (value: string) => void;
  onMove: (taskId: string, statusId: string) => void;
  currentUserId: string;
  onRefresh: () => void;
  onSaved: (spaceId: string, listId: string) => void;
}) {
  const [dialog, setDialog] = useState<"create" | ListDraft | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [findingList, setFindingList] = useState(false);
  const [pickingList, setPickingList] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | undefined>();
  const [editor, setEditor] = useState<{ taskId?: string; listId: string; statusId?: string } | null>(null);
  const [editingSpace, setEditingSpace] = useState(false);
  const [spaceMenu, setSpaceMenu] = useState(false);
  const spaceMenuRef = useRef<HTMLSpanElement>(null);
  const selected = space.lists.find((list) => list.id === listId);
  const selectedList = selected?.name ?? "Tất cả công việc";
  const tasks = useMemo(() => filterTasks(space, { query, statusId, memberId, priority, due, listId }), [space, query, statusId, memberId, priority, due, listId]);
  const doneTasks = space.tasks.filter((task) => isDone(space, task));
  const doingTasks = space.tasks.filter((task) => isDoing(space, task));
  const overdue = space.tasks.filter((task) => isOverdue(space, task));
  const visibleLists = space.lists.filter((list) => list.name.toLocaleLowerCase("vi").includes(listQuery.trim().toLocaleLowerCase("vi")));

  useEffect(() => {
    if (!spaceMenu) return;
    function close(event: MouseEvent) {
      if (!spaceMenuRef.current?.contains(event.target as Node)) setSpaceMenu(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [spaceMenu]);

  function openTask(targetListId: string, nextStatusId?: string) {
    setPickingList(false);
    setEditor({ listId: targetListId, statusId: nextStatusId });
  }

  function openExisting(taskId: string) {
    const task = space.tasks.find((item) => item.id === taskId);
    if (!task) return;
    setEditor({ taskId, listId: task.listId });
  }

  function createTask(statusId?: string) {
    if (space.lists.length === 0) {
      setDialog("create");
      return;
    }
    const target = listId !== "all" ? listId : space.lists.length === 1 ? space.lists[0].id : "";
    if (!target) {
      setPendingStatus(statusId);
      setPickingList(true);
      return;
    }
    openTask(target, statusId);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[13px]">
        <Link href={`/workspaces/${workspaceId}`} className="inline-flex items-center gap-1 font-semibold text-[#44546f] hover:text-[#172b4d]">
          <ChevronLeft size={16} className="-ml-1" />
          Tất cả Space
        </Link>
        <span className="truncate text-[#626f86]">
          {space.workspaceName} / {space.name}
        </span>
      </div>

      <header className="flex items-center gap-4 rounded-xl border border-[#dfe1e6] bg-white px-4 py-3.5">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-xl text-white"
          style={{ backgroundColor: spaceSwatch(space.color) }}
        >
          <img src={spaceIcon(space.icon)} alt="" width={22} height={22} draggable={false} className="brightness-0 invert" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="rounded bg-[#f3f0ff] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#5e4db2]">
              {space.accessType}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-[#dcfff1] px-1.5 py-0.5 text-[10px] font-bold text-[#216e4e]">
              <span className="size-1.5 rounded-full bg-[#22a06b]" />
              Đang hoạt động
            </span>
          </span>
          <span className="mt-1 block truncate text-[20px] font-semibold leading-7 text-[#172b4d]">{space.name}</span>
          <span className="mt-0.5 block truncate text-[13px] text-[#626f86]">
            {space.description?.trim() || "Chưa có mô tả."}
          </span>
        </span>
        <span className="flex items-center">
          {space.members.slice(0, 4).map((member, index) => (
            <Avatar key={member.userId} name={member.name} className={index === 0 ? "" : "-ml-2 ring-2 ring-white"} />
          ))}
          <span className="ml-2 text-[12px] text-[#626f86]">{space.members.length} thành viên</span>
        </span>
        <button
          type="button"
          onClick={() => setEditingSpace(true)}
          className="h-9 shrink-0 rounded-md border border-[#dfe1e6] bg-white px-3 text-[13px] font-semibold text-[#172b4d] hover:bg-[#f7f8f9]"
        >
          Chỉnh sửa Space
        </button>
        <span ref={spaceMenuRef} className="relative">
          <button
            type="button"
            aria-label="Thêm thao tác"
            aria-expanded={spaceMenu}
            onClick={() => setSpaceMenu((open) => !open)}
            className="grid size-9 place-items-center rounded-md text-[#626f86] hover:bg-[#f7f8f9]"
          >
            <Ellipsis size={16} />
          </button>
          {spaceMenu ? (
            <span className="absolute top-10 right-0 z-20 w-52 rounded-md border border-[#dfe1e6] bg-white p-1 shadow-[0_8px_24px_rgba(9,30,66,0.16)]">
              <button
                type="button"
                onClick={() => {
                  setSpaceMenu(false);
                  setEditingSpace(true);
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-[13px] text-[#172b4d] hover:bg-[#f7f8f9]"
              >
                Chỉnh sửa Space
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(window.location.href);
                  setSpaceMenu(false);
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-[13px] text-[#172b4d] hover:bg-[#f7f8f9]"
              >
                Sao chép liên kết
              </button>
            </span>
          ) : null}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<SquareCheckBig size={16} className="text-[#0c66e4]" />} tint="#e9f2ff" label="TỔNG SỐ TASK" detail={`Trong ${space.lists.length} List`} value={String(space.tasks.length)} />
        <Stat icon={<SquareCheckBig size={16} className="text-[#22a06b]" />} tint="#dcfff1" label="ĐÃ HOÀN THÀNH" detail={space.tasks.length ? `${Math.round((doneTasks.length / space.tasks.length) * 100)}% tổng công việc` : "0% tổng công việc"} value={String(doneTasks.length)} />
        <Stat icon={<Sparkles size={16} className="text-[#6e5dc6]" />} tint="#f3f0ff" label="ĐANG LÀM" detail={doingTasks.length ? "Cần theo dõi tiến độ" : "Chưa có trạng thái"} value={String(doingTasks.length)} />
        <Stat icon={<CalendarDays size={16} className="text-[#e56910]" />} tint="#fff3eb" label="QUÁ HẠN" detail="Cần xử lý can thiệp" value={String(overdue.length)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#dfe1e6] px-3 py-2.5">
          <div className="flex rounded-lg bg-[#f1f2f4] p-1">
            {views.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onView(item.id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold ${
                    active ? "bg-white text-[#0c66e4] shadow-sm" : "text-[#626f86]"
                  }`}
                >
                  <img src={item.src} alt="" width={15} height={15} draggable={false} className={active ? "" : "opacity-60"} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#44546f]">
            <List size={15} />
            {selectedList}
          </span>
        </div>

        <div className="flex min-h-[560px]">
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#eef0f3] bg-[#fafbfc]">
            <div className="flex h-11 items-center justify-between px-3">
              <span className="text-[11px] font-bold tracking-wide text-[#7a869a]">LIST TRONG SPACE</span>
              <span className="flex items-center gap-1 text-[#626f86]">
                <button type="button" aria-label="Tìm list" onClick={() => setFindingList((value) => !value)} className="grid size-6 place-items-center rounded hover:bg-[#eef0f3]">
                  <Search size={14} />
                </button>
                <button type="button" aria-label="Tạo list" onClick={() => setDialog("create")} className="grid size-6 place-items-center rounded hover:bg-[#eef0f3]">
                  <Plus size={14} />
                </button>
              </span>
            </div>
            {findingList ? (
              <label className="px-3 pb-2">
                <input
                  value={listQuery}
                  onChange={(event) => setListQuery(event.target.value)}
                  placeholder="Tìm list..."
                  className="h-8 w-full rounded border border-[#dfe1e6] px-2 text-[12px] outline-none"
                />
              </label>
            ) : null}
            <ListRow active={listId === "all"} name="Tất cả công việc" count={space.tasks.length} onClick={() => onList("all")} />
            {visibleLists.map((list) => (
              <ListRow
                key={list.id}
                active={listId === list.id}
                name={list.name}
                count={list.taskCount}
                onClick={() => onList(list.id)}
                onEdit={() => setDialog(list)}
              />
            ))}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start gap-2 border-b border-[#eef0f3] px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <label className="relative w-[220px] shrink-0">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#626f86]" />
                <input
                  value={query}
                  onChange={(event) => onQuery(event.target.value)}
                  placeholder="Tìm mã hoặc tên công việc..."
                  className="h-8 w-full rounded-md border border-[#dfe1e6] pr-3 pl-8 text-[12px] text-[#172b4d] outline-none placeholder:text-[#a5adba]"
                />
              </label>
                <Filter label="Mọi trạng thái" value={statusId} onChange={onStatus} options={[{ id: "all", label: "Mọi trạng thái" }, ...space.statuses.map((status) => ({ id: status.id, label: status.name }))]} />
                <Filter label="Mọi người thực hiện" value={memberId} onChange={onMember} options={[{ id: "all", label: "Mọi người thực hiện" }, ...space.members.map((member) => ({ id: member.userId, label: member.name }))]} />
                <Filter
                  label="Mọi ưu tiên"
                  value={priority}
                  onChange={onPriority}
                  options={[{ id: "all", label: "Mọi ưu tiên" }, ...(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((item) => ({ id: item, label: PRIORITY_LABEL[item] }))]}
                />
                <Filter
                  label="Mọi hạn hoàn thành"
                  value={due}
                  onChange={onDue}
                  options={[
                    { id: "all", label: "Mọi hạn hoàn thành" },
                    { id: "overdue", label: "Quá hạn" },
                    { id: "dated", label: "Có hạn" },
                    { id: "none", label: "Chưa có hạn" },
                  ]}
                />
                <Filter label="Sắp xếp mặc định" value="all" onChange={() => undefined} options={[{ id: "all", label: "Sắp xếp mặc định" }]} />
              </div>
              <span className="relative shrink-0">
                <button type="button" onClick={() => createTask()} className="inline-flex h-8 items-center gap-1 rounded bg-[#0c66e4] px-2.5 text-[12px] font-semibold text-white">
                  <Plus size={14} />
                  Tạo công việc
                </button>
                {pickingList ? (
                  <span className="absolute top-9 right-0 z-10 w-52 rounded-md border border-[#dfe1e6] bg-white p-1 shadow-[0_8px_24px_rgba(9,30,66,0.16)]">
                    <span className="block px-2 py-1.5 text-[11px] font-bold text-[#7a869a]">Công việc thuộc list</span>
                    {space.lists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => openTask(list.id, pendingStatus)}
                        className="block w-full rounded px-2 py-1.5 text-left text-[13px] text-[#172b4d] hover:bg-[#f7f8f9]"
                      >
                        {list.name}
                      </button>
                    ))}
                  </span>
                ) : null}
              </span>
            </div>
            {view === "LIST" ? (
              <ListView statuses={space.statuses} tasks={tasks} hasLists={space.lists.length > 0} filtered={query.trim().length > 0 || statusId !== "all" || memberId !== "all"} onCreate={() => createTask()} onCreateList={() => setDialog("create")} onOpen={openExisting} />
            ) : null}
            {view === "KANBAN" ? <BoardView statuses={space.statuses} tasks={tasks} onCreate={createTask} onMove={onMove} onOpen={openExisting} /> : null}
            {view === "CALENDAR" ? <CalendarView tasks={tasks} onOpen={openExisting} /> : null}
            {view === "AGILE" ? <GanttView tasks={tasks} /> : null}
          </div>
        </div>
      </div>

      <ListDialog
        open={dialog !== null}
        mode={dialog === "create" ? "create" : "edit"}
        workspaceId={workspaceId}
        spaceId={space.id}
        list={dialog && dialog !== "create" ? dialog : null}
        onClose={() => setDialog(null)}
        onSaved={onSaved}
      />
      {editor ? (
        <TaskDialog
          key={editor.taskId ?? `new-${editor.listId}-${editor.statusId ?? ""}`}
          workspaceId={workspaceId}
          spaceId={space.id}
          lists={space.lists}
          statuses={space.statuses}
          members={space.members}
          workspaceName={space.workspaceName}
          spaceName={space.name}
          task={editor.taskId ? (space.tasks.find((task) => task.id === editor.taskId) ?? null) : null}
          presetListId={editor.listId}
          presetStatusId={editor.statusId}
          currentUserId={currentUserId}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            onRefresh();
          }}
        />
      ) : null}
      {editingSpace ? (
        <CreateSpaceDialog
          workspaceId={workspaceId}
          space={toEditableSpace(space)}
          onClose={() => setEditingSpace(false)}
          onCreated={() => {
            setEditingSpace(false);
            onRefresh();
          }}
        />
      ) : null}

      <footer className="flex items-center gap-4 rounded-xl border border-[#dfe1e6] bg-white px-4 py-3">
        <span className="shrink-0">
          <span className="block text-[13px] font-semibold text-[#172b4d]">Thành viên Space</span>
          <span className="block text-[12px] text-[#626f86]">Người tham gia và phụ trách công việc trong Space.</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
          {space.members.length === 0 ? (
            <span className="text-[12px] text-[#626f86]">Chưa có thành viên.</span>
          ) : (
            space.members.map((member) => (
              <span key={member.userId} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe1e6] px-2 py-1.5">
                <span className="grid size-3.5 place-items-center rounded-[3px] bg-[#0c66e4] text-[9px] text-white">✓</span>
                <Avatar name={member.name} />
                <span>
                  <span className="block text-[12px] font-semibold text-[#172b4d]">{member.name}</span>
                  <span className="block text-[11px] text-[#626f86]">{ROLE_LABEL[member.role]}</span>
                </span>
              </span>
            ))
          )}
        </span>
      </footer>
    </div>
  );
}

function ListRow({
  active,
  name,
  count,
  onClick,
  onEdit,
}: {
  active: boolean;
  name: string;
  count: number;
  onClick: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className={`mx-2 mt-1 flex items-center rounded-md pr-1 ${active ? "bg-[#e9f2ff]" : "hover:bg-[#f1f2f4]"}`}>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left">
        <span className={`h-8 w-0.5 rounded-full ${active ? "bg-[#0c66e4]" : "bg-transparent"}`} />
        <List size={14} className={active ? "text-[#0c66e4]" : "text-[#626f86]"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#172b4d]">{name}</span>
          <span className="block text-[11px] text-[#626f86]">{count} Task</span>
        </span>
      </button>
      {onEdit ? (
        <button type="button" aria-label={`Sửa ${name}`} onClick={onEdit} className="grid size-7 place-items-center rounded text-[#626f86] hover:bg-white">
          <Pencil size={13} />
        </button>
      ) : null}
    </div>
  );
}

function ListView({
  statuses,
  tasks,
  hasLists,
  filtered,
  onCreate,
  onCreateList,
  onOpen,
}: {
  statuses: Status[];
  tasks: TaskItem[];
  hasLists: boolean;
  filtered: boolean;
  onCreate: () => void;
  onCreateList: () => void;
  onOpen: (taskId: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#eef0f3] text-[11px] font-bold tracking-wide text-[#7a869a]">
            <th className="w-[72px] px-3 py-2 font-bold">MÃ</th>
            <th className="px-3 py-2 font-bold">TÊN CÔNG VIỆC</th>
            <th className="w-[160px] px-3 py-2 font-bold">NGƯỜI THỰC HIỆN</th>
            <th className="w-[150px] px-3 py-2 font-bold">NGƯỜI GIAO</th>
            <th className="w-[120px] px-3 py-2 font-bold">TRẠNG THÁI</th>
            <th className="w-[100px] px-3 py-2 font-bold">ƯU TIÊN</th>
            <th className="w-[96px] px-3 py-2 font-bold">HẠN CHÓT</th>
            <th className="w-10 px-2 py-2">
              <span className="sr-only">Sửa</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[#626f86]">
                <p>{filtered ? "Không có công việc khớp bộ lọc." : hasLists ? `Chưa có công việc. Space đang có ${statuses.length} trạng thái.` : "Chưa có list trong space này."}</p>
                {hasLists ? (
                  <button type="button" onClick={onCreate} className="mt-3 inline-flex h-8 items-center rounded bg-[#0c66e4] px-3 text-[12px] font-semibold text-white">
                    Tạo công việc
                  </button>
                ) : null}
                {!hasLists ? (
                  <button type="button" onClick={onCreateList} className="mt-3 inline-flex h-8 items-center rounded bg-[#0c66e4] px-3 text-[12px] font-semibold text-white">
                    Tạo List
                  </button>
                ) : null}
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const status = statuses.find((item) => item.id === task.statusId);
              return (
                <tr
                  key={task.id}
                  onClick={() => onOpen(task.id)}
                  className="cursor-pointer border-b border-[#eef0f3] text-[13px] text-[#172b4d] hover:bg-[#f7f8f9]"
                >
                  <td className="px-3 py-2.5 font-semibold text-[#0c66e4]">
                    <button type="button" onClick={() => onOpen(task.id)} className="text-left">
                      {task.code}
                    </button>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5 font-medium">
                    <button type="button" onClick={() => onOpen(task.id)} className="block w-full truncate text-left">
                      {task.title}
                    </button>
                  </td>
                  <td className="truncate px-3 py-2.5 text-[#44546f]">{task.assigneeName ?? "—"}</td>
                  <td className="truncate px-3 py-2.5 text-[#44546f]">{task.reporterName}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${statusTone(status?.name ?? "")}`}>{status?.name ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold text-[#44546f]">{PRIORITY_LABEL[task.priority]}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#626f86]">{task.dueAt ? formatDue(task.dueAt) : "—"}</td>
                  <td className="px-2 py-2.5">
                    <button type="button" aria-label={`Sửa ${task.code}`} onClick={() => onOpen(task.id)} className="grid size-7 place-items-center rounded text-[#626f86] hover:bg-white">
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {hasLists && tasks.length > 0 ? (
        <button type="button" onClick={onCreate} className="flex h-10 items-center gap-1.5 px-3 text-[13px] font-semibold text-[#0c66e4] hover:bg-[#f7f8f9]">
          <Plus size={14} />
          Thêm công việc vào list
        </button>
      ) : null}
    </div>
  );
}

function BoardView({
  statuses,
  tasks,
  onCreate,
  onMove,
  onOpen,
}: {
  statuses: Status[];
  tasks: TaskItem[];
  onCreate: (statusId: string) => void;
  onMove: (taskId: string, statusId: string) => void;
  onOpen: (taskId: string) => void;
}) {
  const skipClick = useRef(false);
  const draggingId = useRef("");
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <div className="flex min-h-[440px] flex-1 items-stretch gap-3 overflow-x-auto bg-[#f7f8f9] p-3">
      {statuses.map((status) => {
        const column = tasks.filter((task) => task.statusId === status.id);
        return (
          <section
            key={status.id}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverId(status.id);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setOverId((current) => (current === status.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              setOverId(null);
              const taskId = event.dataTransfer.getData("text/plain") || draggingId.current;
              draggingId.current = "";
              if (taskId) onMove(taskId, status.id);
            }}
            className={`flex w-[250px] shrink-0 flex-col rounded-lg p-2 ${overId === status.id ? "bg-[#e9f2ff] ring-1 ring-[#0c66e4]" : "bg-[#f4f5f7]"}`}
          >
            <header className="mb-2 flex items-center justify-between px-1">
              <span className="text-[12px] font-bold tracking-wide text-[#44546f] uppercase">{status.name}</span>
              <span className="grid h-5 min-w-5 place-items-center rounded bg-white px-1.5 text-[11px] font-semibold text-[#626f86]">{column.length}</span>
            </header>
            <div className="flex flex-col gap-2">
              {column.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    draggingId.current = task.id;
                    event.dataTransfer.setData("text/plain", task.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    skipClick.current = true;
                    window.setTimeout(() => {
                      draggingId.current = "";
                    }, 0);
                  }}
                  onClick={() => {
                    if (skipClick.current) {
                      skipClick.current = false;
                      return;
                    }
                    onOpen(task.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${task.code} ${task.title}`}
                  className="cursor-grab rounded-md border border-[#dfe1e6] bg-white px-2.5 py-2 active:cursor-grabbing"
                >
                  <span className="block text-[11px] font-bold text-[#0c66e4]">{task.code}</span>
                  <span className="mt-0.5 block text-[13px] font-medium text-[#172b4d]">{task.title}</span>
                  <span className="mt-1 block text-[11px] text-[#626f86]">{task.assigneeName ?? "Chưa giao"}</span>
                </article>
              ))}
              <button type="button" onClick={() => onCreate(status.id)} className="inline-flex items-center gap-1 rounded px-1 py-1.5 text-left text-[12px] font-semibold text-[#626f86] hover:bg-white hover:text-[#0c66e4]">
                <Plus size={13} />
                Thêm công việc
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CalendarView({ tasks, onOpen }: { tasks: TaskItem[]; onOpen: (taskId: string) => void }) {
  const cells = monthCells(new Date());
  return (
    <div className="grid flex-1 grid-cols-7 border-t border-[#eef0f3]">
      {WEEKDAYS.map((day) => (
        <div key={day} className="border-r border-b border-[#eef0f3] bg-[#fafbfc] px-2 py-2 text-[12px] font-semibold text-[#626f86] last:border-r-0">
          {day}
        </div>
      ))}
      {cells.map((cell) => {
        const dayTasks = tasks.filter((task) => task.dueAt && sameDay(task.dueAt, cell.date));
        return (
          <div key={cell.date.toISOString()} className="min-h-[92px] border-r border-b border-[#eef0f3] p-1.5 last:border-r-0">
            <span className={`text-[12px] ${cell.inMonth ? "text-[#172b4d]" : "text-[#a5adba]"}`}>{cell.date.getDate()}</span>
            {dayTasks.map((task) => (
              <button key={task.id} type="button" onClick={() => onOpen(task.id)} className="mt-1 block w-full truncate rounded bg-[#e9f2ff] px-1 py-0.5 text-left text-[11px] font-semibold text-[#0c66e4]">
                {task.title}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function GanttView({ tasks }: { tasks: TaskItem[] }) {
  const columns = ganttColumns(new Date());
  const scheduled = tasks.filter((task) => task.dueAt);
  return (
    <div className="min-w-0 flex-1 overflow-x-auto">
      <div className="grid min-w-[760px] border-b border-[#eef0f3]" style={{ gridTemplateColumns: "220px repeat(6, minmax(80px, 1fr))" }}>
        <div className="bg-[#fafbfc] px-3 py-2 text-[12px] font-semibold text-[#626f86]">Công việc</div>
        {columns.map((date) => (
          <div key={date.toISOString()} className="border-l border-[#eef0f3] bg-[#fafbfc] px-2 py-2 text-center text-[12px] font-semibold text-[#626f86]">
            {date.getDate()}/{date.getMonth() + 1}
          </div>
        ))}
        {scheduled.length === 0 ? (
          <div className="col-span-7 px-3 py-12 text-center text-[13px] text-[#626f86]">Chưa có công việc để lập lịch.</div>
        ) : (
          scheduled.map((task) => (
            <div key={task.id} className="col-span-7 grid border-t border-[#eef0f3]" style={{ gridTemplateColumns: "220px repeat(6, minmax(80px, 1fr))" }}>
              <div className="truncate px-3 py-2 text-[13px] text-[#172b4d]">{task.title}</div>
              {columns.map((date, index) => {
                const next = columns[index + 1];
                const due = task.dueAt ? new Date(task.dueAt) : null;
                const hit = due ? due >= date && (!next || due < next) : false;
                return (
                  <div key={date.toISOString()} className="border-l border-[#eef0f3] px-1 py-2">
                    {hit ? <span className="block h-5 rounded bg-[#0c66e4]" /> : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ icon, tint, label, detail, value }: { icon: ReactNode; tint: string; label: string; detail: string; value: string }) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-[#dfe1e6] bg-white px-3.5 py-3">
      <span className="grid size-9 place-items-center rounded-lg" style={{ backgroundColor: tint }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-wide text-[#7a869a]">{label}</span>
        <span className="block truncate text-[12px] text-[#626f86]">{detail}</span>
      </span>
      <span className="text-[28px] leading-none font-semibold text-[#172b4d]">{value}</span>
    </article>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative shrink-0">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={SELECT}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#626f86]" />
    </label>
  );
}

function Avatar({ name, className = "" }: { name: string; className?: string }) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return (
    <span
      className={`grid size-7 place-items-center rounded-full text-[10px] font-bold text-white ${className}`}
      style={{ backgroundColor: AVATAR[hash % AVATAR.length] }}
    >
      {initials(name)}
    </span>
  );
}

function filterTasks(
  space: SpaceDetailData,
  filters: { query: string; statusId: string; memberId: string; priority: string; due: string; listId: string },
) {
  const needle = filters.query.trim().toLocaleLowerCase("vi");
  return space.tasks.filter((task) => {
    if (filters.listId !== "all" && task.listId !== filters.listId) return false;
    if (filters.statusId !== "all" && task.statusId !== filters.statusId) return false;
    if (filters.memberId !== "all" && task.assigneeId !== filters.memberId) return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.due === "overdue" && !isOverdue(space, task)) return false;
    if (filters.due === "dated" && !task.dueAt) return false;
    if (filters.due === "none" && task.dueAt) return false;
    if (!needle) return true;
    return task.title.toLocaleLowerCase("vi").includes(needle) || task.code.toLocaleLowerCase("vi").includes(needle);
  });
}

function statusName(space: SpaceDetailData, task: TaskItem) {
  return space.statuses.find((status) => status.id === task.statusId)?.name ?? "";
}

function isDone(space: SpaceDetailData, task: TaskItem) {
  return /hoàn/i.test(statusName(space, task));
}

function isDoing(space: SpaceDetailData, task: TaskItem) {
  return /đang|review/i.test(statusName(space, task));
}

function isOverdue(space: SpaceDetailData, task: TaskItem) {
  if (!task.dueAt || isDone(space, task)) return false;
  const due = new Date(task.dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function statusTone(name: string) {
  if (/hoàn/i.test(name)) return "bg-[#dcfff1] text-[#216e4e]";
  if (/đang|review/i.test(name)) return "bg-[#e9f2ff] text-[#0c66e4]";
  return "bg-[#f1f2f4] text-[#44546f]";
}

function formatDue(iso: string) {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sameDay(iso: string, date: Date) {
  const value = new Date(iso);
  return value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth() && value.getDate() === date.getDate();
}

function monthCells(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let index = 0; index < offset; index += 1) {
    cells.push({ date: new Date(year, month, 1 - (offset - index)), inMonth: false });
  }
  for (let day = 1; day <= count; day += 1) cells.push({ date: new Date(year, month, day), inMonth: true });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }
  return cells;
}

function ganttColumns(anchor: Date) {
  const start = new Date(anchor);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index * 2);
    return date;
  });
}
