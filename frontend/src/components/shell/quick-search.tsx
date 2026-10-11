"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLeader } from "@/components/leader/leader-shell";
import TaskDialog, { type TaskDraft } from "@/components/spaces/task-detail";
import { useShellUser } from "@/components/shell/shell-user";
import { api } from "@/lib/api";

type Hit = {
  taskId: string;
  code: string;
  title: string;
  listName: string;
  spaceId: string;
  spaceName: string;
  workspaceId: string;
  workspaceName: string;
};

type SpacePayload = {
  id: string;
  name: string;
  workspaceName: string;
  lists: { id: string; name: string }[];
  statuses: { id: string; name: string }[];
  members: { userId: string; name: string }[];
  tasks: TaskDraft[];
};

export function QuickSearch() {
  const user = useShellUser();
  const leader = useLeader();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<SpacePayload & { workspaceId: string; task: TaskDraft } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .get<{ items: Hit[] }>("/search", { params: { q: needle } })
        .then((response) => {
          if (cancelled) return;
          setHits(response.data.items);
          setOpen(true);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  async function choose(hit: Hit) {
    setOpen(false);
    setQuery("");
    const response = await api.get<SpacePayload>(`/workspaces/${hit.workspaceId}/spaces/${hit.spaceId}`);
    const task = response.data.tasks.find((item) => item.id === hit.taskId);
    if (!task) return;
    setOpened({ ...response.data, workspaceId: hit.workspaceId, task });
  }

  const memberMode = leader?.current?.role === "MEMBER";

  return (
    <>
      <div ref={rootRef} className="relative h-9 w-full">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#172b4d]" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length < 2) setHits([]);
          }}
          onFocus={() => {
            if (hits.length > 0) setOpen(true);
          }}
          placeholder="Tìm theo mã hoặc tên công việc"
          aria-label="Tìm công việc"
          className="h-9 w-full rounded-[6px] border border-[#dfe1e6] bg-[#f7f8f9] pr-3 pl-9 text-[13px] text-[#172b4d] outline-none placeholder:text-[#7a869a] focus:border-[#0c66e4] focus:bg-white"
        />
        {open && query.trim().length >= 2 ? (
          <ul className="absolute top-10 right-0 left-0 z-50 overflow-hidden rounded-lg border border-[#dfe1e6] bg-white py-1 shadow-[0_12px_32px_rgba(9,30,66,0.18)]">
            {hits.length === 0 ? <li className="px-3 py-2 text-[13px] text-[#626f86]">Không có công việc khớp.</li> : null}
            {hits.map((hit) => (
              <li key={hit.taskId}>
                <button type="button" onClick={() => void choose(hit)} className="flex w-full flex-col px-3 py-2 text-left hover:bg-[#f7f8f9]">
                  <span className="truncate text-[13px] font-medium text-[#172b4d]">
                    <span className="mr-2 text-[12px] font-bold text-[#0c66e4]">{hit.code}</span>
                    {hit.title}
                  </span>
                  <span className="truncate text-[11px] text-[#626f86]">
                    {hit.workspaceName} / {hit.spaceName} / {hit.listName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {opened ? (
        <TaskDialog
          workspaceId={opened.workspaceId}
          spaceId={opened.id}
          workspaceName={opened.workspaceName}
          spaceName={opened.name}
          lists={opened.lists}
          statuses={opened.statuses}
          members={opened.members}
          task={opened.task}
          presetListId={opened.task.listId}
          currentUserId={user?.id ?? ""}
          memberMode={memberMode}
          onClose={() => setOpened(null)}
          onSaved={() => setOpened(null)}
        />
      ) : null}
    </>
  );
}
