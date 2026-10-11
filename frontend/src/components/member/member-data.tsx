"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { TaskDraft } from "@/components/spaces/task-detail";
import type { SpaceColor, SpaceIcon } from "@/components/workspaces/space-dialog";

export type Bucket = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export const BUCKET_LABEL: Record<Bucket, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang thực hiện",
  REVIEW: "Đánh giá",
  DONE: "Hoàn thành",
};

// Đồng bộ với backend/src/common/status-bucket.ts: trạng thái là cấu hình riêng của từng Space.
export function bucketOf(name: string): Bucket {
  const value = name.trim().toLocaleLowerCase("vi");
  if (value.includes("hoàn") || value === "done" || value.includes("xong")) return "DONE";
  if (value.includes("review") || value.includes("đánh giá")) return "REVIEW";
  if (value.includes("đang") || value.includes("thực hiện")) return "IN_PROGRESS";
  return "TODO";
}

export type MemberStatus = { id: string; name: string; position: number };

export type MemberTask = TaskDraft & {
  assigneeName: string | null;
  sprintId: string | null;
  spaceId: string;
  spaceName: string;
  listName: string;
  statusName: string;
  bucket: Bucket;
};

export type MemberSpace = {
  id: string;
  name: string;
  description: string | null;
  icon: SpaceIcon;
  color: SpaceColor;
  accessType: "PRIVATE" | "PUBLIC";
  memberCanCreateTask: boolean;
  statuses: MemberStatus[];
  members: { userId: string; name: string }[];
  lists: { id: string; name: string; description: string | null; taskCount: number }[];
  tasks: MemberTask[];
};

export type MemberSprint = {
  id: string;
  spaceId: string;
  spaceName: string;
  name: string;
  goal: string | null;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
  startAt: string | null;
  endAt: string | null;
  total: number;
  done: number;
};

export type MemberNotification = {
  id: string;
  type: "ASSIGNED" | "MENTION" | "COMMENT" | "STATUS" | "REVIEW" | "DEADLINE";
  title: string;
  body: string | null;
  taskId: string | null;
  read: boolean;
  createdAt: string;
};

type RawSpace = Omit<MemberSpace, "tasks"> & {
  tasks: (TaskDraft & { assigneeName: string | null; sprintId: string | null })[];
};

type MemberData = {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  spaces: MemberSpace[];
  tasks: MemberTask[];
  sprints: MemberSprint[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  notifications: MemberNotification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const Context = createContext<MemberData | null>(null);

export function useMemberData() {
  return useContext(Context);
}

const DAY = 24 * 60 * 60 * 1000;

export function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function isOverdueTask(task: { dueAt: string | null; bucket: Bucket }) {
  if (!task.dueAt || task.bucket === "DONE") return false;
  return new Date(task.dueAt) < startOfToday();
}

export function isDueToday(task: { dueAt: string | null }) {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt);
  const today = startOfToday();
  return due >= today && due.getTime() < today.getTime() + DAY;
}

export function isDueSoon(task: { dueAt: string | null; bucket: Bucket }, days = 7) {
  if (!task.dueAt || task.bucket === "DONE") return false;
  const due = new Date(task.dueAt).getTime();
  const today = startOfToday().getTime();
  return due >= today && due < today + (days + 1) * DAY;
}

function decorate(space: RawSpace): MemberSpace {
  const statusById = new Map(space.statuses.map((status) => [status.id, status.name]));
  const listById = new Map(space.lists.map((list) => [list.id, list.name]));
  return {
    ...space,
    tasks: space.tasks.map((task) => {
      const statusName = statusById.get(task.statusId) ?? "";
      return {
        ...task,
        spaceId: space.id,
        spaceName: space.name,
        listName: listById.get(task.listId) ?? "",
        statusName,
        bucket: bucketOf(statusName),
      };
    }),
  };
}

// Một lượt gọi API cho mọi Space (thay vì gọi từng Space) cùng Sprint và thông báo.
async function fetchAll(workspaceId: string) {
  const [spaces, sprints, notifications] = await Promise.all([
    api.get<{ items: RawSpace[] }>(`/workspaces/${workspaceId}/spaces/detailed`),
    api.get<{ items: MemberSprint[] }>(`/workspaces/${workspaceId}/sprints`),
    api.get<{ items: MemberNotification[] }>(`/workspaces/${workspaceId}/notifications`),
  ]);
  return {
    spaces: spaces.data.items.map(decorate),
    sprints: sprints.data.items,
    notifications: notifications.data.items,
  };
}

export function MemberDataProvider({
  workspaceId,
  workspaceName,
  userId,
  children,
}: {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  children: ReactNode;
}) {
  const [spaces, setSpaces] = useState<MemberSpace[]>([]);
  const [sprints, setSprints] = useState<MemberSprint[]>([]);
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchAll(workspaceId);
      if (!alive.current) return;
      setSpaces(next.spaces);
      setSprints(next.sprints);
      setNotifications(next.notifications);
      setError("");
    } catch (reason: unknown) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu công việc");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    fetchAll(workspaceId)
      .then((next) => {
        if (cancelled) return;
        setSpaces(next.spaces);
        setSprints(next.sprints);
        setNotifications(next.notifications);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu công việc");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Thông báo mới (giao việc, @mention...) đến từ người khác nên làm mới định kỳ.
    const timer = window.setInterval(() => {
      api
        .get<{ items: MemberNotification[] }>(`/workspaces/${workspaceId}/notifications`)
        .then((response) => {
          if (!cancelled) setNotifications(response.data.items);
        })
        .catch(() => undefined);
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workspaceId]);

  const tasks = useMemo(() => spaces.flatMap((space) => space.tasks), [spaces]);
  const unread = notifications.filter((item) => !item.read).length;

  const value = useMemo<MemberData>(
    () => ({
      workspaceId,
      workspaceName,
      userId,
      spaces,
      tasks,
      sprints,
      loading,
      error,
      refresh,
      notifications,
      unread,
      markRead: (id) => {
        setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
        void api.post(`/workspaces/${workspaceId}/notifications/${id}/read`).catch(() => undefined);
      },
      markAllRead: () => {
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
        void api.post(`/workspaces/${workspaceId}/notifications/read-all`).catch(() => undefined);
      },
    }),
    [workspaceId, workspaceName, userId, spaces, tasks, sprints, loading, error, refresh, notifications, unread],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
