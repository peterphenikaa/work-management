"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MemberCreateTaskDialog, MemberTaskDialog } from "@/components/member/member-task-dialog";
import { PRIORITY_LABEL } from "@/components/member/member-dashboard";
import { isDueSoon, isDueToday, isOverdueTask, useMemberData, BUCKET_LABEL, type Bucket, type MemberTask } from "@/components/member/member-data";
import { BoardView, Filter, ListView } from "@/components/spaces/space-detail";
import { spaceIcon, spaceSwatch } from "@/components/workspaces/space-dialog";
import { api } from "@/lib/api";

const PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

// M03 Kanban + M04 List View của Member: dùng lại BoardView/ListView của Space ở chế độ chỉ-đọc.
export function MemberTasks({ view }: { view: "board" | "list" }) {
  const data = useMemberData();
  const [spaceId, setSpaceId] = useState("");
  const [listId, setListId] = useState("all");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [bucket, setBucket] = useState("all");
  const [priority, setPriority] = useState("all");
  const [due, setDue] = useState("all");
  const [sort, setSort] = useState("due");
  const [openId, setOpenId] = useState("");
  const [creating, setCreating] = useState<{ statusId?: string } | null>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const space = data?.spaces.find((item) => item.id === spaceId) ?? data?.spaces[0];

  const tasks = useMemo(() => {
    if (!data || !space) return [];
    const needle = query.trim().toLocaleLowerCase("vi");
    const base = space.tasks
      .map((task): MemberTask => (moved[task.id] ? { ...task, statusId: moved[task.id] } : task))
      .filter((task) => {
        if (listId !== "all" && task.listId !== listId) return false;
        if (mineOnly && task.assigneeId !== data.userId) return false;
        if (needle && !task.title.toLocaleLowerCase("vi").includes(needle) && !task.code.toLocaleLowerCase("vi").includes(needle)) return false;
        if (view === "board") return true;
        if (bucket !== "all" && task.bucket !== bucket) return false;
        if (priority !== "all" && task.priority !== priority) return false;
        if (due === "today" && !isDueToday(task)) return false;
        if (due === "soon" && !isDueSoon(task)) return false;
        if (due === "overdue" && !isOverdueTask(task)) return false;
        if (due === "none" && task.dueAt) return false;
        return true;
      });
    if (view === "board") return base;
    return [...base].sort((left, right) => {
      if (sort === "priority") return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
      if (sort === "updated") return new Date(right.updatedAt ?? right.createdAt ?? 0).getTime() - new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
      const a = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const b = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return a - b;
    });
  }, [data, space, moved, listId, mineOnly, query, view, bucket, priority, due, sort]);

  if (!data) return null;
  if (data.loading) return <p className="px-6 py-10 text-[13px] text-[#626f86]">Đang tải công việc...</p>;
  if (data.error) return <p className="px-6 py-10 text-[13px] text-[#ae2e24]">{data.error}</p>;
  if (!space) {
    return (
      <div className="mx-auto max-w-[520px] px-6 py-16 text-center">
        <h1 className="text-[18px] font-semibold text-[#172b4d]">Bạn chưa có Space nào</h1>
        <p className="mt-2 text-[13px] text-[#626f86]">Trưởng nhóm cần thêm bạn vào một Space hoặc mở Space công khai để bạn xem công việc.</p>
      </div>
    );
  }

  const icon = spaceIcon(space.icon);
  const filtered = Boolean(query.trim()) || mineOnly || listId !== "all" || bucket !== "all" || priority !== "all" || due !== "all";

  async function moveTask(taskId: string, statusId: string) {
    if (!data || !space) return;
    const task = space.tasks.find((item) => item.id === taskId);
    if (!task || (moved[taskId] ?? task.statusId) === statusId) return;
    if (task.assigneeId !== data.userId) {
      setNotice("Bạn chỉ được chuyển trạng thái công việc được giao cho mình");
      return;
    }
    setNotice("");
    setMoved((current) => ({ ...current, [taskId]: statusId }));
    try {
      await api.patch(`/workspaces/${data.workspaceId}/spaces/${space.id}/tasks/${taskId}`, { statusId });
      await data.refresh();
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : "Không cập nhật được trạng thái");
    } finally {
      setMoved((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#dfe1e6] px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md text-white" style={{ backgroundColor: spaceSwatch(space.color) }}>
          <img src={icon} alt="" className="size-4 brightness-0 invert" />
        </span>
        <Filter
          label="Space"
          value={space.id}
          onChange={(value) => {
            setSpaceId(value);
            setListId("all");
          }}
          options={data.spaces.map((item) => ({ id: item.id, label: item.name }))}
        />
        <Filter label="List" value={listId} onChange={setListId} options={[{ id: "all", label: "Tất cả List" }, ...space.lists.map((item) => ({ id: item.id, label: item.name }))]} />
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#626f86]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo mã hoặc tên"
            aria-label="Tìm công việc"
            className="h-8 w-[220px] rounded border border-[#dfe1e6] bg-white pr-2 pl-8 text-[13px] text-[#172b4d] outline-none placeholder:text-[#a5adba] focus:border-[#0c66e4]"
          />
        </label>
        <button
          type="button"
          aria-pressed={mineOnly}
          onClick={() => setMineOnly((value) => !value)}
          className={`h-8 rounded border px-3 text-[12px] font-semibold ${mineOnly ? "border-[#0c66e4] bg-[#e9f2ff] text-[#0c66e4]" : "border-[#dfe1e6] bg-white text-[#44546f] hover:bg-[#f7f8f9]"}`}
        >
          Task của tôi
        </button>
        {view === "list" ? (
          <>
            <Filter label="Trạng thái" value={bucket} onChange={setBucket} options={[{ id: "all", label: "Mọi trạng thái" }, ...(Object.keys(BUCKET_LABEL) as Bucket[]).map((id) => ({ id, label: BUCKET_LABEL[id] }))]} />
            <Filter label="Mức độ ưu tiên" value={priority} onChange={setPriority} options={[{ id: "all", label: "Mọi mức ưu tiên" }, ...Object.entries(PRIORITY_LABEL).map(([id, label]) => ({ id, label }))]} />
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
            <Filter
              label="Sắp xếp"
              value={sort}
              onChange={setSort}
              options={[
                { id: "due", label: "Hạn chót gần nhất" },
                { id: "priority", label: "Mức độ ưu tiên" },
                { id: "updated", label: "Cập nhật gần đây" },
              ]}
            />
          </>
        ) : null}
        <span className="ml-auto text-[12px] text-[#626f86]">{tasks.length} công việc</span>
        {space.memberCanCreateTask && space.lists.length > 0 ? (
          <button type="button" onClick={() => setCreating({})} className="inline-flex h-8 items-center gap-1.5 rounded bg-[#0c66e4] px-3 text-[12px] font-semibold text-white hover:bg-[#0055cc]">
            <Plus size={14} />
            Tạo công việc
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#eef0f3] bg-[#fafbfc] px-4 py-2 text-[12px] text-[#626f86]">
        <span>
          <strong className="text-[#172b4d]">{space.name}</strong>
          {space.description ? ` — ${space.description}` : ""}
        </span>
        <span>{space.accessType === "PUBLIC" ? "Công khai trong workspace" : "Riêng tư"}</span>
        <span>{space.members.length} thành viên</span>
        {notice ? <span className="font-semibold text-[#ae2e24]">{notice}</span> : null}
      </div>

      {view === "board" ? (
        <BoardView
          statuses={space.statuses}
          tasks={tasks}
          canMove={(taskId) => space.tasks.find((task) => task.id === taskId)?.assigneeId === data.userId}
          onMove={(taskId, statusId) => void moveTask(taskId, statusId)}
          onOpen={setOpenId}
          onCreate={space.memberCanCreateTask && space.lists.length > 0 ? (statusId) => setCreating({ statusId }) : undefined}
        />
      ) : (
        <ListView statuses={space.statuses} tasks={tasks} hasLists={space.lists.length > 0} filtered={filtered} onOpen={setOpenId} readOnly onCreate={space.memberCanCreateTask ? () => setCreating({}) : undefined} />
      )}

      {openId ? <MemberTaskDialog taskId={openId} onClose={() => setOpenId("")} /> : null}
      {creating ? <MemberCreateTaskDialog spaceId={space.id} presetStatusId={creating.statusId} presetListId={listId !== "all" ? listId : undefined} onClose={() => setCreating(null)} /> : null}
    </div>
  );
}
