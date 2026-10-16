"use client";

import { Check, Link2, Paperclip, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useShellUser } from "@/components/shell/shell-user";
import { TaskActivity } from "@/components/spaces/task-activity";

type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
const PRIORITIES: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Khẩn cấp",
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};
const MAX_PENDING_BYTES = 5 * 1024 * 1024;
export type TaskDraft = {
  id: string;
  listId: string;
  code: string;
  title: string;
  description: string | null;
  statusId: string;
  priority: Priority;
  assigneeId: string | null;
  reporterId: string;
  reporterName: string;
  dueAt: string | null;
  startAt?: string | null;
  storyPoints?: number | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CheckItem = { id: string; title: string; done: boolean };

export function TaskDialog({
  workspaceId,
  spaceId,
  workspaceName,
  spaceName,
  lists,
  statuses,
  members,
  task,
  presetListId,
  presetStatusId,
  currentUserId,
  memberMode = false,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  spaceId: string;
  workspaceName: string;
  spaceName: string;
  lists: { id: string; name: string }[];
  statuses: { id: string; name: string }[];
  members: { userId: string; name: string }[];
  task: TaskDraft | null;
  presetListId: string;
  presetStatusId?: string;
  currentUserId: string;
  // Member: chỉ xem, đổi trạng thái (khi là người thực hiện), checklist và bình luận.
  memberMode?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const creating = task === null;
  const reviewStatus = statuses.find((status) => /review|đánh giá/i.test(status.name));
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const shellUser = useShellUser();
  const actorId = currentUserId || shellUser?.id || "";
  const actorName = shellUser?.name ?? "";
  // Mở task có sẵn: xem trước; bấm bút mới vào form sửa. Tạo mới luôn ở chế độ sửa.
  const [editing, setEditing] = useState(creating);
  const [freshMembers, setFreshMembers] = useState<{ userId: string; name: string }[] | null>(null);
  const roster = useMemo(() => {
    const source = (freshMembers ?? members).map((person) => ({ userId: person.userId, name: person.name }));
    if (actorId && !source.some((person) => person.userId === actorId)) {
      source.unshift({ userId: actorId, name: actorName || "Bạn" });
    }
    const seen = new Set<string>();
    return source.filter((person) => {
      if (!person.userId || seen.has(person.userId)) return false;
      seen.add(person.userId);
      return true;
    });
  }, [actorId, actorName, freshMembers, members]);
  const memberIds = new Set(roster.map((member) => member.userId));
  const fallbackReporter = actorId || roster[0]?.userId || "";
  const currentName = roster.find((member) => member.userId === actorId)?.name || actorName || "Bạn";
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [listId, setListId] = useState(task?.listId || presetListId || lists[0]?.id || "");
  const [statusId, setStatusId] = useState(
    task?.statusId || (presetStatusId && statuses.some((status) => status.id === presetStatusId) ? presetStatusId : (statuses[0]?.id ?? "")),
  );
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [reporterId, setReporterId] = useState(task?.reporterId || fallbackReporter);
  const [dueAt, setDueAt] = useState(task?.dueAt ? toLocalDateTime(task.dueAt) : "");
  const [startAt, setStartAt] = useState(task?.startAt ? toLocalDateTime(task.startAt) : "");
  const [storyPoints, setStoryPoints] = useState(task?.storyPoints != null ? String(task.storyPoints) : "");
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [checkDraft, setCheckDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const locked = memberMode ? !creating : !creating && !editing;
  const canChangeStatus = memberMode ? !creating : creating || editing;
  const showEditChrome = creating || editing;
  const canDelete = !creating && !memberMode && Boolean(task);

  const ready = title.trim().length > 0 && Boolean(spaceId) && listId && statusId && reporterId && !saving;
  const listName = lists.find((list) => list.id === listId)?.name ?? "List";
  const reporterName = roster.find((member) => member.userId === reporterId)?.name ?? task?.reporterName ?? "—";
  const doneCount = checks.filter((item) => item.done).length;
  const progress = checks.length === 0 ? 0 : Math.round((doneCount / checks.length) * 100);

  function resetFromTask() {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setListId(task.listId || presetListId || lists[0]?.id || "");
    setStatusId(task.statusId);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId ?? "");
    setReporterId(task.reporterId || fallbackReporter);
    setDueAt(task.dueAt ? toLocalDateTime(task.dueAt) : "");
    setStartAt(task.startAt ? toLocalDateTime(task.startAt) : "");
    setStoryPoints(task.storyPoints != null ? String(task.storyPoints) : "");
    setError("");
  }

  function enterEdit() {
    if (memberMode || creating) return;
    setEditing(true);
    window.setTimeout(() => titleRef.current?.focus(), 0);
  }

  function cancelEdit() {
    if (creating) {
      requestClose();
      return;
    }
    resetFromTask();
    setEditing(false);
  }

  useEffect(() => {
    if (memberMode) return;
    let cancelled = false;
    api
      .get<{ members: { userId: string; name: string }[] }>(`/workspaces/${workspaceId}/spaces/${spaceId}`)
      .then((response) => {
        if (!cancelled) setFreshMembers(response.data.members ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [memberMode, spaceId, workspaceId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    api
      .get<{ items: CheckItem[] }>(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}/checks`)
      .then((response) => {
        if (!cancelled) setChecks(response.data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [spaceId, task, workspaceId]);

  const reporterOptions = roster.map((member) => ({ id: member.userId, label: member.name }));
  if (task && !memberIds.has(task.reporterId)) {
    reporterOptions.unshift({ id: task.reporterId, label: task.reporterName });
  }

  async function addCheck() {
    const value = checkDraft.trim();
    if (!value) return;
    setCheckDraft("");
    if (!task) {
      setChecks((current) => [...current, { id: crypto.randomUUID(), title: value, done: false }]);
      return;
    }
    try {
      const response = await api.post<CheckItem>(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}/checks`, { title: value });
      setChecks((current) => [...current, response.data]);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không thêm được mục checklist");
    }
  }

  async function toggleCheck(item: CheckItem) {
    const done = !item.done;
    setChecks((current) => current.map((row) => (row.id === item.id ? { ...row, done } : row)));
    if (!task) return;
    try {
      await api.patch(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}/checks/${item.id}`, { done });
    } catch (reason: unknown) {
      setChecks((current) => current.map((row) => (row.id === item.id ? { ...row, done: item.done } : row)));
      setError(reason instanceof Error ? reason.message : "Không cập nhật được checklist");
    }
  }

  async function renameCheck(item: CheckItem, title: string) {
    const next = title.trim();
    if (!next) return;
    setChecks((current) => current.map((row) => (row.id === item.id ? { ...row, title: next } : row)));
    if (!task) return;
    try {
      await api.patch(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}/checks/${item.id}`, { title: next });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được checklist");
    }
  }

  async function removeCheck(item: CheckItem) {
    setChecks((current) => current.filter((row) => row.id !== item.id));
    if (!task) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}/checks/${item.id}`);
    } catch (reason: unknown) {
      setChecks((current) => [...current, item]);
      setError(reason instanceof Error ? reason.message : "Không xóa được mục checklist");
    }
  }

  // M05.09: cảnh báo khi đóng form tạo / sửa đang nhập dở.
  function requestClose() {
    const dirtyCreate =
      creating &&
      (title.trim() || description.trim() || pendingFiles.length > 0 || checks.length > 0 || startAt || storyPoints.trim());
    const dirtyEdit =
      !creating &&
      editing &&
      task &&
      (title.trim() !== task.title ||
        (description.trim() || "") !== (task.description ?? "") ||
        listId !== task.listId ||
        statusId !== task.statusId ||
        priority !== task.priority ||
        (assigneeId || "") !== (task.assigneeId ?? "") ||
        reporterId !== task.reporterId ||
        dueAt !== (task.dueAt ? toLocalDateTime(task.dueAt) : "") ||
        startAt !== (task.startAt ? toLocalDateTime(task.startAt) : "") ||
        storyPoints !== (task.storyPoints != null ? String(task.storyPoints) : ""));
    if ((dirtyCreate || dirtyEdit) && !window.confirm("Dữ liệu chưa lưu sẽ bị mất. Bạn vẫn muốn đóng?")) return;
    onClose();
  }

  async function removeTask() {
    if (!task || memberMode) return;
    if (!window.confirm(`Xóa công việc ${task.code}? Thao tác không thể hoàn tác.`)) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}`);
      onSaved();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không xóa được công việc");
      setDeleting(false);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  }

  function addPendingFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PENDING_BYTES) {
      setError("Tệp tối đa 5 MB");
      return;
    }
    setError("");
    setPendingFiles((current) => [...current, file]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(nextStatusId?: string) {
    if (!ready) return;
    if (dueAt) {
      const due = new Date(dueAt);
      if (Number.isNaN(due.getTime()) || due.getTime() <= Date.now()) {
        setError("Hạn chót phải là thời điểm trong tương lai");
        return;
      }
    }
    setSaving(true);
    setError("");
    if (memberMode && task) {
      const target = nextStatusId ?? statusId;
      try {
        if (target !== task.statusId) {
          await api.patch(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}`, { statusId: target });
        }
        onSaved();
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : "Không cập nhật được công việc");
        setSaving(false);
      }
      return;
    }
    const points = storyPoints.trim() === "" ? null : Number(storyPoints);
    if (points != null && (!Number.isFinite(points) || points < 0)) {
      setError("Story points phải là số không âm");
      return;
    }
    const payload = {
      listId,
      title: title.trim(),
      description: description.trim(),
      statusId,
      priority,
      assigneeId: assigneeId || null,
      reporterId,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      startAt: startAt ? new Date(startAt).toISOString() : null,
      storyPoints: points,
    };
    try {
      if (creating) {
        const response = await api.post<{ id: string }>(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks`, payload);
        const taskId = response.data.id;
        for (const item of checks) {
          const created = await api.post<CheckItem>(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${taskId}/checks`, { title: item.title });
          if (item.done) await api.patch(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${taskId}/checks/${created.data.id}`, { done: true });
        }
        for (const file of pendingFiles) {
          const body = new FormData();
          body.append("file", file);
          await api.post(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${taskId}/attachments`, body, { timeout: 60000 });
        }
      } else {
        await api.patch(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}`, payload);
      }
      onSaved();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không lưu được công việc");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#091e42]/45 p-4" onMouseDown={requestClose}>
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="flex h-[min(860px,calc(100vh-32px))] w-full max-w-[1176px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_rgba(9,30,66,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#dfe1e6] px-4">
          <span className="inline-flex h-6 items-center rounded bg-[#e9f2ff] px-2 text-[12px] font-bold text-[#0c66e4]">
            {creating ? "MỚI" : task.code}
          </span>
          <Crumb>{workspaceName}</Crumb>
          <Crumb>{spaceName}</Crumb>
          <span className="min-w-0 truncate text-[13px] font-semibold text-[#172b4d]">{listName}</span>
          <span className="ml-auto flex items-center gap-1">
            {copied ? <span className="mr-1 text-[12px] font-semibold text-[#216e4e]">{copied}</span> : null}
            {!creating ? (
              <>
                <IconButton label="Sao chép liên kết" onClick={() => void copyText(`${task?.code ?? "Công việc"} · ${title || "Chưa đặt tên"}`, "Đã sao chép")}>
                  <Link2 size={15} />
                </IconButton>
                <IconButton
                  label="Chia sẻ"
                  onClick={() => void copyText(`${task?.code ?? "Công việc"}: ${title || "Chưa đặt tên"} — ${workspaceName} / ${spaceName} / ${listName}`, "Đã sao chép nội dung chia sẻ")}
                >
                  <Share2 size={15} />
                </IconButton>
                {!memberMode && !editing ? (
                  <IconButton label="Chỉnh sửa" onClick={enterEdit}>
                    <Pencil size={15} />
                  </IconButton>
                ) : null}
                {canDelete ? (
                  <IconButton label="Xóa công việc" onClick={() => void removeTask()} disabled={deleting || saving}>
                    <Trash2 size={15} />
                  </IconButton>
                ) : null}
              </>
            ) : null}
            <IconButton label="Đóng" onClick={requestClose}>
              <X size={16} />
            </IconButton>
          </span>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_312px]">
          <div className="min-h-0 min-w-0 overflow-y-auto px-6 py-5">
            <label className="block">
              <span className="text-[12px] font-bold text-[#44546f]">Tên công việc *</span>
              <input
                ref={titleRef}
                id={titleId}
                value={title}
                readOnly={locked}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Nhập tên công việc"
                className="mt-1.5 w-full border-0 bg-transparent text-[26px] leading-tight font-semibold text-[#172b4d] outline-none placeholder:text-[#172b4d]/35"
              />
            </label>
            <p className="mt-1.5 text-[12px] text-[#626f86]">
              Tạo bởi <span className="font-semibold text-[#44546f]">{reporterName}</span>
              {task?.createdAt ? ` lúc ${formatWhen(task.createdAt)}` : creating ? "" : ""}
            </p>

            <Section label="Mô tả">
              <textarea
                value={description}
                readOnly={locked}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Mô tả công việc, kết quả cần bàn giao..."
                className="h-36 w-full resize-none rounded-lg border border-[#dfe1e6] bg-[#fafbfc] px-3 py-2.5 text-[13px] leading-5 text-[#172b4d] outline-none placeholder:text-[#a5adba] focus:border-[#0c66e4] focus:bg-white"
              />
            </Section>

            <Section
              label="Checklist"
              extra={
                <span className="text-[12px] font-semibold text-[#44546f]">
                  {doneCount}/{checks.length} · {progress}%
                </span>
              }
            >
              <div className="h-1.5 overflow-hidden rounded-full bg-[#ebecf0]">
                <div className="h-full rounded-full bg-[#0c66e4]" style={{ width: `${progress}%` }} />
              </div>
              <ul className="mt-3 flex flex-col gap-1">
                {checks.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-[#f7f8f9]">
                    <button
                      type="button"
                      aria-label={item.done ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
                      disabled={locked && !memberMode}
                      onClick={() => void toggleCheck(item)}
                      className={`grid size-4 shrink-0 place-items-center rounded-[3px] border ${item.done ? "border-[#0c66e4] bg-[#0c66e4] text-white" : "border-[#b3b9c4] bg-white"} disabled:opacity-55`}
                    >
                      {item.done ? <Check size={11} strokeWidth={3} /> : null}
                    </button>
                    <input
                      value={item.title}
                      readOnly={locked && !memberMode}
                      onChange={(event) => setChecks((current) => current.map((row) => (row.id === item.id ? { ...row, title: event.target.value } : row)))}
                      onBlur={(event) => void renameCheck(item, event.target.value)}
                      className={`min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none ${item.done ? "text-[#626f86] line-through" : "text-[#172b4d]"}`}
                    />
                    {locked && !memberMode ? null : (
                      <button
                        type="button"
                        aria-label="Xóa mục"
                        onClick={() => void removeCheck(item)}
                        className="grid size-6 place-items-center rounded text-[#626f86] opacity-0 group-hover:opacity-100 hover:bg-white"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {checks.length === 0 ? <p className="mt-3 text-[12px] text-[#626f86]">Chưa có mục checklist.</p> : null}
              {locked && !memberMode ? null : (
                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addCheck();
                  }}
                >
                  <Plus size={14} className="text-[#626f86]" />
                  <input
                    value={checkDraft}
                    onChange={(event) => setCheckDraft(event.target.value)}
                    placeholder="Thêm mục checklist"
                    className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#172b4d] outline-none placeholder:text-[#a5adba]"
                  />
                </form>
              )}
            </Section>

            {creating ? (
              <Section
                label="Tệp đính kèm"
                extra={
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-7 items-center gap-1.5 rounded border border-[#dfe1e6] bg-white px-2.5 text-[12px] font-semibold text-[#44546f] hover:bg-[#f7f8f9]"
                  >
                    <Paperclip size={13} />
                    Thêm tệp
                  </button>
                }
              >
                <input
                  ref={fileRef}
                  type="file"
                  aria-label="Chọn tệp đính kèm"
                  className="hidden"
                  onChange={(event) => addPendingFile(event.target.files?.[0])}
                />
                {pendingFiles.length === 0 ? (
                  <p className="text-[12px] text-[#626f86]">Chưa chọn tệp (tối đa 5 MB mỗi tệp). Tệp sẽ được tải lên sau khi tạo công việc.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {pendingFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-[#eef0f3] bg-[#fafbfc] px-2.5 py-1.5">
                        <Paperclip size={14} className="shrink-0 text-[#626f86]" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#172b4d]">{file.name}</span>
                        <button
                          type="button"
                          aria-label={`Gỡ ${file.name}`}
                          onClick={() => setPendingFiles((current) => current.filter((_, row) => row !== index))}
                          className="grid size-7 place-items-center rounded text-[#626f86] hover:bg-white hover:text-[#ae2e24]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ) : null}

            {task ? (
              <TaskActivity
                workspaceId={workspaceId}
                spaceId={spaceId}
                taskId={task.id}
                people={roster}
                currentUserId={actorId}
                currentName={currentName}
                canManageFiles={!memberMode}
              />
            ) : (
              <Section label="Hoạt động">
                <p className="text-[12px] text-[#626f86]">Lưu công việc để thêm bình luận.</p>
              </Section>
            )}
          </div>

          <aside className="flex min-h-0 flex-col border-t border-[#eef0f3] bg-[#fafbfc] lg:border-t-0 lg:border-l lg:border-[#dfe1e6]">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <p className="mb-4 text-[11px] font-bold tracking-[0.08em] text-[#7a869a]">THÔNG TIN</p>
            <div className="flex flex-col gap-3">
              <Property label="Space *">
                <div className="flex h-9 items-center rounded-md border border-[#dfe1e6] bg-white px-2.5 text-[13px] font-medium text-[#172b4d]">{spaceName}</div>
              </Property>
              <Property label="List">
                <Select disabled={locked} value={listId} onChange={setListId} options={lists.map((list) => ({ id: list.id, label: list.name }))} />
              </Property>
              <Property label="Trạng thái">
                <Select disabled={!canChangeStatus} value={statusId} onChange={setStatusId} options={statuses.map((status) => ({ id: status.id, label: status.name }))} />
              </Property>
              <Property label="Mức độ ưu tiên">
                <Select disabled={locked} value={priority} onChange={(value) => setPriority(value as Priority)} options={PRIORITIES.map((item) => ({ id: item, label: PRIORITY_LABEL[item] }))} />
              </Property>
              <Property label="Người thực hiện">
                <Select disabled={locked} value={assigneeId} onChange={setAssigneeId} options={[{ id: "", label: "Chưa giao" }, ...roster.filter((member) => !memberMode || member.userId === actorId || member.userId === task?.assigneeId).map((member) => ({ id: member.userId, label: member.name }))]} />
              </Property>
              <Property label="Người giao">
                <Select disabled={locked || memberMode} value={reporterId} onChange={setReporterId} options={reporterOptions} />
              </Property>
              <Property label="Ngày bắt đầu">
                <input
                  type="datetime-local"
                  value={startAt}
                  disabled={locked}
                  onChange={(event) => setStartAt(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#dfe1e6] bg-white px-2.5 text-[13px] text-[#172b4d] outline-none disabled:bg-[#f7f8f9] disabled:text-[#626f86]"
                />
              </Property>
              <Property label="Hạn chót">
                <input
                  type="datetime-local"
                  value={dueAt}
                  disabled={locked}
                  min={toLocalDateTime(new Date(Date.now() + 60_000).toISOString())}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#dfe1e6] bg-white px-2.5 text-[13px] text-[#172b4d] outline-none disabled:bg-[#f7f8f9] disabled:text-[#626f86]"
                />
              </Property>
              <Property label="Story points">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={storyPoints}
                  disabled={locked}
                  placeholder="Tuỳ chọn"
                  onChange={(event) => setStoryPoints(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#dfe1e6] bg-white px-2.5 text-[13px] text-[#172b4d] outline-none disabled:bg-[#f7f8f9] disabled:text-[#626f86]"
                />
              </Property>
            </div>
            {memberMode && reviewStatus && statusId !== reviewStatus.id ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(reviewStatus.id)}
                className="mt-3 h-9 w-full rounded-md border border-[#0c66e4] bg-white text-[13px] font-semibold text-[#0c66e4] hover:bg-[#e9f2ff] disabled:opacity-55"
              >
                Gửi để đánh giá
              </button>
            ) : null}
            {memberMode && statusId !== task?.statusId ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="mt-3 h-9 w-full rounded-md bg-[#0c66e4] text-[13px] font-semibold text-white hover:bg-[#0055cc] disabled:opacity-55"
              >
                Cập nhật trạng thái
              </button>
            ) : null}
            {error ? <p className="mt-3 text-[12px] text-[#ae2e24]">{error}</p> : null}
            </div>
            {showEditChrome ? (
              <div className="flex items-center justify-end gap-2 border-t border-[#dfe1e6] px-4 py-3">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="h-[34px] rounded bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#44546f] hover:bg-[#e4e6ea]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => void save()}
                  className="h-[34px] rounded bg-[#0c66e4] px-3 text-[13px] font-semibold text-white hover:bg-[#0055cc] disabled:opacity-55"
                >
                  {creating ? "Tạo công việc" : "Lưu thay đổi"}
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default TaskDialog;

function Crumb({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="text-[#b3b9c4]">/</span>
      <span className="max-w-[140px] truncate text-[13px] text-[#626f86]">{children}</span>
    </>
  );
}

function Section({ label, extra, children }: { label: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold tracking-[0.08em] text-[#7a869a] uppercase">{label}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[#44546f]">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-[#dfe1e6] bg-white px-2.5 text-[13px] text-[#172b4d] outline-none"
    >
      {options.map((option) => (
        <option key={option.id || "empty"} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded text-[#626f86] hover:bg-[#f1f2f4] hover:text-[#172b4d] disabled:opacity-45 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function toLocalDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

