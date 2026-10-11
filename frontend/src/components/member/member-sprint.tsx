"use client";

import { AlertTriangle, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { MemberTaskDialog } from "@/components/member/member-task-dialog";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/components/member/member-dashboard";
import { BUCKET_LABEL, useMemberData, type MemberSprint as Sprint } from "@/components/member/member-data";

const DAY = 86400000;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Trả về số ngày còn lại tới hết Sprint (làm tròn lên); âm nếu đã quá hạn.
function daysLeft(sprint: Sprint) {
  if (!sprint.endAt) return null;
  return Math.ceil((new Date(sprint.endAt).getTime() - Date.now()) / DAY);
}

// M07: Member chỉ xem Sprint đang chạy; không có thao tác tạo, bắt đầu hay đóng Sprint.
export function MemberSprint() {
  const data = useMemberData();
  const [mineOnly, setMineOnly] = useState(false);
  const [openId, setOpenId] = useState("");
  const sprints = useMemo(() => (data?.sprints ?? []).filter((item) => item.status === "ACTIVE"), [data?.sprints]);
  if (!data) return null;

  return (
    <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-[#626f86]">Workspace {data.workspaceName} / Sprint hiện tại</p>
          <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-[#172b4d]">Sprint hiện tại</h1>
          <p className="mt-1 max-w-[640px] text-[13px] text-[#626f86]">Xem Sprint đang chạy, công việc trong Sprint và tiến độ. Bạn không tạo, bắt đầu hay đóng Sprint.</p>
        </div>
        {sprints.length > 0 ? (
          <button
            type="button"
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((value) => !value)}
            className={`h-9 rounded-[6px] border px-3 text-[13px] font-semibold ${mineOnly ? "border-[#0c66e4] bg-[#e9f2ff] text-[#0c66e4]" : "border-[#dfe1e6] bg-white text-[#44546f] hover:bg-[#f7f8f9]"}`}
          >
            Task của tôi
          </button>
        ) : null}
      </div>

      {data.loading ? <p className="py-10 text-center text-[13px] text-[#626f86]">Đang tải Sprint...</p> : null}

      {!data.loading && sprints.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-[#c1c7d0] bg-white px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#e9f2ff] text-[#0c66e4]">
            <CalendarDays size={22} />
          </span>
          <h2 className="mt-4 text-[16px] font-semibold text-[#172b4d]">Chưa có Sprint đang chạy</h2>
          <p className="mt-1 max-w-[420px] text-[13px] text-[#626f86]">Khi Trưởng nhóm bắt đầu một Sprint, tên Sprint, thời gian còn lại, tiến độ và công việc của bạn trong Sprint sẽ hiển thị ở đây.</p>
        </div>
      ) : null}

      {sprints.map((sprint) => {
        const left = daysLeft(sprint);
        const percent = sprint.total === 0 ? 0 : Math.round((sprint.done / sprint.total) * 100);
        const rows = data.tasks.filter((task) => task.sprintId === sprint.id && (!mineOnly || task.assigneeId === data.userId));
        const warning = left !== null && left <= 2;
        return (
          <article key={sprint.id} className="overflow-hidden rounded-xl border border-[#dfe1e6] bg-white">
            <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#eef0f3] px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[18px] font-semibold text-[#172b4d]">{sprint.name}</h2>
                <p className="text-[12px] text-[#626f86]">
                  Space {sprint.spaceName} · {formatDate(sprint.startAt)} – {formatDate(sprint.endAt)}
                </p>
                {sprint.goal ? <p className="mt-1 text-[13px] text-[#44546f]">Mục tiêu: {sprint.goal}</p> : null}
              </div>
              <div className="w-[220px]">
                <div className="flex items-center justify-between text-[12px] text-[#626f86]">
                  <span>Tiến độ</span>
                  <span className="font-semibold text-[#172b4d]">
                    {sprint.done}/{sprint.total} · {percent}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef0f3]">
                  <div className="h-full rounded-full bg-[#22a06b]" style={{ width: `${percent}%` }} />
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${warning ? "bg-[#fff3eb] text-[#a54800]" : "bg-[#f1f2f4] text-[#44546f]"}`}>
                {warning ? <AlertTriangle size={13} /> : null}
                {left === null ? "Chưa đặt hạn" : left < 0 ? `Quá hạn ${Math.abs(left)} ngày` : left === 0 ? "Kết thúc hôm nay" : `Còn ${left} ngày`}
              </span>
            </header>
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="h-9 border-b border-[#eef0f3] bg-[#fafbfc] text-left text-[11px] font-bold tracking-[0.06em] text-[#7a869a] uppercase">
                  <th className="w-[92px] px-5">Mã</th>
                  <th className="px-2">Công việc</th>
                  <th className="w-[140px] px-2">Trạng thái</th>
                  <th className="w-[130px] px-2">Người thực hiện</th>
                  <th className="w-[100px] px-2">Ưu tiên</th>
                  <th className="w-[96px] px-2">Hạn</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[13px] text-[#626f86]">
                      {mineOnly ? "Bạn chưa có công việc nào trong Sprint này." : "Sprint chưa có công việc nào."}
                    </td>
                  </tr>
                ) : (
                  rows.map((task) => (
                    <tr key={task.id} onClick={() => setOpenId(task.id)} className="h-11 cursor-pointer border-b border-[#f1f2f4] text-[13px] text-[#172b4d] last:border-b-0 hover:bg-[#f7f8f9]">
                      <td className="px-5 text-[12px] text-[#626f86]">{task.code}</td>
                      <td className="truncate px-2 font-medium">{task.title}</td>
                      <td className="px-2 text-[12px]">{task.statusName || BUCKET_LABEL[task.bucket]}</td>
                      <td className="truncate px-2 text-[12px]">{task.assigneeName ?? "—"}</td>
                      <td className="px-2">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${PRIORITY_TONE[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>
                      </td>
                      <td className="px-2 text-[12px]">{task.dueAt ? formatDate(task.dueAt) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>
        );
      })}

      {openId ? <MemberTaskDialog taskId={openId} onClose={() => setOpenId("")} /> : null}
    </section>
  );
}
