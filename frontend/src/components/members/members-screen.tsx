"use client";

import { Lock, LockOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";
import { useShellUser } from "@/components/shell/app-shell";

type WorkspaceOption = {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
};

type WorkspaceMember = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  locked: boolean;
  isOwner: boolean;
};

const WORKSPACE_ROLES = ["ADMIN", "LEADER", "MEMBER"] as const;
const AVATAR = ["#5e4db2", "#6e5dc6", "#e56910", "#159b91", "#0c66e4", "#ae4787"];
const ROLE_TONE: Record<Role, string> = {
  ADMIN: "bg-[#f3f0ff] text-[#5e4db2]",
  LEADER: "bg-[#e9f2ff] text-[#0c66e4]",
  MEMBER: "bg-[#f4f5f7] text-[#44546f]",
};

type LockConfirm = { member: WorkspaceMember; nextLocked: boolean };
type DeleteConfirm = { member: WorkspaceMember };

export function MembersScreen() {
  const user = useShellUser();
  const [scope, setScope] = useState<string>("");
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lockConfirm, setLockConfirm] = useState<LockConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedWorkspace = workspaces.find((row) => row.id === scope);

  const loadWorkspace = useCallback((workspaceId: string) => {
    setLoading(true);
    api
      .get<{ items: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`)
      .then((response) => {
        setMembers(response.data.items);
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không tải được thành viên workspace"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    api
      .get<{ items: WorkspaceOption[] }>("/workspaces?page=1&pageSize=100&sort=name&order=asc")
      .then((response) => {
        const active = response.data.items.filter((row) => row.status !== "ARCHIVED");
        setWorkspaces(active);
        setScope((current) => {
          if (current && active.some((row) => row.id === current)) return current;
          return active[0]?.id ?? "";
        });
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Không tải được danh sách workspace");
        setLoading(false);
      });
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    if (!scope) {
      setMembers([]);
      setLoading(false);
      return;
    }
    loadWorkspace(scope);
  }, [user?.role, scope, loadWorkspace]);

  if (user && user.role !== "ADMIN") {
    return <section className="px-8 pt-8 text-[14px] text-[#626f86]">Chỉ quản trị viên xem được màn này.</section>;
  }

  const active = members.filter((row) => !row.locked).length;
  const lockedCount = members.length - active;

  async function changeWorkspaceRole(member: WorkspaceMember, role: Role) {
    if (member.isOwner) return;
    setError("");
    const previous = members;
    setMembers((current) => current.map((row) => (row.userId === member.userId ? { ...row, role } : row)));
    try {
      await api.patch(`/workspaces/${scope}/members/${member.userId}`, { role });
    } catch (reason: unknown) {
      setMembers(previous);
      setError(reason instanceof Error ? reason.message : "Không đổi được vai trò workspace");
    }
  }

  async function confirmLock() {
    if (!lockConfirm) return;
    setBusy(true);
    setError("");
    const { member, nextLocked } = lockConfirm;
    try {
      await api.patch(`/workspaces/people/${member.userId}`, { locked: nextLocked });
      setMembers((current) => current.map((row) => (row.userId === member.userId ? { ...row, locked: nextLocked } : row)));
      setLockConfirm(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không đổi được trạng thái");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/workspaces/${scope}/members/${deleteConfirm.member.userId}`);
      setMembers((current) => current.filter((row) => row.userId !== deleteConfirm.member.userId));
      setDeleteConfirm(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không gỡ được thành viên");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="min-h-full bg-white px-8 py-6">
      <p className="text-[13px] text-[#626f86]">
        <Link href="/workspaces" className="hover:text-[#0c66e4]">
          Workspaces
        </Link>
        <span> / </span>
        <span className="text-[#172b4d]">Thành viên & Phân quyền</span>
      </p>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <span className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-8 font-semibold text-[#172b4d]">Thành viên & Phân quyền</h1>
          <p className="mt-1 text-[14px] text-[#626f86]">
            Phân quyền theo từng workspace. Cùng một người có thể là Thành viên ở workspace này và Trưởng nhóm ở workspace khác.
          </p>
        </span>
        <label className="flex min-w-[260px] flex-col gap-1.5">
          <span className="text-[12px] font-bold text-[#44546f]">Workspace</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            disabled={workspaces.length === 0}
            className="h-9 rounded-md border border-[#dfe1e6] bg-white px-3 text-[13px] font-medium text-[#172b4d] outline-none focus:border-[#0c66e4] disabled:opacity-60"
          >
            {workspaces.length === 0 ? <option value="">Chưa có workspace</option> : null}
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
                {workspace.status === "PAUSED" ? " (Tạm dừng)" : ""}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error ? <p className="mt-3 text-[13px] text-[#ae2e24]">{error}</p> : null}
      {loading ? <p className="mt-6 text-[13px] text-[#626f86]">Đang tải thành viên…</p> : null}

      {!loading && !scope ? (
        <p className="mt-6 text-[13px] text-[#626f86]">Chưa có workspace để phân quyền. Hãy tạo workspace trước.</p>
      ) : null}

      {!loading && scope ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-[#dfe1e6]">
          <div className="flex flex-wrap items-center gap-4 border-b border-[#eef0f3] px-5 py-3 text-[13px] text-[#44546f]">
            <span className="font-semibold text-[#172b4d]">{selectedWorkspace?.name}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#626f86]" />
              {members.length} thành viên
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#22a06b]" />
              {active} đang hoạt động
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#e2483d]" />
              {lockedCount} đã khóa
            </span>
          </div>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[11px] font-bold tracking-wide text-[#7a869a]">
                <th className="px-5 py-3 font-bold">THÀNH VIÊN</th>
                <th className="px-3 py-3 font-bold">EMAIL</th>
                <th className="w-[190px] px-3 py-3 font-bold">VAI TRÒ WORKSPACE</th>
                <th className="w-[160px] px-3 py-3 font-bold">TRẠNG THÁI</th>
                <th className="w-[110px] px-3 py-3 text-right font-bold">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-[#626f86]">
                    Workspace chưa có thành viên.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const self = member.userId === user?.id;
                  return (
                    <tr key={member.userId} className="border-t border-[#eef0f3]">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={member.name} />
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold text-[#172b4d]">{member.name}</span>
                            {member.isOwner ? <span className="block text-[11px] font-semibold text-[#0c66e4]">Chủ sở hữu</span> : null}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-[#44546f]">{member.email}</td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`Vai trò workspace của ${member.name}`}
                          value={member.role}
                          disabled={member.isOwner}
                          onChange={(event) => void changeWorkspaceRole(member, event.target.value as Role)}
                          className={`h-7 rounded-full px-2.5 text-[12px] font-semibold outline-none disabled:opacity-70 ${ROLE_TONE[member.role]}`}
                        >
                          {WORKSPACE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge locked={member.locked} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={member.locked ? `Mở khóa ${member.name}` : `Khóa ${member.name}`}
                            disabled={self}
                            onClick={() => setLockConfirm({ member, nextLocked: !member.locked })}
                            className="grid size-8 place-items-center rounded text-[#626f86] hover:bg-[#f7f8f9] disabled:opacity-40"
                          >
                            {member.locked ? <LockOpen size={15} /> : <Lock size={15} />}
                          </button>
                          <button
                            type="button"
                            aria-label={`Gỡ ${member.name} khỏi workspace`}
                            disabled={self || member.isOwner}
                            onClick={() => setDeleteConfirm({ member })}
                            className="grid size-8 place-items-center rounded text-[#e2483d] hover:bg-[#ffeceb] disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="m-4 rounded-lg bg-[#e9f2ff] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#0c66e4]">Phân quyền theo workspace</p>
            <p className="mt-1 text-[13px] leading-5 text-[#44546f]">
              Vai trò (Quản trị viên / Trưởng nhóm / Thành viên) gắn với từng workspace, không còn “toàn hệ thống”. Đổi
              workspace ở trên để gán quyền khác nhau cho cùng một người. Khóa tài khoản vẫn chặn đăng nhập toàn hệ
              thống; gỡ khỏi workspace không xóa tài khoản.
            </p>
          </div>
        </div>
      ) : null}

      {lockConfirm ? (
        <ConfirmDialog
          title={lockConfirm.nextLocked ? `Khóa ${lockConfirm.member.name}?` : `Mở khóa ${lockConfirm.member.name}?`}
          body={
            lockConfirm.nextLocked
              ? "Tài khoản bị khóa sẽ không đăng nhập được toàn hệ thống."
              : "Tài khoản sẽ đăng nhập và hoạt động trở lại."
          }
          confirmLabel={lockConfirm.nextLocked ? "Khóa tài khoản" : "Mở khóa"}
          danger={lockConfirm.nextLocked}
          busy={busy}
          onCancel={() => setLockConfirm(null)}
          onConfirm={() => void confirmLock()}
        />
      ) : null}

      {deleteConfirm ? (
        <ConfirmDialog
          title={`Gỡ ${deleteConfirm.member.name} khỏi workspace?`}
          body="Người này sẽ mất quyền trong workspace hiện tại; tài khoản và quyền ở workspace khác vẫn giữ nguyên."
          confirmLabel="Gỡ khỏi workspace"
          danger
          busy={busy}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </section>
  );
}

function StatusBadge({ locked }: { locked: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        locked ? "bg-[#ffeceb] text-[#ae2e24]" : "bg-[#dcfff1] text-[#216e4e]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${locked ? "bg-[#e2483d]" : "bg-[#22a06b]"}`} />
      {locked ? "Đã khóa" : "Đang hoạt động"}
    </span>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#091e42]/45 p-4" onMouseDown={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_rgba(9,30,66,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4">
          <p className="text-[15px] font-semibold text-[#172b4d]">{title}</p>
          <p className="mt-2 text-[13px] leading-5 text-[#44546f]">{body}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dfe1e6] bg-[#f7f8f9] px-5 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-9 rounded-md bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#44546f] disabled:opacity-55"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`h-9 rounded-md px-3 text-[13px] font-semibold text-white disabled:opacity-55 ${
              danger ? "bg-[#ca3521] hover:bg-[#ae2e24]" : "bg-[#0c66e4] hover:bg-[#0055cc]"
            }`}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: AVATAR[hash % AVATAR.length] }}
    >
      {initials(name)}
    </span>
  );
}
