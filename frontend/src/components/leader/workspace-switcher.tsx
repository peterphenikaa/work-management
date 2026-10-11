"use client";

import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceAvatar } from "@/components/leader/workspace-avatar";
import { type MineWorkspace } from "@/components/leader/workspace-mark";
import { ROLE_LABEL } from "@/lib/roles";

export function WorkspaceSwitcher({
  workspaces,
  currentId,
  anchor,
  onSelect,
  onClose,
}: {
  workspaces: MineWorkspace[];
  currentId: string;
  anchor: HTMLElement | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 80, left: 16 });

  useEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, left: Math.max(12, rect.left) });
  }, [anchor]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, onClose]);

  const items = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("vi");
    if (!text) return workspaces;
    return workspaces.filter((item) => item.name.toLocaleLowerCase("vi").includes(text));
  }, [query, workspaces]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Chuyển workspace"
      style={{ top: position.top, left: position.left }}
      className="fixed z-40 flex max-h-[min(483px,calc(100dvh-96px))] w-[366px] flex-col overflow-hidden rounded-[12px] border border-[#dfe1e6] bg-white shadow-[0_12px_28px_rgba(9,30,66,0.18)]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#dfe1e6] px-4">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-[#626f86] uppercase">
          Chuyển workspace
        </p>
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="grid size-7 place-items-center rounded-md text-[#626f86] hover:bg-[#f1f2f4]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="shrink-0 px-3 pt-3">
        <label className="relative block">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#626f86]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm Workspace..."
            className="h-10 w-full rounded-[6px] border border-[#dfe1e6] pr-3 pl-9 text-[13px] text-[#172b4d] outline-none placeholder:text-[#7a869a] focus:border-[#0c66e4]"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-[#626f86]">Không có workspace khớp.</p>
        ) : (
          items.map((item) => {
            const active = item.id === currentId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left ${
                  active ? "bg-[#e9f2ff]" : "hover:bg-[#f7f8f9]"
                }`}
              >
                <WorkspaceAvatar
                  id={item.id}
                  name={item.name}
                  hasIcon={item.hasIcon}
                  className="size-10 rounded-[8px] text-[13px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#172b4d]">{item.name}</span>
                  <span className="mt-0.5 block text-[12px] text-[#626f86]">{ROLE_LABEL[item.role]}</span>
                </span>
                {active ? <Check size={16} className="shrink-0 text-[#0c66e4]" /> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
