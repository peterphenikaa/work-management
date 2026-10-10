"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";

type AccessType = "PRIVATE" | "PUBLIC";

export type WorkspaceItem = {
  id: string;
  name: string;
  icon: string | null;
  hasIcon: boolean;
  description: string | null;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  accessType: AccessType;
  status: "ACTIVE" | "ARCHIVED";
};

type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type DraftMember = {
  userId: string;
  name: string;
  email: string;
  role: Role;
};

type DraftInvite = {
  id?: string;
  email: string;
  name: string | null;
  role: Role;
};

const AVATAR = ["#334563", "#0c66e4", "#6e5dc6", "#d97008", "#ae4787"];

function avatarColor(name: string) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return AVATAR[hash % AVATAR.length];
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function CreateWorkspaceDialog({
  ownerId,
  onClose,
  onSaved,
}: {
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <WorkspaceEditor
      mode="create"
      ownerId={ownerId}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

export function EditWorkspaceDialog({
  item,
  onClose,
  onSaved,
}: {
  item: WorkspaceItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  return <WorkspaceEditor mode="edit" item={item} onClose={onClose} onSaved={onSaved} />;
}

function WorkspaceEditor({
  mode,
  item,
  ownerId: defaultOwnerId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  item?: WorkspaceItem;
  ownerId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [ownerId, setOwnerId] = useState(item?.ownerId ?? defaultOwnerId ?? "");
  const [accessType, setAccessType] = useState<AccessType>(item?.accessType ?? "PRIVATE");
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [invites, setInvites] = useState<DraftInvite[]>([]);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const iconFileRef = useRef<File | null>(null);
  const [ready, setReady] = useState(mode === "create");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const peopleRequest = api.get<{ items: Person[] }>("/workspaces/people");
    const membersRequest =
      mode === "edit" && item
        ? api.get<{ items: DraftMember[] }>(`/workspaces/${item.id}/members`)
        : Promise.resolve(null);
    const invitesRequest =
      mode === "edit" && item
        ? api.get<{ items: DraftInvite[] }>(`/workspaces/${item.id}/invitations`)
        : Promise.resolve(null);

    Promise.all([peopleRequest, membersRequest, invitesRequest])
      .then(([peopleResponse, membersResponse, invitesResponse]) => {
        if (cancelled) return;
        setPeople(peopleResponse.data.items);
        if (membersResponse) {
          const rows = membersResponse.data.items;
          const owner = item?.ownerId;
          rows.sort((a, b) => Number(b.userId === owner) - Number(a.userId === owner));
          setMembers(rows);
        }
        if (invitesResponse) setInvites(invitesResponse.data.items);
        setReady(true);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(messageOf(reason, "Không tải được dữ liệu workspace"));
      });

    return () => {
      cancelled = true;
    };
  }, [item, mode]);

  useEffect(() => {
    if (!item?.hasIcon) return;
    let cancelled = false;
    let url: string | null = null;
    api
      .get(`/workspaces/${item.id}/icon`, { responseType: "blob" })
      .then((response) => {
        if (cancelled || iconFileRef.current) return;
        url = URL.createObjectURL(response.data);
        setPreview(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item]);

  const mark = (item?.icon?.trim() || (name.trim() ? initials(name) : "WS")).slice(0, 4);
  const createReady = name.trim().length > 0 && description.trim().length > 0 && ownerId.length > 0;

  function pickIcon(file: File | undefined) {
    if (!file) return;
    const allowed = file.type === "image/png" || file.type === "image/jpeg";
    if (!allowed || file.size > 2 * 1024 * 1024) {
      setError("Chỉ nhận PNG hoặc JPG, tối đa 2 MB");
      return;
    }
    setError("");
    iconFileRef.current = file;
    setIconFile(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  async function addMember() {
    const needle = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(needle)) {
      setError(needle ? "Email không hợp lệ" : "");
      return;
    }
    const person = people.find((row) => row.email.toLowerCase() === needle);
    const owner = people.find((row) => row.id === ownerId);
    if (person?.id === ownerId || owner?.email.toLowerCase() === needle || members.some((row) => row.email.toLowerCase() === needle)) {
      setError("Người này đã có trong workspace");
      return;
    }
    if (invites.some((row) => row.email === needle)) {
      setError("Đã có lời mời chờ tham gia");
      return;
    }
    if (mode === "edit" && item) {
      setInviting(true);
      setError("");
      try {
        const response = await api.post<DraftInvite>(`/workspaces/${item.id}/invitations`, {
          email: needle,
          role: "MEMBER",
        });
        setInvites((current) =>
          current.some((row) => row.id === response.data.id) ? current : [...current, response.data],
        );
        setEmail("");
      } catch (reason: unknown) {
        setError(messageOf(reason, "Không gửi được lời mời"));
      } finally {
        setInviting(false);
      }
      return;
    }
    setInvites((current) => [
      ...current,
      { email: needle, name: person?.name ?? null, role: "MEMBER" },
    ]);
    setEmail("");
    setError("");
  }

  async function changeInviteRole(invite: DraftInvite, role: Role) {
    if (mode === "edit" && item && invite.id) {
      try {
        const response = await api.patch<DraftInvite>(
          `/workspaces/${item.id}/invitations/${invite.id}`,
          { role },
        );
        setInvites((current) => current.map((row) => (row.id === invite.id ? { ...row, ...response.data } : row)));
      } catch (reason: unknown) {
        setError(messageOf(reason, "Không đổi được vai trò lời mời"));
      }
      return;
    }
    setInvites((current) =>
      current.map((row) => (row.email === invite.email ? { ...row, role } : row)),
    );
  }

  async function removeInvite(invite: DraftInvite) {
    if (mode === "edit" && item && invite.id) {
      try {
        await api.delete(`/workspaces/${item.id}/invitations/${invite.id}`);
        setInvites((current) => current.filter((row) => row.id !== invite.id));
      } catch (reason: unknown) {
        setError(messageOf(reason, "Không hủy được lời mời"));
      }
      return;
    }
    setInvites((current) => current.filter((row) => row.email !== invite.email));
  }

  function changeOwner(nextId: string) {
    setOwnerId(nextId);
    if (mode !== "edit") return;
    setMembers((current) => {
      const person = people.find((row) => row.id === nextId);
      const next = current.map((row) =>
        row.userId === nextId ? { ...row, role: "ADMIN" as const } : row,
      );
      if (person && !next.some((row) => row.userId === nextId)) {
        next.unshift({ userId: person.id, name: person.name, email: person.email, role: "ADMIN" });
      }
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "create" && !createReady) return;
    setSaving(true);
    setError("");
    try {
      let workspaceId = item?.id;
      if (mode === "edit" && item) {
        await api.patch(`/workspaces/${item.id}`, {
          name: name.trim(),
          description: description.trim(),
          accessType,
          ownerId,
          updatedAt: item.updatedAt,
          members: members.map((row) => ({
            userId: row.userId,
            role: row.userId === ownerId ? "ADMIN" : row.role,
          })),
        });
      } else {
        const created = await api.post<{ id: string }>("/workspaces", {
          name: name.trim(),
          description: description.trim(),
          ownerId,
          accessType,
          ...(invites.length
            ? { invites: invites.map((row) => ({ email: row.email, role: row.role })) }
            : {}),
        });
        workspaceId = created.data.id;
      }
      if (iconFile && workspaceId) {
        const body = new FormData();
        body.append("file", iconFile);
        await api.post(`/workspaces/${workspaceId}/icon`, body);
      }
      onSaved();
    } catch (reason: unknown) {
      setError(messageOf(reason, "Không lưu được workspace"));
      setSaving(false);
    }
  }

  const isCreate = mode === "create";

  return (
    <DialogShell onClose={onClose}>
      <form onSubmit={submit} className="flex max-h-[calc(100vh-2rem)] flex-col">
        <header className="flex min-h-[76px] items-center gap-[11px] border-b border-[#dfe1e6] px-[18px] py-4">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[7px] bg-[#e9f2ff]">
            <img
              src={isCreate ? "/workspace/plus.svg" : "/workspace/gear.svg"}
              alt=""
              width={18}
              height={18}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-[22.5px] text-[#172b4d]">
              {isCreate ? "Tạo Workspace" : "Sửa Workspace"}
            </span>
            <span className="mt-1 block text-[12px] leading-[18px] text-[#626f86]">
              {isCreate
                ? "Tạo không gian làm việc cấp cao nhất cho tổ chức."
                : "Cập nhật tên và thông tin nhận diện Workspace."}
            </span>
          </span>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="grid h-[34px] w-[34px] place-items-center rounded-[4px]"
          >
            <img src="/workspace/close.svg" alt="" width={18} height={18} />
          </button>
        </header>

        <div className="flex flex-col gap-[18px] overflow-y-auto p-[18px]">
          <div className="flex items-center gap-3 border-b border-[#dfe1e6] pb-4">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-[#0c66e4] to-[#0052cc] text-[15px] font-bold text-white">
              {preview ? (
                <img src={preview} alt="" className="size-14 object-cover" />
              ) : (
                mark
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[#172b4d]">Biểu tượng Workspace</span>
              <span className="mt-0.5 block text-[12px] text-[#626f86]">PNG hoặc JPG, tối đa 2 MB</span>
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-[34px] shrink-0 rounded-[4px] bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#172b4d]"
            >
              Thay đổi biểu tượng
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => {
                pickIcon(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-[14px] gap-y-[14px]">
            <Field label={isCreate ? "Tên Workspace *" : "Tên Workspace"}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="Ví dụ: Product Development"
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label={isCreate ? "Chủ sở hữu / Quản trị viên *" : "Chủ sở hữu / Quản trị viên"}>
              <Select
                value={ownerId}
                onChange={(event) => changeOwner(event.target.value)}
                disabled={!ready}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label={isCreate ? "Mô tả Workspace *" : "Mô tả Workspace"}>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  placeholder="Mục đích, phạm vi hoặc chức năng của Workspace..."
                  className={`${inputClass} h-[76px] resize-none py-2.5`}
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label={isCreate ? "Quyền riêng tư / Chế độ truy cập *" : "Quyền riêng tư / Chế độ truy cập"}>
                <Select value={accessType} onChange={(event) => setAccessType(event.target.value as AccessType)}>
                  <option value="PRIVATE">Riêng tư — Chỉ thành viên được mời</option>
                  <option value="PUBLIC">Công khai — Mọi người trong tổ chức</option>
                </Select>
                <span className="text-[12px] leading-4 font-normal text-[#626f86]">
                  {accessType === "PRIVATE"
                    ? "Người dùng cần được mời để truy cập Workspace."
                    : "Mọi người trong tổ chức có thể truy cập Workspace."}
                </span>
              </Field>
            </div>
          </div>

          <div className="border-t border-[#dfe1e6] pt-4">
            <p className="text-[12px] font-semibold text-[#44546f]">Thành viên ban đầu</p>
            <p className="mt-0.5 text-[12px] text-[#626f86]">
              Mời thành viên hoặc Leader ngay khi khởi tạo Workspace.
            </p>
            <div className="mt-2.5 flex gap-2">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addMember();
                  }
                }}
                placeholder="ten@congty.vn"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => void addMember()}
                disabled={inviting}
                className="flex h-[34px] shrink-0 items-center gap-[7px] self-center rounded-[4px] bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#172b4d] disabled:opacity-55"
              >
                <img src="/workspace/add.svg" alt="" width={18} height={18} />
                Thêm
              </button>
            </div>
            {members.length > 0 || invites.length > 0 ? (
              <div className="mt-2.5 overflow-hidden rounded-[5px] border border-[#dfe1e6]">
                {members.map((member) => {
                  const isOwner = member.userId === ownerId;
                  return (
                    <div
                      key={member.userId}
                      className="flex h-12 items-center gap-[9px] border-b border-[#eef0f3] px-2 last:border-b-0"
                    >
                      <span
                        className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: avatarColor(member.name) }}
                      >
                        {initials(member.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-[#172b4d]">
                          {member.name}
                        </span>
                        <span className="block truncate text-[12px] text-[#626f86]">{member.email}</span>
                      </span>
                      <Select
                        value={isOwner ? "ADMIN" : member.role}
                        disabled={isOwner}
                        compact
                        onChange={(event) => {
                          const role = event.target.value as Role;
                          setMembers((current) =>
                            current.map((row) =>
                              row.userId === member.userId ? { ...row, role } : row,
                            ),
                          );
                        }}
                      >
                        <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                        <option value="LEADER">{ROLE_LABEL.LEADER}</option>
                        <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
                      </Select>
                      <button
                        type="button"
                        aria-label={`Gỡ ${member.name}`}
                        disabled={isOwner}
                        onClick={() =>
                          setMembers((current) => current.filter((row) => row.userId !== member.userId))
                        }
                        className="grid size-[30px] place-items-center rounded-[4px] disabled:opacity-55"
                      >
                        <img src="/workspace/close.svg" alt="" width={18} height={18} />
                      </button>
                    </div>
                  );
                })}
                {invites.map((invite) => {
                  const label = invite.name?.trim() || invite.email;
                  return (
                    <div
                      key={invite.id ?? invite.email}
                      className="flex h-12 items-center gap-[9px] border-b border-[#eef0f3] px-2 last:border-b-0"
                    >
                      <span
                        className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: avatarColor(label) }}
                      >
                        {initials(label)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[13px] font-bold text-[#172b4d]">{label}</span>
                          <span className="shrink-0 rounded-[3px] bg-[#fff7d6] px-1.5 py-0.5 text-[11px] font-semibold text-[#974f0c]">
                            Chờ tham gia
                          </span>
                        </span>
                        <span className="block truncate text-[12px] text-[#626f86]">
                          {invite.name ? invite.email : "Chưa vào workspace"}
                        </span>
                      </span>
                      <Select
                        value={invite.role}
                        compact
                        onChange={(event) => void changeInviteRole(invite, event.target.value as Role)}
                      >
                        <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                        <option value="LEADER">{ROLE_LABEL.LEADER}</option>
                        <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
                      </Select>
                      <button
                        type="button"
                        aria-label={`Hủy lời mời ${label}`}
                        onClick={() => void removeInvite(invite)}
                        className="grid size-[30px] place-items-center rounded-[4px]"
                      >
                        <img src="/workspace/close.svg" alt="" width={18} height={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          {error ? <p className="text-[13px] text-[#ca3521]">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#dfe1e6] bg-[#f7f8f9] px-[22px] py-[14px]">
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] rounded-[4px] bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#172b4d]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !ready || (isCreate && !createReady)}
            className="h-[34px] rounded-[4px] bg-[#0c66e4] px-3 text-[13px] font-semibold text-white disabled:opacity-55"
          >
            {saving ? "Đang lưu…" : isCreate ? "Tạo Workspace" : "Lưu thay đổi"}
          </button>
        </footer>
      </form>
    </DialogShell>
  );
}

export function DeleteWorkspaceDialog({
  item,
  onClose,
  onDeleted,
}: {
  item: WorkspaceItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const matched = confirmName.trim() === item.name.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!matched) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/workspaces/${item.id}`, { data: { confirmName: confirmName.trim() } });
      onDeleted();
    } catch (reason: unknown) {
      setError(messageOf(reason, "Không xóa được workspace"));
      setSaving(false);
    }
  }

  return (
    <DialogShell onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col">
        <header className="flex min-h-[76px] items-center gap-[11px] border-b border-[#dfe1e6] px-[18px] py-4">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[7px] bg-[#ffedeb]">
            <img src="/workspace/trash.svg" alt="" width={18} height={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-[22.5px] text-[#172b4d]">
              Xóa Workspace {item.name}?
            </span>
            <span className="mt-1 block text-[12px] leading-[18px] text-[#626f86]">
              Hệ thống đã kiểm tra các dữ liệu liên quan trước khi xóa.
            </span>
          </span>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="grid h-[34px] w-[34px] place-items-center rounded-[4px]"
          >
            <img src="/workspace/close.svg" alt="" width={18} height={18} />
          </button>
        </header>

        <div className="flex flex-col gap-3.5 p-[18px]">
          <div className="rounded-[6px] border border-[#dfe1e6] bg-[#f7f8f9] p-[13px]">
            <p className="text-[13px] font-bold text-[#172b4d]">Dữ liệu sẽ bị xóa</p>
            <div className="mt-[11px] grid grid-cols-3 gap-2">
              <Stat icon="/workspace/users.svg" label={`${item.memberCount} thành viên`} />
              <Stat icon="/workspace/list.svg" label="0 Space / List" />
              <Stat icon="/workspace/check.svg" label="0 công việc tham chiếu" />
            </div>
          </div>
          <p className="rounded-[5px] bg-[#ffedeb] p-2.5 text-[13px] leading-[18px] text-[#ca3521]">
            Toàn bộ Space, List, Task, tài liệu đính kèm và lịch sử trao đổi bên trong sẽ bị xóa. Thao tác này không thể hoàn tác.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#44546f]">
              Nhập <span className="font-black text-[#ca3521]">{item.name}</span> để xác nhận
            </span>
            <input
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={item.name}
              className={inputClass}
              autoFocus
            />
          </label>
          {error ? <p className="text-[13px] text-[#ca3521]">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#dfe1e6] bg-[#f7f8f9] px-[22px] py-[14px]">
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] rounded-[4px] bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#172b4d]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !matched}
            className="h-[34px] rounded-[4px] bg-[#ca3521] px-3 text-[13px] font-semibold text-white disabled:opacity-55"
          >
            {saving ? "Đang xóa…" : "Xóa vĩnh viễn"}
          </button>
        </footer>
      </form>
    </DialogShell>
  );
}

function DialogShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#091e42]/50 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[680px] overflow-hidden rounded-[8px] bg-white shadow-[0_8px_28px_rgba(9,30,66,0.25)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#44546f]">
      {label}
      {children}
    </label>
  );
}

function Select({
  compact,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  return (
    <span className={`relative block ${compact ? "w-[140px] shrink-0" : "w-full"}`}>
      <select
        {...props}
        className={`w-full appearance-none rounded-[4px] border border-[#c7cdd6] bg-white pr-7 font-normal text-[#172b4d] outline-none focus:border-[#0c66e4] disabled:bg-[#f7f8f9] ${
          compact ? "h-[30px] px-2.5 text-[13px]" : "h-10 px-[14px] text-[14px]"
        } ${className ?? ""}`}
      >
        {children}
      </select>
      <img
        src="/workspace/chevron.svg"
        alt=""
        width={10}
        height={6}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
      />
    </span>
  );
}

function Stat({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-[5px] text-[12px] text-[#626f86]">
      <img src={icon} alt="" width={14} height={14} />
      {label}
    </span>
  );
}

const inputClass =
  "h-10 w-full rounded-[4px] border border-[#c7cdd6] bg-white px-[10px] text-[14px] font-normal text-[#172b4d] outline-none placeholder:text-[#172b4d]/50 focus:border-[#0c66e4]";
