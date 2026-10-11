"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import { ListDialog } from "@/components/spaces/list-dialog";
import TaskDialog from "@/components/spaces/task-detail";
import { MemberCreateTaskDialog, MemberTaskDialog } from "@/components/member/member-task-dialog";
import { useShellUser } from "@/components/shell/shell-user";
import { CreateSpaceDialog, spaceIcon, spaceSwatch, type SpaceColor, type SpaceIcon } from "@/components/workspaces/space-dialog";

type SpaceItem = {
  id: string;
  name: string;
  description?: string | null;
  icon: SpaceIcon;
  color: SpaceColor;
  accessType: string;
  listCount: number;
  memberCount: number;
};

type TaskItem = {
  id: string;
  listId: string;
  code: string;
  title: string;
  statusId: string | null;
  priority: string;
  assigneeName: string | null;
  dueAt: string | null;
};

type ListItem = {
  id: string;
  name: string;
  description?: string | null;
  taskCount: number;
};

type StatusItem = {
  id: string;
  name: string;
  category?: string;
};

type MemberItem = {
  userId: string;
  name: string;
};

type SpaceDetail = {
  id: string;
  name: string;
  description?: string | null;
  accessType?: string;
  memberCanCreateTask?: boolean;
  icon: string;
  color: string;
  workspaceName: string;
  statuses: StatusItem[];
  members: MemberItem[];
  lists: ListItem[];
  tasks: TaskItem[];
};

const PRIORITY: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Khẩn cấp", color: "#ca3521" },
  HIGH: { label: "Cao", color: "#e56910" },
  MEDIUM: { label: "Trung bình", color: "#e2b203" },
  LOW: { label: "Thấp", color: "#22a06b" },
};

const CATEGORY: Record<string, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang thực hiện",
  REVIEW: "Đánh giá",
  DONE: "Hoàn thành",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDue(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function LeaderProjects({
  workspaceId,
  workspaceName,
  readOnly = false,
}: {
  workspaceId: string;
  workspaceName: string;
  // Member: chỉ xem cấu trúc Space/List và mở chi tiết task, không tạo/sửa/xóa.
  readOnly?: boolean;
}) {
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [detail, setDetail] = useState<SpaceDetail | null>(null);
  const [spaceId, setSpaceId] = useState("");
  const [listId, setListId] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [memberCreating, setMemberCreating] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [pickingList, setPickingList] = useState(false);
  const [editor, setEditor] = useState<{ listId: string } | null>(null);
  const [viewingId, setViewingId] = useState("");
  const loadedFor = useRef("");
  const seenSpace = useRef("");
  const focusList = useRef<string | null>(null);
  const user = useShellUser();

  useEffect(() => {
    let cancelled = false;
    const first = loadedFor.current !== workspaceId;
    if (first) {
      loadedFor.current = workspaceId;
      setLoading(true);
      setSpaces([]);
      setSpaceId("");
      setDetail(null);
      setListId("");
    }
    setError("");
    api
      .get<{ items: SpaceItem[] }>(`/workspaces/${workspaceId}/spaces`)
      .then((response) => {
        if (cancelled) return;
        const items = response.data.items ?? [];
        setSpaces(items);
        setSpaceId((current) => (current && items.some((item) => item.id === current) ? current : items[0]?.id || ""));
        setOpen((current) => {
          const next = { ...current };
          for (const item of items) next[item.id] = next[item.id] ?? true;
          return next;
        });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được dự án");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, revision]);

  useEffect(() => {
    if (!spaceId) {
      setDetail(null);
      return;
    }
    const switched = seenSpace.current !== spaceId;
    seenSpace.current = spaceId;
    let cancelled = false;
    if (switched) {
      setDetail(null);
      setListId("");
    }
    setDetailLoading(true);
    api
      .get<SpaceDetail>(`/workspaces/${workspaceId}/spaces/${spaceId}`)
      .then((response) => {
        if (cancelled) return;
        const data = response.data;
        const focus = focusList.current;
        focusList.current = null;
        setDetail(data);
        setListId((current) => {
          if (focus && data.lists.some((list) => list.id === focus)) return focus;
          if (switched) return "";
          if (current && data.lists.some((list) => list.id === current)) return current;
          return "";
        });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được space");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, spaceId, revision]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  async function toggleMemberCreate(next: boolean) {
    if (!detail) return;
    setDetail({ ...detail, memberCanCreateTask: next });
    try {
      await api.patch(`/workspaces/${workspaceId}/spaces/${detail.id}/settings`, { memberCanCreateTask: next });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được quyền");
    }
    refresh();
  }

  function createTask() {
    if (!spaceId || !detail) {
      setCreatingSpace(true);
      return;
    }
    if (detail.lists.length === 0) {
      setCreatingList(true);
      return;
    }
    const target = listId || (detail.lists.length === 1 ? detail.lists[0].id : "");
    if (!target) {
      setPickingList(true);
      return;
    }
    setPickingList(false);
    setEditor({ listId: target });
  }

  const selectedSpace = spaces.find((space) => space.id === spaceId) ?? null;
  const needle = query.trim().toLowerCase();
  const visibleSpaces = spaces;

  const statusName = useMemo(() => {
    const map = new Map<string, StatusItem>();
    for (const status of detail?.statuses ?? []) map.set(status.id, status);
    return map;
  }, [detail]);

  const tasks = useMemo(() => {
    const rows = (detail?.tasks ?? []).filter((task) => (listId ? task.listId === listId : true));
    if (!needle) return rows;
    return rows.filter(
      (task) => task.title.toLowerCase().includes(needle) || task.code.toLowerCase().includes(needle),
    );
  }, [detail, listId, needle]);

  const groups = useMemo(() => {
    const lists = detail?.lists ?? [];
    const scoped = listId ? lists.filter((list) => list.id === listId) : lists;
    return scoped.map((list) => ({
      list,
      tasks: tasks.filter((task) => task.listId === list.id),
    }));
  }, [detail, listId, tasks]);

  const activeList = detail?.lists.find((list) => list.id === listId) ?? null;

  return (
    <div className="flex h-full min-h-[720px] flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#dfe1e6] px-4">
        <label className="relative flex h-9 w-[260px] items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-[#626f86]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm trong dự án..."
            className="h-9 w-full rounded-[4px] border border-[#dfe1e6] bg-[#f7f8f9] pr-3 pl-8 text-[13px] text-[#172b4d] outline-none placeholder:text-[#7a869a] focus:border-[#0c66e4] focus:bg-white"
          />
        </label>
        {readOnly ? null : (
          <>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] text-[#44546f] hover:bg-[#f1f2f4]"
            >
              <SlidersHorizontal className="size-3.5" />
              Bộ lọc
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] text-[#44546f] hover:bg-[#f1f2f4]"
            >
              <Calendar className="size-3.5" />
              Tuần này
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="relative" hidden={readOnly}>
            <button
              type="button"
              onClick={createTask}
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-[#0c66e4] px-3 text-[13px] font-medium text-white hover:bg-[#0055cc]"
            >
              <Plus className="size-3.5" />
              Tạo công việc
            </button>
            {pickingList && detail ? (
              <span className="absolute top-9 right-0 z-20 w-56 rounded-md border border-[#dfe1e6] bg-white p-1 shadow-[0_8px_24px_rgba(9,30,66,0.16)]">
                <span className="block px-2 py-1.5 text-[11px] font-bold text-[#7a869a]">Công việc thuộc list</span>
                {detail.lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => {
                      setPickingList(false);
                      setEditor({ listId: list.id });
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-[13px] text-[#172b4d] hover:bg-[#f7f8f9]"
                  >
                    {list.name}
                  </button>
                ))}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[244px] shrink-0 flex-col border-r border-[#dfe1e6] bg-[#f7f8f9]">
          <div className="flex items-center justify-between gap-2 border-b border-[#dfe1e6] px-3 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-[#626f86] uppercase">Space</p>
              <p className="mt-1 truncate text-[13px] font-medium text-[#172b4d]">{workspaceName}</p>
            </div>
            <button
              type="button"
              hidden={readOnly}
              aria-label="Tạo space"
              onClick={() => setCreatingSpace(true)}
              className="grid size-7 shrink-0 place-items-center rounded-[4px] text-[#44546f] hover:bg-[#ebecf0]"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {loading ? (
              <p className="px-3 py-4 text-[13px] text-[#626f86]">Đang tải space...</p>
            ) : visibleSpaces.length === 0 ? (
              <div className="px-3 py-4">
                <p className="text-[13px] text-[#626f86]">{readOnly ? "Bạn chưa được cấp quyền vào Space nào." : "Chưa có space trong workspace này."}</p>
                <button
                  type="button"
                  hidden={readOnly}
                  onClick={() => setCreatingSpace(true)}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-[#0c66e4] px-3 text-[12px] font-medium text-white"
                >
                  <Plus className="size-3.5" />
                  Tạo space
                </button>
              </div>
            ) : (
              visibleSpaces.map((space) => {
                const expanded = open[space.id] !== false;
                const active = space.id === spaceId;
                const lists = active ? (detail?.lists ?? []) : [];
                return (
                  <div key={space.id} className="px-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSpaceId(space.id);
                        setOpen((current) => ({ ...current, [space.id]: !expanded || space.id !== spaceId }));
                      }}
                      className={`flex h-9 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] ${
                        active ? "bg-[#e9f2ff] font-medium text-[#0052cc]" : "text-[#172b4d] hover:bg-[#ebecf0]"
                      }`}
                    >
                      {expanded ? (
                        <ChevronDown className="size-3.5 shrink-0 text-[#626f86]" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-[#626f86]" />
                      )}
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-[4px]"
                        style={{ background: spaceSwatch(space.color) }}
                      >
                        <img src={spaceIcon(space.icon)} alt="" className="size-3 brightness-0 invert" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{space.name}</span>
                      <span className="text-[11px] text-[#7a869a]">{space.listCount}</span>
                    </button>
                    {expanded && active ? (
                      <div className="mt-0.5 mb-1 ml-5 border-l border-[#dfe1e6] pl-1">
                        <button
                          type="button"
                          onClick={() => setListId("")}
                          className={`flex h-8 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] ${
                            !listId ? "bg-white font-medium text-[#172b4d] shadow-[inset_2px_0_0_#0c66e4]" : "text-[#44546f] hover:bg-white"
                          }`}
                        >
                          <FolderKanban className="size-3.5 shrink-0 text-[#626f86]" />
                          Tất cả công việc
                        </button>
                        {detailLoading ? (
                          <p className="px-2 py-1 text-[12px] text-[#7a869a]">Đang tải list...</p>
                        ) : (
                          lists.map((list) => (
                            <button
                              key={list.id}
                              type="button"
                              onClick={() => setListId(list.id)}
                              className={`flex h-8 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] ${
                                listId === list.id
                                  ? "bg-white font-medium text-[#172b4d] shadow-[inset_2px_0_0_#0c66e4]"
                                  : "text-[#44546f] hover:bg-white"
                              }`}
                            >
                              <ListTodo className="size-3.5 shrink-0 text-[#626f86]" />
                              <span className="min-w-0 flex-1 truncate">{list.name}</span>
                              <span className="text-[11px] text-[#7a869a]">{list.taskCount}</span>
                            </button>
                          ))
                        )}
                        <button
                          type="button"
                          hidden={readOnly}
                          onClick={() => setCreatingList(true)}
                          className="mt-1 flex h-8 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] text-[#0c66e4] hover:bg-white"
                        >
                          <Plus className="size-3.5 shrink-0" />
                          Tạo list
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="border-b border-[#dfe1e6] px-5 py-4">
            <p className="text-[12px] text-[#626f86]">
              {workspaceName}
              {selectedSpace ? ` / ${selectedSpace.name}` : ""}
              {activeList ? ` / ${activeList.name}` : ""}
            </p>
            <div className="mt-1 flex items-center gap-3">
              {selectedSpace ? (
                <span
                  className="flex size-8 items-center justify-center rounded-[6px]"
                  style={{ background: spaceSwatch(selectedSpace.color) }}
                >
                  <img src={spaceIcon(selectedSpace.icon)} alt="" className="size-4 brightness-0 invert" />
                </span>
              ) : null}
              <div className="min-w-0">
                <h1 className="truncate text-[22px] leading-7 font-semibold text-[#172b4d]">
                  {activeList?.name ?? selectedSpace?.name ?? "Dự án"}
                </h1>
                <p className="text-[13px] text-[#626f86]">
                  {activeList
                    ? `${tasks.length} công việc trong list`
                    : selectedSpace
                      ? `${selectedSpace.listCount} list · ${selectedSpace.memberCount} thành viên`
                      : "Chọn một space ở cột trái"}
                </p>
              </div>
            </div>
          </div>

          {readOnly && detail ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#eef0f3] bg-[#fafbfc] px-5 py-2 text-[12px] text-[#626f86]">
              {detail.description ? <span className="min-w-0 truncate">{detail.description}</span> : null}
              <span>{detail.accessType === "PUBLIC" ? "Công khai trong workspace" : "Riêng tư"}</span>
              <span>
                {detail.members.length} thành viên
                {detail.members.length > 0 ? ": " + detail.members.slice(0, 4).map((member) => member.name).join(", ") + (detail.members.length > 4 ? "…" : "") : ""}
              </span>
              {detail.memberCanCreateTask && detail.lists.length > 0 ? (
                <button type="button" onClick={() => setMemberCreating(true)} className="ml-auto inline-flex h-7 items-center gap-1 rounded bg-[#0c66e4] px-2.5 text-[12px] font-semibold text-white">
                  <Plus className="size-3.5" />
                  Tạo công việc
                </button>
              ) : null}
            </div>
          ) : null}

          {!readOnly && detail ? (
            <label className="flex w-full cursor-pointer items-center gap-2 border-b border-[#eef0f3] bg-[#fafbfc] px-5 py-2 text-[12px] text-[#44546f]">
              <input
                type="checkbox"
                checked={Boolean(detail.memberCanCreateTask)}
                onChange={(event) => void toggleMemberCreate(event.target.checked)}
                className="size-3.5 accent-[#0c66e4]"
              />
              Cho phép thành viên tạo công việc trong Space này
            </label>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto">
            {error ? <p className="px-5 py-4 text-[13px] text-[#ca3521]">{error}</p> : null}
            {!selectedSpace && !loading ? (
              <div className="px-5 py-8">
                <p className="text-[13px] text-[#626f86]">{readOnly ? "Bạn chưa được cấp quyền vào Space nào." : "Workspace này chưa có space nào."}</p>
                <button
                  type="button"
                  hidden={readOnly}
                  onClick={() => setCreatingSpace(true)}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-[#0c66e4] px-3 text-[12px] font-medium text-white"
                >
                  <Plus className="size-3.5" />
                  Tạo space
                </button>
              </div>
            ) : null}
            {selectedSpace && detailLoading && !detail ? (
              <p className="px-5 py-8 text-[13px] text-[#626f86]">Đang tải công việc...</p>
            ) : null}
            {detail && !detailLoading && groups.length === 0 ? (
              <div className="px-5 py-8">
                <p className="text-[13px] text-[#626f86]">Space này chưa có list.</p>
                <button
                  type="button"
                  hidden={readOnly}
                  onClick={() => setCreatingList(true)}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-[#0c66e4] px-3 text-[12px] font-medium text-white"
                >
                  <Plus className="size-3.5" />
                  Tạo list
                </button>
              </div>
            ) : null}
            {groups.map(({ list, tasks: rows }) => (
              <div key={list.id} className="border-b border-[#dfe1e6]">
                <div className="flex h-10 items-center gap-2 bg-[#f7f8f9] px-5">
                  <ListTodo className="size-3.5 text-[#44546f]" />
                  <span className="text-[13px] font-semibold text-[#172b4d]">{list.name}</span>
                  <span className="text-[12px] text-[#626f86]">{rows.length}</span>
                </div>
                {rows.length === 0 ? (
                  <p className="px-5 py-3 text-[13px] text-[#7a869a]">Chưa có công việc.</p>
                ) : (
                  <table className="w-full min-w-[720px] table-fixed text-left">
                    <colgroup>
                      <col className="w-[88px]" />
                      <col />
                      <col className="w-[160px]" />
                      <col className="w-[140px]" />
                      <col className="w-[120px]" />
                      <col className="w-[96px]" />
                    </colgroup>
                    <thead>
                      <tr className="h-9 border-b border-[#dfe1e6] text-[11px] font-semibold tracking-wide text-[#626f86] uppercase">
                        <th className="w-[88px] px-5 font-semibold">Mã</th>
                        <th className="px-2 font-semibold">Tên công việc</th>
                        <th className="w-[160px] px-2 font-semibold">Người thực hiện</th>
                        <th className="w-[140px] px-2 font-semibold">Trạng thái</th>
                        <th className="w-[120px] px-2 font-semibold">Ưu tiên</th>
                        <th className="w-[96px] px-5 font-semibold">Hạn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((task) => {
                        const status = task.statusId ? statusName.get(task.statusId) : undefined;
                        const priority = PRIORITY[task.priority] ?? PRIORITY.MEDIUM;
                        return (
                          <tr
                            key={task.id}
                            onClick={readOnly ? () => setViewingId(task.id) : undefined}
                            className={`h-11 border-b border-[#f1f2f4] text-[13px] text-[#172b4d] hover:bg-[#f7f8f9] ${readOnly ? "cursor-pointer" : ""}`}
                          >
                            <td className="px-5 font-medium text-[#626f86]">{task.code}</td>
                            <td className="px-2">
                              {readOnly ? (
                                <button type="button" onClick={() => setViewingId(task.id)} className="line-clamp-1 text-left hover:text-[#0c66e4]">
                                  {task.title}
                                </button>
                              ) : (
                                <span className="line-clamp-1">{task.title}</span>
                              )}
                            </td>
                            <td className="px-2">
                              {task.assigneeName ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="flex size-6 items-center justify-center rounded-full bg-[#334563] text-[10px] font-semibold text-white">
                                    {initials(task.assigneeName)}
                                  </span>
                                  <span className="truncate">{task.assigneeName}</span>
                                </span>
                              ) : (
                                <span className="text-[#7a869a]">Chưa giao</span>
                              )}
                            </td>
                            <td className="px-2 text-[#44546f]">
                              {status ? (CATEGORY[status.category ?? ""] ?? status.name) : "—"}
                            </td>
                            <td className="px-2">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ background: priority.color }} />
                                {priority.label}
                              </span>
                            </td>
                            <td className="px-5 text-[#44546f]">{formatDue(task.dueAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {memberCreating && detail ? <MemberCreateTaskDialog spaceId={detail.id} presetListId={listId || undefined} onClose={() => { setMemberCreating(false); refresh(); }} /> : null}
      {viewingId ? <MemberTaskDialog taskId={viewingId} onClose={() => { setViewingId(""); refresh(); }} /> : null}
      {creatingSpace && !readOnly ? (
        <CreateSpaceDialog
          workspaceId={workspaceId}
          onClose={() => setCreatingSpace(false)}
          onCreated={() => {
            setCreatingSpace(false);
            refresh();
          }}
        />
      ) : null}
      {creatingList && spaceId ? (
        <ListDialog
          open
          mode="create"
          workspaceId={workspaceId}
          spaceId={spaceId}
          list={null}
          onClose={() => setCreatingList(false)}
          onSaved={(nextSpaceId, nextListId) => {
            focusList.current = nextListId;
            setCreatingList(false);
            setSpaceId(nextSpaceId);
            setOpen((current) => ({ ...current, [nextSpaceId]: true }));
            refresh();
          }}
        />
      ) : null}
      {editor && detail ? (
        <TaskDialog
          key={`new-${editor.listId}`}
          workspaceId={workspaceId}
          spaceId={detail.id}
          workspaceName={detail.workspaceName || workspaceName}
          spaceName={detail.name}
          lists={detail.lists}
          statuses={detail.statuses}
          members={detail.members ?? []}
          task={null}
          presetListId={editor.listId}
          currentUserId={user?.id ?? ""}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
