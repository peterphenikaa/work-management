"use client";

import { CalendarDays, Play, Plus, Square, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { type MemberSpace, type MemberSprint, type MemberTask } from "@/components/member/member-data";
import { api } from "@/lib/api";

const STATUS_LABEL = { ACTIVE: "Đang chạy", PLANNED: "Sắp tới", CLOSED: "Đã đóng" } as const;
const STATUS_TONE = { ACTIVE: "bg-[#dcfff1] text-[#1f845a]", PLANNED: "bg-[#e9f2ff] text-[#0c66e4]", CLOSED: "bg-[#f1f2f4] text-[#626f86]" } as const;
const RANK = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 } as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Quản lý Sprint cho Leader/Admin: tạo, bắt đầu, đóng và gán task vào Sprint. Mỗi Space chỉ có một Sprint ACTIVE.
export function LeaderSprints({ workspaceId, workspaceName, onChanged }: { workspaceId: string; workspaceName: string; onChanged: () => void }) {
  const [sprints, setSprints] = useState<MemberSprint[]>([]);
  const [spaces, setSpaces] = useState<MemberSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get<{ items: MemberSprint[] }>(`/workspaces/${workspaceId}/sprints`), api.get<{ items: MemberSpace[] }>(`/workspaces/${workspaceId}/spaces/detailed`)])
      .then(([sprintRes, spaceRes]) => {
        if (cancelled) return;
        setSprints(sprintRes.data.items);
        setSpaces(spaceRes.data.items);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được Sprint");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, revision]);

  function reload() {
    setRevision((value) => value + 1);
    onChanged();
  }

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await action();
      reload();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Thao tác không thành công");
    } finally {
      setBusy("");
    }
  }

  const ordered = [...sprints].sort((left, right) => RANK[left.status] - RANK[right.status]);

  return (
    <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-[#626f86]">Workspace {workspaceName} / Sprint</p>
          <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-[#172b4d]">Quản lý Sprint</h1>
          <p className="mt-1 text-[13px] text-[#626f86]">Mỗi Space có tối đa một Sprint đang chạy. Khi đóng Sprint, task chưa hoàn thành quay về backlog.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[#0c66e4] px-3 text-[13px] font-semibold text-white hover:bg-[#0055cc]">
          <Plus size={15} />
          Tạo Sprint
        </button>
      </div>

      {error ? <p className="rounded-md bg-[#ffeceb] px-3 py-2 text-[12px] text-[#ae2e24]">{error}</p> : null}
      {loading ? <p className="py-10 text-center text-[13px] text-[#626f86]">Đang tải Sprint...</p> : null}

      {!loading && ordered.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-[#c1c7d0] bg-white px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#e9f2ff] text-[#0c66e4]">
            <CalendarDays size={22} />
          </span>
          <h2 className="mt-4 text-[16px] font-semibold text-[#172b4d]">Chưa có Sprint nào</h2>
          <p className="mt-1 max-w-[420px] text-[13px] text-[#626f86]">Tạo Sprint cho một Space, thêm công việc rồi bắt đầu Sprint.</p>
        </div>
      ) : null}

      {ordered.map((sprint) => {
        const space = spaces.find((item) => item.id === sprint.spaceId);
        const inSprint: MemberTask[] = space?.tasks.filter((task) => task.sprintId === sprint.id) ?? [];
        const available: MemberTask[] = space?.tasks.filter((task) => !task.sprintId) ?? [];
        const percent = sprint.total === 0 ? 0 : Math.round((sprint.done / sprint.total) * 100);
        const closed = sprint.status === "CLOSED";
        return (
          <article key={sprint.id} className="overflow-hidden rounded-xl border border-[#dfe1e6] bg-white">
            <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#eef0f3] px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[17px] font-semibold text-[#172b4d]">{sprint.name}</h2>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${STATUS_TONE[sprint.status]}`}>{STATUS_LABEL[sprint.status]}</span>
                </div>
                <p className="text-[12px] text-[#626f86]">
                  Space {sprint.spaceName} · {formatDate(sprint.startAt)} – {formatDate(sprint.endAt)} · {sprint.done}/{sprint.total} hoàn thành ({percent}%)
                </p>
                {sprint.goal ? <p className="mt-1 text-[13px] text-[#44546f]">Mục tiêu: {sprint.goal}</p> : null}
              </div>
              {sprint.status === "PLANNED" ? (
                <button
                  type="button"
                  disabled={busy === sprint.id}
                  onClick={() => void run(sprint.id, () => api.post(`/workspaces/${workspaceId}/sprints/${sprint.id}/start`))}
                  className="inline-flex h-8 items-center gap-1.5 rounded bg-[#1f845a] px-3 text-[12px] font-semibold text-white disabled:opacity-60"
                >
                  <Play size={13} />
                  Bắt đầu
                </button>
              ) : null}
              {sprint.status === "ACTIVE" ? (
                <button
                  type="button"
                  disabled={busy === sprint.id}
                  onClick={() => {
                    if (window.confirm(`Đóng "${sprint.name}"? Task chưa hoàn thành sẽ quay về backlog.`)) void run(sprint.id, () => api.post(`/workspaces/${workspaceId}/sprints/${sprint.id}/close`));
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-[#dfe1e6] bg-white px-3 text-[12px] font-semibold text-[#ae2e24] hover:bg-[#fff5f4] disabled:opacity-60"
                >
                  <Square size={13} />
                  Đóng Sprint
                </button>
              ) : null}
            </header>

            {closed ? (
              <p className="px-5 py-3 text-[12px] text-[#626f86]">Sprint đã đóng, không thể thay đổi công việc.</p>
            ) : (
              <div className="flex flex-col gap-1 px-5 py-3">
                {inSprint.length === 0 ? <p className="py-2 text-[13px] text-[#626f86]">Chưa có công việc trong Sprint.</p> : null}
                {inSprint.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-md border border-[#eef0f3] px-3 py-1.5 text-[13px] text-[#172b4d]">
                    <span className="w-[84px] shrink-0 text-[12px] text-[#626f86]">{task.code}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                    <span className="shrink-0 text-[12px] text-[#626f86]">{task.statusName}</span>
                    <span className="w-[120px] shrink-0 truncate text-[12px] text-[#626f86]">{task.assigneeName ?? "Chưa giao"}</span>
                    <button
                      type="button"
                      aria-label={`Gỡ ${task.code} khỏi Sprint`}
                      title="Gỡ khỏi Sprint"
                      onClick={() => void run(task.id, () => api.patch(`/workspaces/${workspaceId}/spaces/${sprint.spaceId}/tasks/${task.id}`, { sprintId: null }))}
                      className="grid size-6 place-items-center rounded text-[#626f86] hover:bg-[#f1f2f4]"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <label className="mt-2 flex items-center gap-2 text-[12px] text-[#626f86]">
                  Thêm công việc
                  <select
                    value=""
                    aria-label={`Thêm công việc vào ${sprint.name}`}
                    onChange={(event) => {
                      const taskId = event.target.value;
                      if (taskId) void run(taskId, () => api.patch(`/workspaces/${workspaceId}/spaces/${sprint.spaceId}/tasks/${taskId}`, { sprintId: sprint.id }));
                    }}
                    className="h-8 max-w-[360px] rounded border border-[#dfe1e6] bg-white px-2 text-[12px] text-[#172b4d]"
                  >
                    <option value="">{available.length === 0 ? "Không còn công việc trống" : "Chọn công việc..."}</option>
                    {available.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.code} · {task.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </article>
        );
      })}

      {creating ? (
        <CreateSprintDialog
          spaces={spaces}
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}

function CreateSprintDialog({ spaces, workspaceId, onClose, onCreated }: { spaces: MemberSpace[]; workspaceId: string; onClose: () => void; onCreated: () => void }) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ready = spaceId && name.trim() && startAt && endAt && !saving;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    if (endAt < startAt) {
      setError("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/workspaces/${workspaceId}/spaces/${spaceId}/sprints`, {
        name: name.trim(),
        goal: goal.trim() || undefined,
        startAt: new Date(`${startAt}T00:00:00+07:00`).toISOString(),
        endAt: new Date(`${endAt}T23:59:59+07:00`).toISOString(),
      });
      onCreated();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không tạo được Sprint");
      setSaving(false);
    }
  }

  const field = "h-9 w-full rounded border border-[#dfe1e6] bg-white px-2.5 text-[13px] text-[#172b4d] outline-none focus:border-[#0c66e4]";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#091e42]/45 p-4" onMouseDown={onClose}>
      <form onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-2xl">
        <h2 className="text-[18px] font-semibold text-[#172b4d]">Tạo Sprint</h2>
        <div className="mt-4 flex flex-col gap-3">
          <label className="text-[12px] font-semibold text-[#44546f]">
            Space
            <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className={`${field} mt-1`}>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-[#44546f]">
            Tên Sprint
            <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className={`${field} mt-1`} placeholder="Ví dụ: Sprint 12" />
          </label>
          <label className="text-[12px] font-semibold text-[#44546f]">
            Mục tiêu
            <input value={goal} maxLength={500} onChange={(event) => setGoal(event.target.value)} className={`${field} mt-1`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-semibold text-[#44546f]">
              Bắt đầu
              <input type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="text-[12px] font-semibold text-[#44546f]">
              Kết thúc
              <input type="date" value={endAt} onChange={(event) => setEndAt(event.target.value)} className={`${field} mt-1`} />
            </label>
          </div>
        </div>
        {error ? <p className="mt-3 text-[12px] text-[#ae2e24]">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#44546f]">
            Hủy
          </button>
          <button type="submit" disabled={!ready} className="h-9 rounded bg-[#0c66e4] px-4 text-[13px] font-semibold text-white disabled:opacity-50">
            {saving ? "Đang tạo..." : "Tạo Sprint"}
          </button>
        </div>
      </form>
    </div>
  );
}
