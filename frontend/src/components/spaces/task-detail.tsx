"use client";

import { Check, Link2, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
const PRIORITIES: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Khẩn cấp",
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};
const PRIORITY_TONE: Record<Priority, string> = {
  URGENT: "bg-[#ffeceb] text-[#ae2e24]",
  HIGH: "bg-[#fff3eb] text-[#c25100]",
  MEDIUM: "bg-[#fff7d6] text-[#7f5f01]",
  LOW: "bg-[#f1f2f4] text-[#44546f]",
};
const AVATAR = ["#0c66e4", "#6e5dc6", "#e56910", "#22a06b", "#ae4787", "#334563"];

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
  createdAt?: string;
};

type CheckItem = { id: string; title: string; done: boolean };
type Note = { id: string; author: string; body: string; at: string };

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
  onClose: () => void;
  onSaved: () => void;
}) {
  const creating = task === null;
  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const memberIds = new Set(members.map((member) => member.userId));
  const fallbackReporter = currentUserId && memberIds.has(currentUserId) ? currentUserId : (members[0]?.userId ?? "");
  const currentName = members.find((member) => member.userId === currentUserId)?.name ?? "Bạn";
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [listId, setListId] = useState(task?.listId || presetListId || lists[0]?.id || "");
  const [statusId, setStatusId] = useState(
    task?.statusId || (presetStatusId && statuses.some((status) => status.id === presetStatusId) ? presetStatusId : (statuses[0]?.id ?? "")),
  );
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [reporterId, setReporterId] = useState(task?.reporterId || fallbackReporter);
  const [dueAt, setDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 10) : "");
  const [checks, setChecks] = useState<CheckItem[]>(() => loadExtra(task?.id).checks);
  const [notes, setNotes] = useState<Note[]>(() => loadExtra(task?.id).notes);
  const [checkDraft, setCheckDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const ready = title.trim().length > 0 && listId && statusId && reporterId && !saving;
  const statusName = statuses.find((status) => status.id === statusId)?.name ?? "Trạng thái";
  const listName = lists.find((list) => list.id === listId)?.name ?? "List";
  const reporterName = members.find((member) => member.userId === reporterId)?.name ?? task?.reporterName ?? "—";
  const doneCount = checks.filter((item) => item.done).length;
  const progress = checks.length === 0 ? 0 : Math.round((doneCount / checks.length) * 100);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!task) return;
    saveExtra(task.id, checks, notes);
  }, [task, checks, notes]);

  const reporterOptions = members.map((member) => ({ id: member.userId, label: member.name }));
  if (task && !memberIds.has(task.reporterId)) {
    reporterOptions.unshift({ id: task.reporterId, label: task.reporterName });
  }

  function addCheck() {
    const value = checkDraft.trim();
    if (!value) return;
    setChecks((current) => [...current, { id: crypto.randomUUID(), title: value, done: false }]);
    setCheckDraft("");
  }

  function addNote() {
    const value = noteDraft.trim();
    if (!value) return;
    setNotes((current) => [{ id: crypto.randomUUID(), author: currentName, body: value, at: new Date().toISOString() }, ...current]);
    setNoteDraft("");
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

  async function save() {
    if (!ready) return;
    setSaving(true);
    setError("");
    const payload = {
      listId,
      title: title.trim(),
      description: description.trim(),
      statusId,
      priority,
      assigneeId: assigneeId || null,
      reporterId,
      dueAt: dueAt ? `${dueAt}T12:00:00.000Z` : null,
    };
    try {
      if (creating) {
        const response = await api.post<{ id: string }>(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks`, payload);
        saveExtra(response.data.id, checks, notes);
      } else {
        await api.patch(`/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${task.id}`, payload);
        saveExtra(task.id, checks, notes);
      }
      onSaved();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không lưu được công việc");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#091e42]/45 p-4" onMouseDown={onClose}>
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
            <IconButton label="Sao chép liên kết" onClick={() => void copyText(`${task?.code ?? "Công việc"} · ${title || "Chưa đặt tên"}`, "Đã sao chép")}>
              <Link2 size={15} />
            </IconButton>
            <IconButton
              label="Chia sẻ"
              onClick={() => void copyText(`${creating ? "Công việc mới" : task.code}: ${title || "Chưa đặt tên"} — ${workspaceName} / ${spaceName} / ${listName}`, "Đã sao chép nội dung chia sẻ")}
            >
              <Share2 size={15} />
            </IconButton>
            <IconButton label="Sửa tiêu đề" onClick={() => titleRef.current?.focus()}>
              <Pencil size={15} />
            </IconButton>
            <IconButton label="Đóng" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </span>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_312px]">
          <div className="min-h-0 min-w-0 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Trạng thái"
                value={statusId}
                onChange={(event) => setStatusId(event.target.value)}
                className={`h-7 rounded-full px-3 text-[11px] font-bold outline-none ${statusTone(statusName)}`}
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Mức độ ưu tiên"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className={`h-7 rounded-full px-3 text-[11px] font-bold outline-none ${PRIORITY_TONE[priority]}`}
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {PRIORITY_LABEL[item]}
                  </option>
                ))}
              </select>
            </div>

            <input
              ref={titleRef}
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tên công việc"
              className="mt-3 w-full border-0 bg-transparent text-[26px] leading-tight font-semibold text-[#172b4d] outline-none placeholder:text-[#172b4d]/35"
            />
            <p className="mt-1.5 text-[12px] text-[#626f86]">
              Tạo bởi <span className="font-semibold text-[#44546f]">{reporterName}</span>
              {task?.createdAt ? ` lúc ${formatWhen(task.createdAt)}` : creating ? "" : ""}
            </p>

            <Section label="Mô tả">
              <textarea
                value={description}
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
                      onClick={() => setChecks((current) => current.map((row) => (row.id === item.id ? { ...row, done: !row.done } : row)))}
                      className={`grid size-4 shrink-0 place-items-center rounded-[3px] border ${item.done ? "border-[#0c66e4] bg-[#0c66e4] text-white" : "border-[#b3b9c4] bg-white"}`}
                    >
                      {item.done ? <Check size={11} strokeWidth={3} /> : null}
                    </button>
                    <input
                      value={item.title}
                      onChange={(event) => setChecks((current) => current.map((row) => (row.id === item.id ? { ...row, title: event.target.value } : row)))}
                      className={`min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none ${item.done ? "text-[#626f86] line-through" : "text-[#172b4d]"}`}
                    />
                    <button
                      type="button"
                      aria-label="Xóa mục"
                      onClick={() => setChecks((current) => current.filter((row) => row.id !== item.id))}
                      className="grid size-6 place-items-center rounded text-[#626f86] opacity-0 group-hover:opacity-100 hover:bg-white"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
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
            </Section>

            <Section label="Hoạt động">
              <form
                className="flex items-start gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addNote();
                }}
              >
                <Avatar name={currentName} />
                <input
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Viết cập nhật..."
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#dfe1e6] px-3 text-[13px] text-[#172b4d] outline-none placeholder:text-[#a5adba] focus:border-[#0c66e4]"
                />
                <button type="submit" disabled={!noteDraft.trim()} className="h-9 rounded bg-[#0c66e4] px-3 text-[12px] font-semibold text-white disabled:opacity-50">
                  Gửi
                </button>
              </form>
              <ul className="mt-4 flex flex-col gap-3">
                {notes.map((note) => (
                  <li key={note.id} className="flex gap-2">
                    <Avatar name={note.author} />
                    <span className="min-w-0">
                      <span className="block text-[12px] text-[#626f86]">
                        <span className="font-semibold text-[#172b4d]">{note.author}</span>
                        {` · ${relative(note.at)}`}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-[#172b4d]">{note.body}</span>
                    </span>
                  </li>
                ))}
                {!creating && task?.createdAt ? (
                  <li className="flex gap-2">
                    <Avatar name={task.reporterName} />
                    <span className="text-[12px] text-[#626f86]">
                      <span className="font-semibold text-[#172b4d]">{task.reporterName}</span>
                      {` đã tạo công việc · ${relative(task.createdAt)}`}
                    </span>
                  </li>
                ) : null}
                {notes.length === 0 && (creating || !task?.createdAt) ? (
                  <li className="text-[12px] text-[#626f86]">Chưa có hoạt động.</li>
                ) : null}
              </ul>
            </Section>
          </div>

          <aside className="flex min-h-0 flex-col border-t border-[#eef0f3] bg-[#fafbfc] lg:border-t-0 lg:border-l lg:border-[#dfe1e6]">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <p className="mb-4 text-[11px] font-bold tracking-[0.08em] text-[#7a869a]">THÔNG TIN</p>
            <div className="flex flex-col gap-3">
              <Property label="Space">
                <div className="flex h-9 items-center rounded-md border border-[#dfe1e6] bg-white px-2.5 text-[13px] font-medium text-[#172b4d]">{spaceName}</div>
              </Property>
              <Property label="List">
                <Select value={listId} onChange={setListId} options={lists.map((list) => ({ id: list.id, label: list.name }))} />
              </Property>
              <Property label="Trạng thái">
                <Select value={statusId} onChange={setStatusId} options={statuses.map((status) => ({ id: status.id, label: status.name }))} />
              </Property>
              <Property label="Mức độ ưu tiên">
                <Select value={priority} onChange={(value) => setPriority(value as Priority)} options={PRIORITIES.map((item) => ({ id: item, label: PRIORITY_LABEL[item] }))} />
              </Property>
              <Property label="Người thực hiện">
                <Select value={assigneeId} onChange={setAssigneeId} options={[{ id: "", label: "Chưa giao" }, ...members.map((member) => ({ id: member.userId, label: member.name }))]} />
              </Property>
              <Property label="Người giao">
                <Select value={reporterId} onChange={setReporterId} options={reporterOptions} />
              </Property>
              <Property label="Hạn chót">
                <input
                  type="date"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#dfe1e6] bg-white px-2.5 text-[13px] text-[#172b4d] outline-none"
                />
              </Property>
            </div>
            {error ? <p className="mt-3 text-[12px] text-[#ae2e24]">{error}</p> : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#dfe1e6] px-4 py-3">
              <button type="button" onClick={onClose} className="h-[34px] rounded bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#44546f] hover:bg-[#e4e6ea]">
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
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
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

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-8 place-items-center rounded text-[#626f86] hover:bg-[#f1f2f4] hover:text-[#172b4d]">
      {children}
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: AVATAR[hash % AVATAR.length] }}>
      {letters || "?"}
    </span>
  );
}

function statusTone(name: string) {
  if (/hoàn/i.test(name)) return "bg-[#dcfff1] text-[#216e4e]";
  if (/đang|review/i.test(name)) return "bg-[#e9f2ff] text-[#0c66e4]";
  return "bg-[#f1f2f4] text-[#44546f]";
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function relative(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return formatWhen(iso);
}

function extraKey(taskId: string) {
  return `northstar.task.extra.${taskId}`;
}

function loadExtra(taskId?: string) {
  if (!taskId || typeof window === "undefined") return { checks: [] as CheckItem[], notes: [] as Note[] };
  try {
    const raw = window.localStorage.getItem(extraKey(taskId));
    if (!raw) return { checks: [], notes: [] };
    const parsed = JSON.parse(raw) as { checks?: CheckItem[]; notes?: Note[] };
    return {
      checks: Array.isArray(parsed.checks) ? parsed.checks : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { checks: [], notes: [] };
  }
}

function saveExtra(taskId: string, checks: CheckItem[], notes: Note[]) {
  window.localStorage.setItem(extraKey(taskId), JSON.stringify({ checks, notes }));
}
