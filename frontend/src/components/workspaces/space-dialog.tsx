"use client";

import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Check,
  ChevronDown,
  Folder,
  GripVertical,
  Plus,
  Rocket,
  Search,
  Star,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, type Role } from "@/lib/api";
import { initials } from "@/lib/roles";

export type SpaceIcon = "ARCHIVE" | "BOARD" | "SPARK" | "REPORTS" | "MEMBERS";
export type SpaceColor = "BLUE" | "PURPLE" | "TEAL" | "ORANGE";
export type SpaceView = "KANBAN" | "LIST" | "CALENDAR" | "AGILE";

export type SpaceItem = {
  id: string;
  name: string;
  icon: SpaceIcon;
  color: SpaceColor;
};

const ICONS: { id: SpaceIcon; icon: LucideIcon; label: string }[] = [
  { id: "ARCHIVE", icon: Folder, label: "Thư mục" },
  { id: "SPARK", icon: Star, label: "Ngôi sao" },
  { id: "BOARD", icon: Briefcase, label: "Cặp tài liệu" },
  { id: "REPORTS", icon: Rocket, label: "Tên lửa" },
  { id: "MEMBERS", icon: Users, label: "Thành viên" },
];

const COLORS: { id: SpaceColor; value: string; label: string }[] = [
  { id: "BLUE", value: "#0C66E4", label: "Xanh dương" },
  { id: "PURPLE", value: "#6E5DC6", label: "Tím" },
  { id: "TEAL", value: "#159B91", label: "Xanh lục" },
  { id: "ORANGE", value: "#E56910", label: "Cam" },
];

const VIEWS: { id: SpaceView; src: string; title: string; detail: string }[] = [
  { id: "LIST", src: "/space/list.svg", title: "Bảng", detail: "Danh sách công việc chi tiết" },
  { id: "KANBAN", src: "/space/kanban.svg", title: "Bảng Kanban", detail: "Quản lý theo cột trạng thái" },
  { id: "CALENDAR", src: "/space/calendar.svg", title: "Lịch", detail: "Theo dõi deadline và sự kiện" },
  { id: "AGILE", src: "/space/sprint.svg", title: "Biểu đồ Gantt", detail: "Lập kế hoạch dòng thời gian" },
];

const ACCESS = [
  {
    id: "PUBLIC" as const,
    title: "Mở",
    detail: "Tất cả thành viên trong workspace đều có thể xem và tham gia.",
  },
  {
    id: "PRIVATE" as const,
    title: "Riêng tư",
    detail: "Chỉ những thành viên được mời mới có thể truy cập.",
  },
  {
    id: "TEAM" as const,
    title: "Theo nhóm",
    detail: "Kế thừa quyền từ các nhóm (Teams) được chỉ định.",
  },
];

const CATEGORIES = [
  { id: "TODO" as const, label: "Chưa bắt đầu" },
  { id: "DOING" as const, label: "Đang thực hiện" },
  { id: "DONE" as const, label: "Hoàn thành" },
];

const SEATS = [
  { id: "ADMIN" as const, label: "Quản trị viên" },
  { id: "MEMBER" as const, label: "Thành viên" },
  { id: "GUEST" as const, label: "Khách" },
];

const DOTS = ["#626F86", "#0C66E4", "#6E5DC6", "#22A06B", "#E56910", "#AE2E24"];
const AVATAR = ["#0C66E4", "#22A06B", "#6E5DC6", "#E56910", "#AE4787", "#159B91"];

type AccessMode = (typeof ACCESS)[number]["id"];
type Category = (typeof CATEGORIES)[number]["id"];
type Seat = (typeof SEATS)[number]["id"];

type Person = {
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

function matchesQuery(name: string, email: string, needle: string) {
  if (!needle) return true;
  return (
    name.trim().toLocaleLowerCase("vi").includes(needle) ||
    email.trim().toLocaleLowerCase("vi").includes(needle)
  );
}

type StatusDraft = {
  key: string;
  name: string;
  category: Category;
  color: string;
};

const FIELD =
  "h-10 w-full rounded-md border border-[#dfe1e6] bg-white px-3 text-[14px] text-[#172b4d] outline-none placeholder:text-[#a5adba] focus:border-[#0c66e4]";

export function spaceSwatch(color: SpaceColor) {
  return COLORS.find((item) => item.id === color)?.value ?? "#0C66E4";
}

export function spaceIcon(icon: SpaceIcon) {
  const file: Record<SpaceIcon, string> = {
    ARCHIVE: "/space/archive.svg",
    BOARD: "/space/board.svg",
    SPARK: "/space/spark.svg",
    REPORTS: "/space/reports.svg",
    MEMBERS: "/space/members.svg",
  };
  return file[icon];
}

function seatFor(role: Role): Seat {
  if (role === "ADMIN") return "ADMIN";
  return "MEMBER";
}

export function CreateSpaceDialog({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<SpaceIcon>("ARCHIVE");
  const [color, setColor] = useState<SpaceColor>("BLUE");
  const [access, setAccess] = useState<AccessMode>("PUBLIC");
  const [picked, setPicked] = useState<string[]>([]);
  const [seats, setSeats] = useState<Record<string, Seat>>({});
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<StatusDraft[]>([
    { key: "todo", name: "Cần làm", category: "TODO", color: DOTS[0] },
    { key: "doing", name: "Đang làm", category: "DOING", color: DOTS[1] },
    { key: "review", name: "Review", category: "DOING", color: DOTS[2] },
    { key: "done", name: "Hoàn thành", category: "DONE", color: DOTS[3] },
  ]);
  const [views, setViews] = useState<SpaceView[]>(["LIST", "KANBAN"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ items: Person[] }>(`/workspaces/${workspaceId}/members`),
      api.get<{ items: Invite[] }>(`/workspaces/${workspaceId}/invitations`).catch(() => ({ data: { items: [] as Invite[] } })),
    ])
      .then(([members, invitations]) => {
        if (cancelled) return;
        const items = members.data.items;
        setPeople(items);
        setInvites(invitations.data.items);
        setPicked(items.map((person) => person.userId));
        setSeats(Object.fromEntries(items.map((person) => [person.userId, seatFor(person.role)])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const swatch = spaceSwatch(color);
  const Icon = ICONS.find((item) => item.id === icon)?.icon ?? Folder;
  const accessLabel = ACCESS.find((item) => item.id === access)?.title ?? "Mở";
  const badgeDot = access === "PUBLIC" ? "#22A06B" : access === "TEAM" ? "#6E5DC6" : "#626F86";
  const needle = query.trim().toLocaleLowerCase("vi");
  const visible = people.filter(
    (person) => matchesQuery(person.name, person.email, needle) && (needle.length > 0 || picked.includes(person.userId)),
  );
  const inviteHits = needle ? invites.filter((invite) => matchesQuery(invite.name ?? "", invite.email, needle)) : [];
  const eligible = picked.some((id) => {
    const person = people.find((row) => row.userId === id);
    return person?.role === "LEADER" || person?.role === "MEMBER";
  });
  const ready = name.trim().length > 0 && statuses.length > 0 && views.length > 0 && (access === "PUBLIC" || eligible);

  function addStatus() {
    if (statuses.length >= 12) {
      setError("Tối đa 12 trạng thái");
      return;
    }
    const taken = new Set(statuses.map((item) => item.name.toLocaleLowerCase("vi")));
    let next = "Trạng thái mới";
    let index = 2;
    while (taken.has(next.toLocaleLowerCase("vi"))) next = `Trạng thái mới ${index++}`;
    setError("");
    setStatuses((current) => [
      ...current,
      { key: crypto.randomUUID(), name: next, category: "TODO", color: DOTS[current.length % DOTS.length] },
    ]);
  }

  function moveStatus(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setStatuses((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (!item) return current;
      next.splice(to, 0, item);
      return next;
    });
  }

  async function submit() {
    if (!ready || saving) return;
    const names = statuses.map((item) => item.name.trim()).filter(Boolean);
    if (names.length !== statuses.length) {
      setError("Tên trạng thái không được để trống");
      return;
    }
    if (names.some((item) => item.length > 40)) {
      setError("Tên trạng thái tối đa 40 ký tự");
      return;
    }
    if (new Set(names.map((item) => item.toLocaleLowerCase("vi"))).size !== names.length) {
      setError("Trạng thái bị trùng tên");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/workspaces/${workspaceId}/spaces`, {
        name: name.trim(),
        description: description.trim(),
        icon,
        color,
        accessType: access === "PUBLIC" ? "PUBLIC" : "PRIVATE",
        memberIds: picked,
        statuses: names,
        views,
      });
      onCreated();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không tạo được Space");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/50 p-4 sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-labelledby="create-space-title"
        className="flex max-h-[min(900px,calc(100vh-32px))] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_rgba(9,30,66,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="relative shrink-0 px-6 pt-5 pb-3">
          <h2 id="create-space-title" className="pr-10 text-[20px] font-semibold leading-7 text-[#172b4d]">
            Tạo Space
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-[#626f86]">
            Thiết lập không gian làm việc mới với các tính năng và quy trình tùy chỉnh.
          </p>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="absolute top-4 right-4 grid size-8 place-items-center rounded-md text-[#44546f] hover:bg-[#f1f2f4]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4">
          <section className="rounded-lg bg-[#f7f8f9] p-4">
            <h3 className="text-[14px] font-semibold text-[#172b4d]">Thông tin cơ bản</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[#44546f]">Tên Space</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  placeholder="Ví dụ: Phòng Kỹ thuật, Marketing Q3..."
                  className={FIELD}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[#44546f]">Mô tả ngắn</span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  placeholder="Mô tả mục đích của Space này..."
                  className={FIELD}
                />
              </label>
            </div>

            <div className="mt-3 flex h-16 items-center gap-3 rounded-lg border border-[#dfe1e6] bg-white px-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md text-white" style={{ backgroundColor: swatch }}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-[#172b4d]">{name.trim() || "Tên Space"}</span>
                <span className="block truncate text-[12px] text-[#626f86]">{description.trim() || "Chưa có mô tả"}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#dfe1e6] bg-[#f7f8f9] px-2.5 py-1 text-[12px] font-medium text-[#172b4d]">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: badgeDot }} />
                {accessLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-medium text-[#44546f]">Chọn biểu tượng</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ICONS.map((item) => {
                    const selected = icon === item.id;
                    const Glyph = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={item.label}
                        aria-pressed={selected}
                        onClick={() => setIcon(item.id)}
                        className={`grid size-8 place-items-center rounded-full border bg-white ${
                          selected ? "border-[#0c66e4] text-[#0c66e4] ring-2 ring-[#0c66e4]/20" : "border-[#dfe1e6] text-[#44546f]"
                        }`}
                      >
                        <Glyph size={15} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#44546f]">Màu nhận diện</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLORS.map((item) => {
                    const selected = color === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={item.label}
                        aria-pressed={selected}
                        onClick={() => setColor(item.id)}
                        className="size-7 rounded-full"
                        style={{
                          backgroundColor: item.value,
                          boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${item.value}` : "0 0 0 1px rgba(9,30,66,0.08)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-[#f7f8f9] p-4">
            <h3 className="text-[14px] font-semibold text-[#172b4d]">Quyền truy cập & Thành viên</h3>
            <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3 pt-1">
                {ACCESS.map((item) => {
                  const selected = access === item.id;
                  return (
                    <button key={item.id} type="button" onClick={() => setAccess(item.id)} className="flex items-start gap-2.5 text-left">
                      <span
                        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border bg-white ${
                          selected ? "border-[#0c66e4]" : "border-[#b3b9c4]"
                        }`}
                      >
                        {selected ? <span className="size-2 rounded-full bg-[#0c66e4]" /> : null}
                      </span>
                      <span>
                        <span className="block text-[13px] font-semibold text-[#172b4d]">{item.title}</span>
                        <span className="mt-0.5 block text-[12px] leading-[18px] text-[#626f86]">{item.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <p className="text-[13px] font-semibold text-[#172b4d]">Thành viên khởi tạo</p>
                <div className="relative mt-2">
                  <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#626f86]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm kiếm thành viên..."
                    className="h-9 w-full rounded-md border border-[#dfe1e6] bg-white pr-3 pl-8 text-[13px] text-[#172b4d] outline-none placeholder:text-[#a5adba] focus:border-[#0c66e4]"
                  />
                </div>
                <div className="mt-2 flex max-h-[196px] flex-col gap-1.5 overflow-y-auto">
                  {visible.length === 0 && inviteHits.length === 0 ? (
                    <p className="rounded-md border border-[#dfe1e6] bg-white px-3 py-3 text-[13px] text-[#626f86]">
                      {needle
                        ? "Không tìm thấy thành viên."
                        : people.length === 0
                          ? "Workspace chưa có thành viên hoạt động."
                          : "Chưa chọn thành viên. Tìm theo tên hoặc email để thêm lại."}
                    </p>
                  ) : (
                    <>
                      {visible.map((person) => {
                        const selected = picked.includes(person.userId);
                        return (
                          <div key={person.userId} className="flex items-center gap-2 rounded-md border border-[#dfe1e6] bg-white px-2 py-1.5">
                            <Avatar name={person.name} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-[#172b4d]">{person.name}</span>
                              <span className="block truncate text-[12px] text-[#626f86]">{person.email}</span>
                            </span>
                            <span className="relative shrink-0">
                              <select
                                aria-label={`Vai trò của ${person.name}`}
                                value={seats[person.userId] ?? "MEMBER"}
                                onChange={(event) =>
                                  setSeats((current) => ({ ...current, [person.userId]: event.target.value as Seat }))
                                }
                                className="h-8 appearance-none rounded-md border border-[#dfe1e6] bg-white pr-7 pl-2 text-[12px] text-[#172b4d] outline-none"
                              >
                                {SEATS.map((seat) => (
                                  <option key={seat.id} value={seat.id}>
                                    {seat.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[#626f86]" />
                            </span>
                            {selected ? (
                              <button
                                type="button"
                                aria-label={`Gỡ ${person.name}`}
                                onClick={() => setPicked((current) => current.filter((id) => id !== person.userId))}
                                className="grid size-7 shrink-0 place-items-center rounded-md text-[#626f86] hover:bg-[#f1f2f4] hover:text-[#ae2e24]"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Thêm ${person.name}`}
                                onClick={() => setPicked((current) => [...current, person.userId])}
                                className="grid size-7 shrink-0 place-items-center rounded-md text-[#0c66e4] hover:bg-[#e9f2ff]"
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {inviteHits.map((invite) => {
                        const label = invite.name?.trim() || invite.email;
                        return (
                          <div key={invite.id} className="flex items-center gap-2 rounded-md border border-[#dfe1e6] bg-white px-2 py-1.5">
                            <Avatar name={label} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-[#172b4d]">{label}</span>
                              <span className="block truncate text-[12px] text-[#626f86]">
                                {invite.name?.trim() ? invite.email : "Chờ tham gia"}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-[#fff7d6] px-2 py-1 text-[11px] font-medium text-[#7f5f01]">
                              Chờ tham gia
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-[#626f86]">
              Quản trị viên có toàn quyền cấu hình. Thành viên có thể tạo task. Khách chỉ có quyền xem.
            </p>
          </section>

          <section className="rounded-lg bg-[#f7f8f9] p-4">
            <h3 className="text-[14px] font-semibold text-[#172b4d]">Quy trình trạng thái công việc</h3>
            <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div>
                <div className="flex flex-col gap-1.5">
                  {statuses.map((status, index) => (
                    <div
                      key={status.key}
                      draggable
                      onDragStart={() => {
                        dragIndex.current = index;
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragIndex.current === null) return;
                        moveStatus(dragIndex.current, index);
                        dragIndex.current = null;
                      }}
                      className="flex items-center gap-2 rounded-md border border-[#dfe1e6] bg-white px-2 py-1.5"
                    >
                      <span className="grid size-6 shrink-0 cursor-grab place-items-center text-[#a5adba]" aria-hidden>
                        <GripVertical size={14} />
                      </span>
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                      <input
                        value={status.name}
                        maxLength={40}
                        aria-label={`Tên trạng thái ${index + 1}`}
                        onChange={(event) =>
                          setStatuses((current) =>
                            current.map((item) => (item.key === status.key ? { ...item, name: event.target.value } : item)),
                          )
                        }
                        className="h-8 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#172b4d] outline-none"
                      />
                      <span className="relative shrink-0">
                        <select
                          aria-label={`Nhóm của ${status.name}`}
                          value={status.category}
                          onChange={(event) =>
                            setStatuses((current) =>
                              current.map((item) =>
                                item.key === status.key ? { ...item, category: event.target.value as Category } : item,
                              ),
                            )
                          }
                          className="h-8 max-w-[148px] appearance-none rounded-md border border-[#dfe1e6] bg-white pr-7 pl-2 text-[12px] text-[#172b4d] outline-none"
                        >
                          {CATEGORIES.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[#626f86]" />
                      </span>
                      <button
                        type="button"
                        aria-label={`Xóa ${status.name}`}
                        disabled={statuses.length === 1}
                        onClick={() => setStatuses((current) => current.filter((item) => item.key !== status.key))}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-[#626f86] hover:bg-[#f1f2f4] hover:text-[#ae2e24] disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addStatus}
                  className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[#dfe1e6] bg-white text-[13px] font-medium text-[#172b4d] hover:bg-[#fafbfc]"
                >
                  <Plus size={14} />
                  Thêm trạng thái
                </button>
              </div>

              <div className="rounded-lg border border-[#dfe1e6] bg-white p-3">
                <p className="text-[13px] font-semibold text-[#172b4d]">Xem trước luồng</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {statuses.map((status, index) => (
                    <span key={status.key} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
                        style={{ backgroundColor: `${status.color}1A`, color: status.color }}
                      >
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                        {status.name.trim() || "Chưa đặt tên"}
                      </span>
                      {index < statuses.length - 1 ? <span className="text-[12px] text-[#a5adba]">→</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-[#f7f8f9] p-4">
            <h3 className="text-[14px] font-semibold text-[#172b4d]">Các chế độ xem tính năng</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {VIEWS.map((view) => {
                const checked = views.includes(view.id);
                return (
                  <button
                    key={view.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() =>
                      setViews((current) => (checked ? current.filter((id) => id !== view.id) : [...current, view.id]))
                    }
                    className={`relative flex min-h-[108px] flex-col rounded-lg border bg-white p-3 text-left ${
                      checked ? "border-[#0c66e4] shadow-[0_0_0_1px_#0c66e4]" : "border-[#dfe1e6]"
                    }`}
                  >
                    <span
                      className={`absolute top-2.5 right-2.5 grid size-4 place-items-center rounded-[3px] border ${
                        checked ? "border-[#0c66e4] bg-[#0c66e4] text-white" : "border-[#c1c7d0] bg-white"
                      }`}
                    >
                      {checked ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="grid size-8 place-items-center rounded-md bg-[#e9f2ff]">
                      <img src={view.src} alt="" width={16} height={16} />
                    </span>
                    <span className="mt-2 pr-5 text-[13px] font-semibold text-[#172b4d]">{view.title}</span>
                    <span className="mt-0.5 text-[12px] leading-[18px] text-[#626f86]">{view.detail}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {error ? <p className="text-[13px] text-[#ae2e24]">{error}</p> : null}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f1f2f4] px-6 py-3.5">
          <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-[14px] font-medium text-[#44546f] hover:bg-[#f7f8f9]">
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={!ready || saving}
            onClick={() => void submit()}
            className="h-9 rounded-md bg-[#0c66e4] px-4 text-[14px] font-semibold text-white hover:bg-[#0055cc] disabled:opacity-50"
          >
            {saving ? "Đang tạo…" : "Tạo Space"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: AVATAR[hash % AVATAR.length] }}
    >
      {initials(name)}
    </span>
  );
}
