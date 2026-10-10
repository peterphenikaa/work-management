"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

type SpaceOption = { id: string; name: string };

export type ListDraft = {
  id: string;
  name: string;
  description: string | null;
};

export function ListDialog({
  open,
  mode,
  workspaceId,
  spaceId,
  list,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  workspaceId: string;
  spaceId: string;
  list: ListDraft | null;
  onClose: () => void;
  onSaved: (spaceId: string, listId: string) => void;
}) {
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [selectedSpace, setSelectedSpace] = useState(spaceId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedSpace(spaceId);
    setName(list?.name ?? "");
    setDescription(list?.description ?? "");
    setError("");
    let cancelled = false;
    api
      .get<{ items: SpaceOption[] }>(`/workspaces/${workspaceId}/spaces`)
      .then((response) => {
        if (!cancelled) setSpaces(response.data.items);
      })
      .catch(() => {
        if (!cancelled) setSpaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, spaceId, list, workspaceId]);

  if (!open) return null;

  const ready = name.trim().length > 0 && !saving;

  async function submit() {
    if (!ready) return;
    setSaving(true);
    setError("");
    const payload = { name: name.trim(), description: description.trim() || undefined, spaceId: selectedSpace };
    try {
      if (mode === "create") {
        const response = await api.post<{ id: string }>(
          `/workspaces/${workspaceId}/spaces/${selectedSpace}/lists`,
          { name: payload.name, description: payload.description },
        );
        onSaved(selectedSpace, response.data.id);
      } else if (list) {
        await api.patch(`/workspaces/${workspaceId}/spaces/${spaceId}/lists/${list.id}`, payload);
        onSaved(selectedSpace, list.id);
      }
      onClose();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không lưu được list");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#091e42]/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-labelledby="list-dialog-title"
        className="w-full max-w-[590px] overflow-hidden rounded-lg bg-white shadow-[0_8px_28px_rgba(9,30,66,0.25)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-h-[76px] items-center gap-3 border-b border-[#dfe1e6] px-[18px]">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[7px] bg-[#e9f2ff]">
            <img src="/space/list.svg" alt="" width={18} height={18} draggable={false} />
          </span>
          <span className="min-w-0 flex-1">
            <span id="list-dialog-title" className="block text-[15px] font-semibold text-[#172b4d]">
              {mode === "create" ? "Tạo List" : "Chỉnh sửa List"}
            </span>
            <span className="mt-0.5 block text-[13px] text-[#626f86]">List phải thuộc một Space cụ thể trong Workspace.</span>
          </span>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid size-8 place-items-center rounded text-[#626f86] hover:bg-[#f7f8f9]">
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-3.5 p-[18px]">
          <Field label="Space chứa List" required>
            <span className="relative block">
              <select
                value={selectedSpace}
                onChange={(event) => setSelectedSpace(event.target.value)}
                className="h-[38px] w-full appearance-none rounded border border-[#c7cdd6] bg-white pr-8 pl-3 text-[13px] text-[#172b4d] outline-none"
              >
                {spaces.length === 0 ? <option value={spaceId}>Đang tải space…</option> : null}
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[#626f86]" />
            </span>
          </Field>
          <Field label="Tên List" required>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Sprint 1"
              maxLength={80}
              className="h-[38px] w-full rounded border border-[#c7cdd6] px-3 text-[13px] text-[#172b4d] outline-none placeholder:text-[#172b4d]/50"
            />
          </Field>
          <Field label="Mô tả">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Mô tả mục đích của List..."
              maxLength={1000}
              className="h-[76px] w-full resize-none rounded border border-[#c7cdd6] px-3 py-2 text-[13px] text-[#172b4d] outline-none placeholder:text-[#172b4d]/50"
            />
          </Field>
          {error ? <p className="text-[12px] text-[#ae2e24]">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#dfe1e6] bg-[#f7f8f9] px-[22px] py-3.5">
          <button type="button" onClick={onClose} className="h-[34px] rounded bg-[#f1f2f4] px-3 text-[13px] font-semibold text-[#44546f]">
            Hủy
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => void submit()}
            className="h-[34px] rounded bg-[#0c66e4] px-3 text-[13px] font-semibold text-white disabled:opacity-55"
          >
            {mode === "create" ? "Tạo List" : "Lưu thay đổi"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[#44546f]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
