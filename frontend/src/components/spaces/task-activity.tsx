"use client";

import { Download, Paperclip, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

type Person = { userId: string; name: string };
type Comment = {
  id: string;
  kind: "COMMENT" | "EVENT";
  body: string;
  authorId: string;
  authorName: string;
  mentionIds: string[];
  createdAt: string;
};
type Attachment = {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
};

const AVATAR = ["#0c66e4", "#6e5dc6", "#e56910", "#22a06b", "#ae4787", "#334563"];
const MAX_BYTES = 5 * 1024 * 1024;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: AVATAR[hash % AVATAR.length] }}>
      {letters || "?"}
    </span>
  );
}

// Làm nổi bật các đoạn @Tên trong nội dung bình luận.
function withMentions(body: string, people: Person[]): ReactNode {
  const names = people.map((person) => person.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return body;
  const pattern = new RegExp(`(@(?:${names.map(escapeRegExp).join("|")}))`, "g");
  return body.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="rounded bg-[#e9f2ff] px-1 font-semibold text-[#0c66e4]">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function TaskActivity({
  workspaceId,
  spaceId,
  taskId,
  people,
  currentUserId,
  currentName,
  canManageFiles,
}: {
  workspaceId: string;
  spaceId: string;
  taskId: string;
  people: Person[];
  currentUserId: string;
  currentName: string;
  canManageFiles: boolean;
}) {
  const base = `/workspaces/${workspaceId}/spaces/${spaceId}/tasks/${taskId}`;
  const [comments, setComments] = useState<Comment[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<{ query: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [commentRes, fileRes] = await Promise.all([
      api.get<{ items: Comment[] }>(`${base}/comments`),
      api.get<{ items: Attachment[] }>(`${base}/attachments`),
    ]);
    setComments(commentRes.data.items);
    setFiles(fileRes.data.items);
  }, [base]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get<{ items: Comment[] }>(`${base}/comments`), api.get<{ items: Attachment[] }>(`${base}/attachments`)])
      .then(([commentRes, fileRes]) => {
        if (cancelled) return;
        setComments(commentRes.data.items);
        setFiles(fileRes.data.items);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được hoạt động");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const candidates = useMemo(() => {
    if (!picker) return [];
    const needle = picker.query.toLocaleLowerCase("vi");
    return people.filter((person) => person.userId !== currentUserId && person.name.toLocaleLowerCase("vi").includes(needle)).slice(0, 6);
  }, [picker, people, currentUserId]);

  function onDraftChange(value: string) {
    setDraft(value);
    // Gợi ý @mention khi đang gõ ngay sau ký tự @ (không chứa khoảng trắng kép).
    const match = /(?:^|\s)@([^@\n]{0,30})$/.exec(value);
    setPicker(match ? { query: match[1] } : null);
  }

  function pick(person: Person) {
    setDraft((current) => current.replace(/@([^@\n]{0,30})$/, `@${person.name} `));
    setPicker(null);
    inputRef.current?.focus();
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    const mentionIds = people.filter((person) => body.includes(`@${person.name}`)).map((person) => person.userId);
    setSending(true);
    setError("");
    try {
      const response = await api.post<Comment>(`${base}/comments`, { body, mentionIds });
      setComments((current) => [response.data, ...current]);
      setDraft("");
      setPicker(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không gửi được bình luận");
    } finally {
      setSending(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("Tệp tối đa 5 MB");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`${base}/attachments`, form, { timeout: 60000 });
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không tải được tệp lên");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function download(file: Attachment) {
    try {
      const response = await api.get<Blob>(`${base}/attachments/${file.id}/download`, { responseType: "blob", timeout: 60000 });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không tải được tệp xuống");
    }
  }

  async function remove(file: Attachment) {
    if (!window.confirm(`Xóa tệp "${file.fileName}"?`)) return;
    try {
      await api.delete(`${base}/attachments/${file.id}`);
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không xóa được tệp");
    }
  }

  return (
    <>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-bold tracking-[0.08em] text-[#7a869a] uppercase">Tệp đính kèm {files.length > 0 ? `(${files.length})` : ""}</h3>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-[#dfe1e6] bg-white px-2.5 text-[12px] font-semibold text-[#44546f] hover:bg-[#f7f8f9] disabled:opacity-60"
          >
            <Paperclip size={13} />
            {uploading ? "Đang tải lên..." : "Tải tệp lên"}
          </button>
          <input ref={fileRef} type="file" aria-label="Chọn tệp đính kèm" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
        </div>
        {files.length === 0 ? (
          <p className="text-[12px] text-[#626f86]">{loading ? "Đang tải..." : "Chưa có tệp đính kèm (tối đa 5 MB mỗi tệp)."}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-2 rounded-md border border-[#eef0f3] bg-[#fafbfc] px-2.5 py-1.5">
                <Paperclip size={14} className="shrink-0 text-[#626f86]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[#172b4d]">{file.fileName}</span>
                  <span className="block text-[11px] text-[#626f86]">
                    {sizeLabel(file.size)} · {file.uploaderName} · {relative(file.createdAt)}
                  </span>
                </span>
                <button type="button" aria-label={`Tải ${file.fileName}`} title="Tải xuống" onClick={() => void download(file)} className="grid size-7 place-items-center rounded text-[#626f86] hover:bg-white hover:text-[#0c66e4]">
                  <Download size={14} />
                </button>
                {canManageFiles || file.uploaderId === currentUserId ? (
                  <button type="button" aria-label={`Xóa ${file.fileName}`} title="Xóa" onClick={() => void remove(file)} className="grid size-7 place-items-center rounded text-[#626f86] hover:bg-white hover:text-[#ae2e24]">
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[#7a869a] uppercase">Hoạt động</h3>
        <form
          className="relative flex items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Avatar name={currentName} />
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              value={draft}
              maxLength={2000}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Viết bình luận, gõ @ để nhắc đến ai đó..."
              aria-label="Bình luận"
              className="h-9 w-full rounded-lg border border-[#dfe1e6] px-3 text-[13px] text-[#172b4d] outline-none placeholder:text-[#a5adba] focus:border-[#0c66e4]"
            />
            {picker && candidates.length > 0 ? (
              <ul className="absolute top-10 left-0 z-10 w-56 overflow-hidden rounded-md border border-[#dfe1e6] bg-white py-1 shadow-[0_8px_24px_rgba(9,30,66,0.16)]">
                {candidates.map((person) => (
                  <li key={person.userId}>
                    <button type="button" onClick={() => pick(person)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-[#172b4d] hover:bg-[#f7f8f9]">
                      <Avatar name={person.name} />
                      <span className="truncate">{person.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button type="submit" disabled={!draft.trim() || sending} className="h-9 rounded bg-[#0c66e4] px-3 text-[12px] font-semibold text-white disabled:opacity-50">
            Gửi
          </button>
        </form>
        {error ? <p className="mt-2 text-[12px] text-[#ae2e24]">{error}</p> : null}
        <ul className="mt-4 flex flex-col gap-3">
          {comments.map((comment) =>
            comment.kind === "EVENT" ? (
              <li key={comment.id} className="flex gap-2">
                <Avatar name={comment.authorName} />
                <span className="text-[12px] text-[#626f86]">
                  <span className="font-semibold text-[#172b4d]">{comment.authorName}</span> {comment.body} · {relative(comment.createdAt)}
                </span>
              </li>
            ) : (
              <li key={comment.id} className="flex gap-2">
                <Avatar name={comment.authorName} />
                <span className="min-w-0">
                  <span className="block text-[12px] text-[#626f86]">
                    <span className="font-semibold text-[#172b4d]">{comment.authorName}</span> · {relative(comment.createdAt)}
                  </span>
                  <span className="mt-0.5 block text-[13px] break-words whitespace-pre-wrap text-[#172b4d]">{withMentions(comment.body, people)}</span>
                </span>
              </li>
            ),
          )}
          {!loading && comments.length === 0 ? <li className="text-[12px] text-[#626f86]">Chưa có hoạt động.</li> : null}
        </ul>
      </section>
    </>
  );
}
