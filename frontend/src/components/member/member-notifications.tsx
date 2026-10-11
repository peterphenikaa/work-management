"use client";

import { AtSign, BellRing, CalendarClock, CheckCircle2, MessageSquare, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { MemberTaskDialog } from "@/components/member/member-task-dialog";
import { useMemberData, type MemberNotification } from "@/components/member/member-data";

const KIND_META: Record<MemberNotification["type"], { icon: typeof BellRing; tint: string; color: string }> = {
  ASSIGNED: { icon: UserPlus, tint: "#e9f2ff", color: "#0c66e4" },
  MENTION: { icon: AtSign, tint: "#f3f0ff", color: "#6e5dc6" },
  COMMENT: { icon: MessageSquare, tint: "#f1f2f4", color: "#44546f" },
  STATUS: { icon: CheckCircle2, tint: "#dcfff1", color: "#1f845a" },
  REVIEW: { icon: Send, tint: "#f8eee7", color: "#a54800" },
  DEADLINE: { icon: CalendarClock, tint: "#ffeceb", color: "#ae2e24" },
};

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

// M08: Trung tâm thông báo của Member. Thông báo chỉ gồm công việc Member có quyền xem.
export function MemberNotifications() {
  const data = useMemberData();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [openId, setOpenId] = useState("");
  const [notice, setNotice] = useState("");
  if (!data) return null;

  const items = filter === "unread" ? data.notifications.filter((item) => !item.read) : data.notifications;

  function open(item: MemberNotification) {
    if (!data) return;
    data.markRead(item.id);
    // Kiểm tra lại quyền: task phải còn nằm trong dữ liệu Member được xem.
    if (!item.taskId || !data.tasks.some((task) => task.id === item.taskId)) {
      setNotice("Bạn không còn quyền truy cập công việc này hoặc công việc đã bị xóa.");
      return;
    }
    setNotice("");
    setOpenId(item.taskId);
  }

  return (
    <section className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-[#626f86]">Workspace {data.workspaceName} / Thông báo</p>
          <h1 className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-[#172b4d]">Thông báo</h1>
          <p className="mt-1 text-[13px] text-[#626f86]">Giao việc, nhắc đến bạn, bình luận, trạng thái và hạn chót.</p>
        </div>
        <button
          type="button"
          disabled={data.unread === 0}
          onClick={data.markAllRead}
          className="h-9 rounded-[6px] border border-[#dfe1e6] bg-white px-3 text-[13px] font-semibold text-[#172b4d] hover:bg-[#f7f8f9] disabled:opacity-50"
        >
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-[#dfe1e6]">
        {(["all", "unread"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`-mb-px h-9 border-b-2 px-3 text-[13px] font-semibold ${filter === id ? "border-[#0c66e4] text-[#0c66e4]" : "border-transparent text-[#626f86] hover:text-[#172b4d]"}`}
          >
            {id === "all" ? `Tất cả (${data.notifications.length})` : `Chưa đọc (${data.unread})`}
          </button>
        ))}
      </div>

      {notice ? <p className="rounded-md bg-[#ffeceb] px-3 py-2 text-[12px] text-[#ae2e24]">{notice}</p> : null}

      {data.loading ? (
        <p className="py-10 text-center text-[13px] text-[#626f86]">Đang tải thông báo...</p>
      ) : items.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-[#c1c7d0] bg-white px-6 py-14 text-center">
          <BellRing size={22} className="text-[#7a869a]" />
          <p className="mt-3 text-[14px] font-semibold text-[#172b4d]">{filter === "unread" ? "Bạn đã đọc hết thông báo" : "Chưa có thông báo"}</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-[#dfe1e6] bg-white">
          {items.map((item) => {
            const meta = KIND_META[item.type];
            const Icon = meta.icon;
            return (
              <li key={item.id} className="border-b border-[#eef0f3] last:border-b-0">
                <button
                  type="button"
                  onClick={() => open(item)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#f7f8f9] ${item.read ? "" : "bg-[#f5f9ff]"}`}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: meta.tint, color: meta.color }}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] text-[#172b4d] ${item.read ? "font-medium" : "font-semibold"}`}>{item.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-[#626f86]">{item.body}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[#7a869a]">{relative(item.createdAt)}</span>
                  {item.read ? null : <span aria-label="Chưa đọc" className="mt-1.5 size-2 shrink-0 rounded-full bg-[#0c66e4]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openId ? <MemberTaskDialog taskId={openId} onClose={() => setOpenId("")} /> : null}
    </section>
  );
}
