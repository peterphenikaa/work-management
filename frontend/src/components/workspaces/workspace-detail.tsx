"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";
import { useShellUser } from "@/components/shell/app-shell";
import { EditWorkspaceDialog, type WorkspaceItem } from "@/components/workspaces/workspace-dialogs";
import { CreateSpaceDialog, spaceIcon, spaceSwatch, type SpaceItem } from "@/components/workspaces/space-dialog";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: Role;
};

type Invite = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

type Activity = {
  id: string;
  label: string;
  actorName: string;
  createdAt: string;
};

const AVATAR = ["#334563", "#0c66e4", "#6e5dc6", "#d97008", "#ae4787", "#159b91"];

function avatarColor(name: string) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return AVATAR[hash % AVATAR.length];
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")} thg ${date.getMonth() + 1}, ${date.getFullYear()}`;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Hôm nay, ${time}`;
  return `${formatDate(iso)}, ${time}`;
}

export function WorkspaceDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useShellUser();
  const [item, setItem] = useState<WorkspaceItem | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [iconSrc, setIconSrc] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (user?.role !== "ADMIN" || !id) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      api.get<WorkspaceItem>(`/workspaces/${id}`),
      api.get<{ items: Member[] }>(`/workspaces/${id}/members`),
      api.get<{ items: Invite[] }>(`/workspaces/${id}/invitations`),
      api.get<{ items: Activity[] }>(`/workspaces/${id}/activity`),
      api.get<{ items: SpaceItem[] }>(`/workspaces/${id}/spaces`),
    ])
      .then(([workspace, memberList, inviteList, activityList, spaceList]) => {
        if (cancelled) return;
        setItem(workspace.data);
        setSpaces(spaceList.data.items);
        const ownerId = workspace.data.ownerId;
        const rows = [...memberList.data.items];
        rows.sort((a, b) => Number(b.userId === ownerId) - Number(a.userId === ownerId));
        setMembers(rows);
        setInvites(inviteList.data.items);
        setActivity(activityList.data.items);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Không tải được workspace");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, user?.role]);

  useEffect(() => {
    if (!item?.hasIcon) return;
    let cancelled = false;
    let url: string | null = null;
    api
      .get(`/workspaces/${item.id}/icon`, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        url = URL.createObjectURL(response.data);
        setIconSrc(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item]);

  if (user && user.role !== "ADMIN") {
    return <section className="px-8 pt-8 text-[14px] text-[#626f86]">Chỉ quản trị viên xem được workspace này.</section>;
  }

  async function saveMembers(next: Member[]) {
    if (!item) return;
    const patched = await api.patch<WorkspaceItem>(`/workspaces/${item.id}`, {
      name: item.name,
      accessType: item.accessType,
      ownerId: item.ownerId,
      updatedAt: item.updatedAt,
      members: next.map((row) => ({
        userId: row.userId,
        role: row.userId === item.ownerId ? "ADMIN" : row.role,
      })),
    });
    setItem(patched.data);
    setMembers(next);
    setReloadKey((value) => value + 1);
  }

  async function addInvite() {
    const needle = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(needle) || !item) {
      setError(needle ? "Email không hợp lệ" : "");
      return;
    }
    setError("");
    try {
      const response = await api.post<Invite>(`/workspaces/${item.id}/invitations`, {
        email: needle,
        role: "MEMBER",
      });
      setInvites((current) =>
        current.some((row) => row.id === response.data.id) ? current : [...current, response.data],
      );
      setEmail("");
      setAdding(false);
      setReloadKey((value) => value + 1);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không gửi được lời mời");
    }
  }

  const mark = (item?.icon?.trim() || (item ? initials(item.name) : "WS")).slice(0, 4);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-8 pt-7 pb-10">
      <Link href="/workspaces" className="inline-flex h-7 items-center gap-1.5 rounded-[4px] px-1.5 text-[13px] font-semibold text-[#626f86] hover:bg-[#f7f8f9]">
        <ChevronLeft size={16} />
        Quay lại Workspaces
      </Link>

      {loading ? <p className="mt-6 text-[13px] text-[#626f86]">Đang tải workspace…</p> : null}
      {!loading && error && !item ? <p className="mt-6 text-[13px] text-[#ca3521]">{error}</p> : null}

      {item ? (
        <>
          <div className="mt-2.5 flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[25px] leading-8 tracking-[-0.4px] text-[#172b4d]">{item.name}</h1>
              <p className="mt-1.5 text-[13px] text-[#626f86]">
                {item.description?.trim() || "Chưa có mô tả."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-[34px] shrink-0 rounded-[4px] bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#172b4d]"
            >
              Chỉnh sửa Workspace
            </button>
          </div>

          <div className="mt-6 grid overflow-hidden rounded-[8px] border border-[#dfe1e6] lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,1fr)]">
            <div className="flex items-center gap-4 border-[#dfe1e6] px-[22px] py-5 lg:border-r">
              <span className="grid size-[50px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-[#0c66e4] to-[#0052cc] text-[16px] font-bold text-white">
                {iconSrc ? <img src={iconSrc} alt="" className="size-[50px] object-cover" /> : mark}
              </span>
              <span className="min-w-0">
                <span className="inline-flex rounded-[3px] bg-[#f3f0ff] px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-[#5e4db2]">
                  {item.accessType}
                </span>
                <span className="mt-1.5 block truncate text-[18px] text-[#172b4d]">{item.name}</span>
                <span className="mt-1 block truncate text-[13px] text-[#626f86]">
                  {item.description?.trim() || "Chưa có mô tả."}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2">
              <Stat label="Ngày tạo" value={formatDate(item.createdAt)} className="border-r border-b" />
              <Stat label="Cập nhật gần nhất" value={formatWhen(item.updatedAt)} className="border-b" />
              <Stat label="Cấu trúc" value={`${spaces.length} Space · 0 List`} className="border-r" />
              <Stat label="Thành viên" value={`${item.memberCount} tài khoản`} />
            </div>
          </div>

          <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
            <div className="flex flex-col gap-4">
              <section className="overflow-hidden rounded-[7px] border border-[#dfe1e6]">
                <header className="flex items-center justify-between gap-3 border-b border-[#dfe1e6] px-4 py-3">
                  <span>
                    <span className="block text-[14px] text-[#172b4d]">Cấu trúc Không gian & Dự án</span>
                    <span className="mt-1 block text-[12px] text-[#626f86]">
                      Dữ liệu cấp con được tải khi mở từng Space hoặc List.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreatingSpace(true)}
                    className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-[4px] bg-[#0c66e4] px-3 text-[13px] font-semibold text-white"
                  >
                    <Plus size={16} />
                    Tạo Space mới
                  </button>
                </header>
                <div className="p-4">
                  <div className="flex h-14 items-center gap-2.5 rounded-[6px] border border-[#dfe1e6] bg-[#f7f8f9] px-2.5">
                    <span className="grid size-[34px] place-items-center overflow-hidden rounded-[7px] bg-gradient-to-br from-[#0c66e4] to-[#0052cc] text-[12px] font-bold text-white">
                      {iconSrc ? <img src={iconSrc} alt="" className="size-[34px] object-cover" /> : mark}
                    </span>
                    <span>
                      <span className="block text-[13px] font-bold text-[#172b4d]">{item.name}</span>
                      <span className="block text-[12px] text-[#626f86]">{spaces.length} Space trực thuộc</span>
                    </span>
                  </div>
                  {spaces.map((space) => (
                    <div key={space.id} className="mt-2 flex h-12 items-center gap-2.5 rounded-[6px] border border-[#dfe1e6] px-2.5 pl-8">
                      <span
                        className="grid size-[28px] place-items-center rounded-[6px]"
                        style={{ backgroundColor: spaceSwatch(space.color) }}
                      >
                        <img src={spaceIcon(space.icon)} alt="" width={18} height={18} className="brightness-0 invert" />
                      </span>
                      <span>
                        <span className="block text-[13px] font-bold text-[#172b4d]">{space.name}</span>
                        <span className="block text-[12px] text-[#626f86]">0 List</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-[7px] border border-[#dfe1e6]">
                <header className="flex items-center justify-between gap-3 border-b border-[#dfe1e6] px-4 py-3">
                  <span>
                    <span className="block text-[14px] text-[#172b4d]">Danh sách thành viên</span>
                    <span className="mt-1 block text-[12px] text-[#626f86]">
                      Vai trò và trạng thái truy cập hiện tại trong Workspace.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdding((value) => !value)}
                    className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-[4px] bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#172b4d]"
                  >
                    <Plus size={16} />
                    Thêm thành viên
                  </button>
                </header>
                {adding ? (
                  <div className="flex gap-2 border-b border-[#dfe1e6] px-4 py-3">
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void addInvite();
                      }}
                      placeholder="ten@congty.vn"
                      className="h-10 min-w-0 flex-1 rounded-[4px] border border-[#c7cdd6] px-2.5 text-[14px] text-[#172b4d] outline-none focus:border-[#0c66e4]"
                    />
                    <button
                      type="button"
                      onClick={() => void addInvite()}
                      className="h-[34px] self-center rounded-[4px] bg-[#0c66e4] px-3 text-[13px] font-semibold text-white"
                    >
                      Thêm
                    </button>
                  </div>
                ) : null}
                <div className="grid h-10 grid-cols-[minmax(0,1fr)_150px_120px_40px] items-center px-4 text-[11px] font-semibold tracking-wide text-[#7a869a] uppercase">
                  <span>Thành viên</span>
                  <span>Vai trò</span>
                  <span>Trạng thái</span>
                  <span />
                </div>
                {members.map((member) => {
                  const isOwner = member.userId === item.ownerId;
                  return (
                    <div
                      key={member.userId}
                      className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_150px_120px_40px] items-center border-t border-[#eef0f3] px-3.5"
                    >
                      <PersonCell name={member.name} email={member.email} owner={isOwner} />
                      <RoleSelect
                        value={isOwner ? "ADMIN" : member.role}
                        disabled={isOwner}
                        onChange={(role) =>
                          void saveMembers(
                            members.map((row) => (row.userId === member.userId ? { ...row, role } : row)),
                          ).catch((reason: unknown) =>
                            setError(reason instanceof Error ? reason.message : "Không đổi được vai trò"),
                          )
                        }
                      />
                      <StatusPill pending={false} />
                      <button
                        type="button"
                        aria-label={`Gỡ ${member.name}`}
                        disabled={isOwner}
                        onClick={() =>
                          void saveMembers(members.filter((row) => row.userId !== member.userId)).catch(
                            (reason: unknown) =>
                              setError(reason instanceof Error ? reason.message : "Không gỡ được thành viên"),
                          )
                        }
                        className="grid size-[30px] place-items-center text-[#ca3521] disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
                {invites.map((invite) => {
                  const label = invite.name?.trim() || invite.email;
                  return (
                    <div
                      key={invite.id}
                      className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_150px_120px_40px] items-center border-t border-[#eef0f3] px-3.5"
                    >
                      <PersonCell name={label} email={invite.name ? invite.email : "Chờ tham gia"} />
                      <RoleSelect
                        value={invite.role}
                        onChange={(role) =>
                          void api
                            .patch(`/workspaces/${item.id}/invitations/${invite.id}`, { role })
                            .then(() =>
                              setInvites((current) =>
                                current.map((row) => (row.id === invite.id ? { ...row, role } : row)),
                              ),
                            )
                            .catch((reason: unknown) =>
                              setError(reason instanceof Error ? reason.message : "Không đổi được vai trò"),
                            )
                        }
                      />
                      <StatusPill pending />
                      <button
                        type="button"
                        aria-label={`Hủy lời mời ${label}`}
                        onClick={() =>
                          void api
                            .delete(`/workspaces/${item.id}/invitations/${invite.id}`)
                            .then(() => setInvites((current) => current.filter((row) => row.id !== invite.id)))
                            .catch((reason: unknown) =>
                              setError(reason instanceof Error ? reason.message : "Không hủy được lời mời"),
                            )
                        }
                        className="grid size-[30px] place-items-center text-[#ca3521]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </section>
              {error ? <p className="text-[13px] text-[#ca3521]">{error}</p> : null}
            </div>

            <aside className="overflow-hidden rounded-[7px] border border-[#dfe1e6]">
              <header className="border-b border-[#dfe1e6] px-4 py-3">
                <p className="text-[14px] text-[#172b4d]">Nhật ký thay đổi</p>
                <p className="mt-1 text-[12px] text-[#626f86]">Hoạt động quanh workspace này.</p>
              </header>
              {activity.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-[#626f86]">Chưa có nhật ký.</p>
              ) : (
                activity.map((entry) => (
                  <div key={entry.id} className="border-b border-[#eef0f3] px-4 py-3 last:border-b-0">
                    <p className="text-[13px] font-semibold text-[#172b4d]">{entry.label}</p>
                    <p className="mt-0.5 text-[12px] text-[#626f86]">
                      {entry.actorName} · {formatWhen(entry.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </aside>
          </div>

          {creatingSpace ? (
            <CreateSpaceDialog
              workspaceId={item.id}
              onClose={() => setCreatingSpace(false)}
              onCreated={() => {
                setCreatingSpace(false);
                setReloadKey((value) => value + 1);
              }}
            />
          ) : null}
          {editing ? (
            <EditWorkspaceDialog
              item={item}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setReloadKey((value) => value + 1);
              }}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex min-h-[70px] flex-col justify-center border-[#dfe1e6] px-4 py-3 ${className}`}>
      <p className="text-[11px] font-bold tracking-wide text-[#7a869a] uppercase">{label}</p>
      <p className="mt-1.5 text-[14px] font-bold text-[#172b4d]">{value}</p>
    </div>
  );
}

function PersonCell({ name, email, owner = false }: { name: string; email: string; owner?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: avatarColor(name) }}
      >
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-bold text-[#172b4d]">{name}</span>
          {owner ? (
            <span className="rounded-[3px] bg-[#f3f0ff] px-1.5 py-0.5 text-[11px] font-bold text-[#5e4db2]">Owner</span>
          ) : null}
        </span>
        <span className="block truncate text-[12px] text-[#626f86]">{email}</span>
      </span>
    </span>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: Role;
  disabled?: boolean;
  onChange: (role: Role) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as Role)}
      className="h-[30px] w-[132px] rounded-[4px] border border-[#dfe1e6] bg-white px-2 text-[13px] text-[#172b4d] outline-none focus:border-[#0c66e4] disabled:bg-[#f7f8f9]"
    >
      <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
      <option value="LEADER">{ROLE_LABEL.LEADER}</option>
      <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
    </select>
  );
}

function StatusPill({ pending }: { pending: boolean }) {
  return (
    <span
      className={`inline-flex h-[22px] w-fit items-center gap-1.5 rounded-[3px] px-1.5 text-[12px] font-semibold ${
        pending ? "bg-[#fff7d6] text-[#974f0c]" : "bg-[#dffcf0] text-[#216e4e]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${pending ? "bg-[#e2b203]" : "bg-[#22a06b]"}`} />
      {pending ? "Chờ tham gia" : "Hoạt động"}
    </span>
  );
}
