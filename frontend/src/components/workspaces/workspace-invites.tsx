"use client";

import { useEffect, useState } from "react";
import { api, type Role } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/roles";

type PendingInvite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
  expiresAt: string;
};

export function WorkspaceInvites({ inset = false }: { inset?: boolean }) {
  const [items, setItems] = useState<PendingInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: PendingInvite[] }>("/workspaces/invitations/mine")
      .then((response) => {
        if (!cancelled) setItems(response.data.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  async function accept(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api.post(`/workspaces/invitations/${id}/accept`);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không tham gia được workspace");
      setBusyId(null);
    }
  }

  return (
    <div className={inset ? "px-8 pt-8" : "mt-6"}>
      <p className="text-[13px] font-semibold text-[#172b4d]">Lời mời workspace</p>
      <div className="mt-2 overflow-hidden rounded-[8px] border border-[#dfe1e6]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-[#eef0f3] px-3 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-[#172b4d]">
                {item.workspaceName}
              </span>
              <span className="mt-0.5 block text-[12px] text-[#626f86]">
                Vai trò {ROLE_LABEL[item.role]} · chờ bạn tham gia
              </span>
            </span>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => void accept(item.id)}
              className="h-[34px] shrink-0 rounded-[4px] bg-[#0c66e4] px-3 text-[13px] font-semibold text-white disabled:opacity-55"
            >
              {busyId === item.id ? "Đang tham gia…" : "Tham gia"}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="mt-2 text-[13px] text-[#ca3521]">{error}</p> : null}
    </div>
  );
}
