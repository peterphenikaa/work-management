"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { initials } from "@/lib/roles";
import { useShellUser } from "@/components/shell/app-shell";
import {
  CreateWorkspaceDialog,
  DeleteWorkspaceDialog,
  EditWorkspaceDialog,
  type WorkspaceItem,
} from "@/components/workspaces/workspace-dialogs";

type WorkspaceList = {
  items: WorkspaceItem[];
  page: number;
  pageSize: number;
  total: number;
};

const PAGE_SIZE = 10;

function formatCreated(iso: string) {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  return `${day} thg ${date.getMonth() + 1}, ${date.getFullYear()}`;
}

function pageWindow(page: number, pages: number) {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function WorkspaceScreen() {
  const user = useShellUser();
  const [page, setPage] = useState(1);
  const [list, setList] = useState<WorkspaceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<WorkspaceItem | null>(null);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<WorkspaceList>("/workspaces", { params: { page, pageSize: PAGE_SIZE } })
      .then((response) => {
        if (!cancelled) setList(response.data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được workspace");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, page, reloadKey]);

  if (!isAdmin) {
    return (
      <section className="px-8 pt-8 text-[14px] text-[#626f86]">
        Chỉ quản trị viên xem được danh sách workspace.
      </section>
    );
  }

  const total = list?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const footer =
    total === 0 ? "Hiển thị 0 workspace" : `Hiển thị ${from}–${to} trên ${total} workspace`;

  function refresh(nextPage = page) {
    setPage(nextPage);
    setReloadKey((value) => value + 1);
    setDialog(null);
    setSelected(null);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col px-8 pt-8 pb-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[13px] text-[#626f86]">
            Quản trị <span className="px-1 text-[#c7cdd6]">/</span> Workspaces
          </p>
          <h1 className="mt-2 text-[24px] leading-8 font-semibold text-[#172b4d]">Quản lý Workspace</h1>
          <p className="mt-1 text-[13px] text-[#626f86]">
            Tạo, sửa, xóa và kiểm tra cấu trúc các không gian làm việc của tổ chức.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog("create")}
          className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-[4px] bg-[#0c66e4] px-3 text-[13px] font-semibold text-white hover:bg-[#0052cc]"
        >
          <Plus size={15} />
          Tạo Workspace
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-[8px] border border-[#dfe1e6]">
        <div className="min-w-[760px]">
        <div className="grid h-10 grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(110px,160px)_minmax(130px,180px)_88px] items-center bg-[#f7f8f9] px-4 text-[11px] font-semibold tracking-wide text-[#626f86] uppercase">
          <span>Workspace</span>
          <span>Ngày tạo</span>
          <span>Thành viên</span>
          <span>Trạng thái</span>
          <span />
        </div>

        {loading ? (
          <p className="px-4 py-8 text-[13px] text-[#626f86]">Đang tải workspace…</p>
        ) : error ? (
          <div className="flex items-center gap-3 px-4 py-8 text-[13px] text-[#ca3521]">
            <span>{error}</span>
            <button type="button" className="font-semibold text-[#0c66e4]" onClick={() => refresh()}>
              Thử lại
            </button>
          </div>
        ) : list && list.items.length === 0 ? (
          <p className="px-4 py-8 text-[13px] text-[#626f86]">
            Chưa có workspace. Tạo workspace mới để bắt đầu.
          </p>
        ) : (
          list?.items.map((item) => (
            <div
              key={item.id}
              className="grid h-[72px] grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(110px,160px)_minmax(130px,180px)_88px] items-center border-t border-[#dfe1e6] px-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <WorkspaceMark item={item} />
                <Link href={`/workspaces/${item.id}`} className="truncate text-[14px] font-semibold text-[#172b4d] hover:text-[#0c66e4]">
                  {item.name}
                </Link>
              </div>
              <span className="text-[13px] text-[#44546f]">{formatCreated(item.createdAt)}</span>
              <span className="text-[13px] text-[#44546f]">{item.memberCount} thành viên</span>
              <span className="flex items-center gap-2 text-[13px] text-[#172b4d]">
                <span
                  className={`size-2 rounded-full ${item.status === "ACTIVE" ? "bg-[#22a06b]" : "bg-[#8590a2]"}`}
                />
                {item.status === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"}
              </span>
              <span className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  aria-label={`Sửa ${item.name}`}
                  className="grid size-8 place-items-center text-[#44546f] hover:text-[#172b4d]"
                  onClick={() => {
                    setSelected(item);
                    setDialog("edit");
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Xóa ${item.name}`}
                  className="grid size-8 place-items-center text-[#ca3521]"
                  onClick={() => {
                    setSelected(item);
                    setDialog("delete");
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
          ))
        )}

        <div className="flex h-12 items-center justify-between border-t border-[#dfe1e6] px-4">
          <p className="text-[13px] text-[#626f86]">{footer}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Trang trước"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="grid size-8 place-items-center rounded-[4px] text-[#626f86] disabled:text-[#c7cdd6]"
            >
              <ChevronLeft size={16} />
            </button>
            {pageWindow(page, pages).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                className={`grid size-8 place-items-center rounded-[4px] text-[13px] font-semibold ${
                  number === page ? "bg-[#0c66e4] text-white" : "text-[#44546f] hover:bg-[#f7f8f9]"
                }`}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              aria-label="Trang sau"
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
              className="grid size-8 place-items-center rounded-[4px] text-[#626f86] disabled:text-[#c7cdd6]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        </div>
      </div>

      {dialog === "create" && user ? (
        <CreateWorkspaceDialog
          ownerId={user.id}
          onClose={() => setDialog(null)}
          onSaved={() => refresh(1)}
        />
      ) : null}
      {dialog === "edit" && selected ? (
        <EditWorkspaceDialog
          item={selected}
          onClose={() => {
            setDialog(null);
            setSelected(null);
          }}
          onSaved={() => refresh()}
        />
      ) : null}
      {dialog === "delete" && selected ? (
        <DeleteWorkspaceDialog
          item={selected}
          onClose={() => {
            setDialog(null);
            setSelected(null);
          }}
          onDeleted={() => refresh(page > 1 && (list?.items.length ?? 0) === 1 ? page - 1 : page)}
        />
      ) : null}
    </section>
  );
}

function WorkspaceMark({ item }: { item: WorkspaceItem }) {
  const label = (item.icon?.trim() || initials(item.name)).slice(0, 4);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!item.hasIcon) return;
    let cancelled = false;
    let url: string | null = null;
    api
      .get(`/workspaces/${item.id}/icon`, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        url = URL.createObjectURL(response.data);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.hasIcon, item.id]);

  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-gradient-to-br from-[#0c66e4] to-[#0052cc] text-[12px] font-semibold text-white">
      {src ? <img src={src} alt="" className="size-8 object-cover" /> : label}
    </span>
  );
}
