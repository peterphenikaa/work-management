"use client";

import { Lock, LockOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";
import { useShellUser } from "@/components/shell/app-shell";

type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locked: boolean;
};

const ROLES: Role[] = ["ADMIN", "LEADER", "MEMBER"];
const AVATAR = ["#5e4db2", "#6e5dc6", "#e56910", "#159b91", "#0c66e4", "#ae4787"];
const ROLE_TONE: Record<Role, string> = {
  ADMIN: "bg-[#f3f0ff] text-[#5e4db2]",
  LEADER: "bg-[#e9f2ff] text-[#0c66e4]",
  MEMBER: "bg-[#f4f5f7] text-[#44546f]",
};

export function MembersScreen() {
  const user = useShellUser();
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<{ items: Person[] }>("/workspaces/people")
      .then((peopleResponse) => {
        setPeople(peopleResponse.data.items);
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không tải được thành viên"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    load();
  }, [user?.role]);

  if (user && user.role !== "ADMIN") {
    return <section className="px-8 pt-8 text-[14px] text-[#626f86]">Chỉ quản trị viên xem được màn này.</section>;
  }

  const active = people.filter((person) => !person.locked).length;
  const locked = people.length - active;

  async function changeRole(person: Person, role: Role) {
    setError("");
    const previous = people;
    setPeople((current) => current.map((row) => (row.id === person.id ? { ...row, role } : row)));
    try {
      await api.patch(`/workspaces/people/${person.id}`, { role });
    } catch (reason: unknown) {
      setPeople(previous);
      setError(reason instanceof Error ? reason.message : "Không đổi được vai trò");
    }
  }

  async function toggleLock(person: Person) {
    setError("");
    const next = !person.locked;
    const previous = people;
    setPeople((current) => current.map((row) => (row.id === person.id ? { ...row, locked: next } : row)));
    try {
      await api.patch(`/workspaces/people/${person.id}`, { locked: next });
    } catch (reason: unknown) {
      setPeople(previous);
      setError(reason instanceof Error ? reason.message : "Không đổi được trạng thái");
    }
  }

  async function remove(person: Person) {
    setError("");
    try {
      await api.delete(`/workspaces/people/${person.id}`);
      setPeople((current) => current.filter((row) => row.id !== person.id));
      setPendingDelete(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không xóa được thành viên");
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

      <header className="mt-3 flex items-start justify-between gap-4">
        <span>
          <h1 className="text-[24px] font-semibold leading-8 text-[#172b4d]">Thành viên & Phân quyền</h1>
          <p className="mt-1 text-[14px] text-[#626f86]">
            Quản lý tài khoản toàn hệ thống. Mời người vào từng workspace hoặc space là việc của chủ không gian đó.
          </p>
        </span>
      </header>

      {error ? <p className="mt-3 text-[13px] text-[#ae2e24]">{error}</p> : null}
      {loading ? <p className="mt-6 text-[13px] text-[#626f86]">Đang tải thành viên…</p> : null}

      {!loading ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-[#dfe1e6]">
          <div className="flex flex-wrap items-center gap-4 border-b border-[#eef0f3] px-5 py-3 text-[13px] text-[#44546f]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#626f86]" />
              {people.length} thành viên
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#22a06b]" />
              {active} đang hoạt động
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#e2483d]" />
              {locked} đã khóa
            </span>
          </div>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[11px] font-bold tracking-wide text-[#7a869a]">
                <th className="px-5 py-3 font-bold">THÀNH VIÊN</th>
                <th className="px-3 py-3 font-bold">EMAIL</th>
                <th className="w-[170px] px-3 py-3 font-bold">VAI TRÒ</th>
                <th className="w-[160px] px-3 py-3 font-bold">TRẠNG THÁI</th>
                <th className="w-[110px] px-3 py-3 text-right font-bold">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {people.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-[#626f86]">
                    Chưa có thành viên.
                  </td>
                </tr>
              ) : (
                people.map((person) => {
                  const self = person.id === user?.id;
                  return (
                    <tr key={person.id} className="border-t border-[#eef0f3]">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={person.name} />
                          <span className="text-[14px] font-semibold text-[#172b4d]">{person.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-[#44546f]">{person.email}</td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`Vai trò của ${person.name}`}
                          value={person.role}
                          disabled={self}
                          onChange={(event) => void changeRole(person, event.target.value as Role)}
                          className={`h-7 rounded-full px-2.5 text-[12px] font-semibold outline-none disabled:opacity-70 ${ROLE_TONE[person.role]}`}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                            person.locked ? "bg-[#ffeceb] text-[#ae2e24]" : "bg-[#dcfff1] text-[#216e4e]"
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${person.locked ? "bg-[#e2483d]" : "bg-[#22a06b]"}`} />
                          {person.locked ? "Đã khóa" : "Đang hoạt động"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={person.locked ? `Mở khóa ${person.name}` : `Khóa ${person.name}`}
                            disabled={self}
                            onClick={() => void toggleLock(person)}
                            className="grid size-8 place-items-center rounded text-[#626f86] hover:bg-[#f7f8f9] disabled:opacity-40"
                          >
                            {person.locked ? <LockOpen size={15} /> : <Lock size={15} />}
                          </button>
                          <span className="relative">
                            <button
                              type="button"
                              aria-label={`Xóa ${person.name}`}
                              disabled={self}
                              onClick={() => setPendingDelete(person.id)}
                              className="grid size-8 place-items-center rounded text-[#e2483d] hover:bg-[#ffeceb] disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                            {pendingDelete === person.id ? (
                              <span className="absolute top-9 right-0 z-10 w-56 rounded-md border border-[#dfe1e6] bg-white p-3 shadow-[0_8px_24px_rgba(9,30,66,0.16)]">
                                <span className="block text-[13px] font-semibold text-[#172b4d]">Xóa {person.name}?</span>
                                <span className="mt-2 flex justify-end gap-2">
                                  <button type="button" onClick={() => setPendingDelete(null)} className="h-8 rounded px-2 text-[12px] font-semibold text-[#44546f]">
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void remove(person)}
                                    className="h-8 rounded bg-[#e2483d] px-2 text-[12px] font-semibold text-white"
                                  >
                                    Xóa
                                  </button>
                                </span>
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="m-4 rounded-lg bg-[#e9f2ff] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#0c66e4]">Phân quyền theo vai trò</p>
            <p className="mt-1 text-[13px] leading-5 text-[#44546f]">
              Quản trị viên quản lý toàn bộ không gian. Trưởng nhóm quản lý Sprint và thành viên trong không gian. Thành viên có thể xem và cập nhật công việc được giao.
            </p>
          </div>
        </div>
      ) : null}
    </section>
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
