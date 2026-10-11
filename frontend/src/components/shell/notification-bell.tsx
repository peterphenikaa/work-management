"use client";

import { AtSign, Bell, BellRing, CalendarClock, CheckCircle2, MessageSquare, Send, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Item = {
  id: string;
  type: "ASSIGNED" | "MENTION" | "COMMENT" | "STATUS" | "REVIEW" | "DEADLINE";
  title: string;
  body: string | null;
  workspaceName: string;
  read: boolean;
  createdAt: string;
};

const META = {
  ASSIGNED: { icon: UserPlus, tint: "#e9f2ff", color: "#0c66e4" },
  MENTION: { icon: AtSign, tint: "#f3f0ff", color: "#6e5dc6" },
  COMMENT: { icon: MessageSquare, tint: "#f1f2f4", color: "#44546f" },
  STATUS: { icon: CheckCircle2, tint: "#dcfff1", color: "#1f845a" },
  REVIEW: { icon: Send, tint: "#f8eee7", color: "#a54800" },
  DEADLINE: { icon: CalendarClock, tint: "#ffeceb", color: "#ae2e24" },
} as const;

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  function load() {
    api
      .get<{ items: Item[]; unread: number }>("/notifications")
      .then((response) => {
        setItems(response.data.items);
        setUnread(response.data.unread);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  function markRead(item: Item) {
    if (item.read) return;
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    setUnread((count) => Math.max(0, count - 1));
    void api.post(`/notifications/${item.id}/read`).catch(() => undefined);
  }

  function markAll() {
    setItems((current) => current.map((row) => ({ ...row, read: true })));
    setUnread(0);
    void api.post("/notifications/read-all").catch(() => undefined);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        onClick={() => {
          setOpen((value) => !value);
          load();
        }}
        className="relative grid size-8 place-items-center text-[#626f86] hover:text-[#172b4d]"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ca3521] px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute top-10 right-0 z-50 w-[360px] overflow-hidden rounded-xl border border-[#dfe1e6] bg-white shadow-[0_12px_32px_rgba(9,30,66,0.18)]">
          <div className="flex items-center justify-between border-b border-[#eef0f3] px-3 py-2.5">
            <p className="text-[13px] font-semibold text-[#172b4d]">Thông báo</p>
            <button type="button" disabled={unread === 0} onClick={markAll} className="text-[12px] font-semibold text-[#0c66e4] disabled:opacity-40">
              Đánh dấu đã đọc
            </button>
          </div>
          {items.length === 0 ? (
            <div className="grid place-items-center px-4 py-10 text-center">
              <BellRing size={18} className="text-[#7a869a]" />
              <p className="mt-2 text-[13px] text-[#626f86]">Chưa có thông báo</p>
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {items.map((item) => {
                const meta = META[item.type] ?? META.STATUS;
                const Icon = meta.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => markRead(item)}
                      className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[#f7f8f9] ${item.read ? "" : "bg-[#f5f9ff]"}`}
                    >
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full" style={{ backgroundColor: meta.tint, color: meta.color }}>
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] text-[#172b4d] ${item.read ? "font-medium" : "font-semibold"}`}>{item.title}</span>
                        {item.body ? <span className="mt-0.5 block truncate text-[12px] text-[#626f86]">{item.body}</span> : null}
                        <span className="mt-0.5 block text-[11px] text-[#7a869a]">
                          {item.workspaceName ? `${item.workspaceName} · ` : ""}
                          {relative(item.createdAt)}
                        </span>
                      </span>
                      {item.read ? null : <span aria-label="Chưa đọc" className="mt-1.5 size-2 shrink-0 rounded-full bg-[#0c66e4]" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
