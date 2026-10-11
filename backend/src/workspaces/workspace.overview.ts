import { BadRequestException } from '@nestjs/common';
import { statusBucket, type StatusBucket } from '../common/status-bucket.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type Period = 'week' | '30d' | 'month' | 'all';

const BUCKETS: { id: StatusBucket; name: string; color: string }[] = [
  { id: 'TODO', name: 'Cần làm', color: '#8590a2' },
  { id: 'IN_PROGRESS', name: 'Đang thực hiện', color: '#0c66e4' },
  { id: 'REVIEW', name: 'Đánh giá', color: '#6e5dc6' },
  { id: 'DONE', name: 'Hoàn thành', color: '#22a06b' },
];

const ACTIONS: Record<string, string> = {
  WORKSPACE_CREATE: 'tạo workspace',
  WORKSPACE_UPDATE: 'cập nhật workspace',
  WORKSPACE_DELETE: 'xóa workspace',
  INVITATION_CREATE: 'gửi lời mời',
  INVITATION_ACCEPT: 'tham gia workspace',
  INVITATION_REVOKE: 'thu hồi lời mời',
  SPACE_CREATE: 'tạo space',
  SPACE_UPDATE: 'cập nhật space',
  TASK_CREATE: 'thêm công việc',
  TASK_UPDATE: 'cập nhật công việc',
  TASK_ASSIGN: 'phân công công việc',
};

export async function buildWorkspaceOverview(
  prisma: PrismaService,
  input: {
    workspaceId: string;
    workspaceName: string;
    role: 'ADMIN' | 'LEADER' | 'MEMBER';
    period?: string;
    spaceId?: string;
  },
) {
  const period = parsePeriod(input.period);
  const range = periodRange(period);
  if (input.spaceId) {
    const space = await prisma.space.findFirst({
      where: { id: input.spaceId, workspaceId: input.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!space) throw new BadRequestException('Space không thuộc workspace này');
  }

  const [activeSprints, spaces, members, tasks, logs] = await Promise.all([
    prisma.sprint.count({
      where: {
        status: 'ACTIVE',
        space: { workspaceId: input.workspaceId, deletedAt: null, ...(input.spaceId ? { id: input.spaceId } : {}) },
      },
    }),
    prisma.space.findMany({
      where: { workspaceId: input.workspaceId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: input.workspaceId, status: 'ACTIVE' },
      orderBy: { joinedAt: 'asc' },
      select: { role: true, user: { select: { id: true, name: true } } },
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        space: {
          workspaceId: input.workspaceId,
          deletedAt: null,
          ...(input.spaceId ? { id: input.spaceId } : {}),
        },
      },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        code: true,
        title: true,
        priority: true,
        dueAt: true,
        createdAt: true,
        updatedAt: true,
        assigneeId: true,
        status: { select: { name: true } },
        assignee: { select: { name: true } },
        space: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        ...(range ? { createdAt: { gte: range.start } } : {}),
        OR: [
          { targetType: 'WORKSPACE', targetId: input.workspaceId },
          { metadata: { path: ['workspaceId'], equals: input.workspaceId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const scoped = tasks.filter((task) => inScope(task, range));
  const counts = Object.fromEntries(BUCKETS.map((bucket) => [bucket.id, 0])) as Record<StatusBucket, number>;
  for (const task of scoped) counts[statusBucket(task.status.name)] += 1;
  const total = scoped.length;
  const completed = counts.DONE;
  const overdue = scoped.filter((task) => isOverdue(task, now)).length;

  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(logs.map((log) => log.actorId))] } },
    select: { id: true, name: true },
  });
  const names = new Map(actors.map((actor) => [actor.id, actor.name]));

  const byAssignee = new Map<string, { assigned: number; done: number }>();
  for (const task of scoped) {
    if (!task.assigneeId) continue;
    const row = byAssignee.get(task.assigneeId) ?? { assigned: 0, done: 0 };
    row.assigned += 1;
    if (statusBucket(task.status.name) === 'DONE') row.done += 1;
    byAssignee.set(task.assigneeId, row);
  }

  return {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    role: input.role,
    period,
    generatedAt: now.toISOString(),
    totalTasks: total,
    completedTasks: completed,
    completionRate: total === 0 ? null : Math.round((completed / total) * 100),
    overdueTasks: overdue,
    activeSprints,
    spaces: spaces.map((space) => ({
      id: space.id,
      name: space.name,
      color: space.color,
      icon: space.icon,
      taskCount: space._count.tasks,
    })),
    statusDistribution: BUCKETS.map((bucket) => ({
      name: bucket.name,
      bucket: bucket.id,
      color: bucket.color,
      count: counts[bucket.id],
      percent: total === 0 ? 0 : Math.round((counts[bucket.id] / total) * 100),
    })),
    attention: scoped
      .filter((task) => {
        if (statusBucket(task.status.name) === 'DONE' || !task.dueAt) return false;
        return task.dueAt <= soon;
      })
      .slice(0, 8)
      .map((task) => ({
        id: task.id,
        code: task.code,
        title: task.title,
        priority: task.priority,
        dueAt: task.dueAt!.toISOString(),
        overdue: task.dueAt! < now,
        spaceId: task.space.id,
        spaceName: task.space.name,
      })),
    members: members.map((member) => {
      const stats = byAssignee.get(member.user.id) ?? { assigned: 0, done: 0 };
      return {
        userId: member.user.id,
        name: member.user.name,
        role: member.role,
        assigned: stats.assigned,
        done: stats.done,
        workload: stats.assigned === 0 ? 0 : Math.round((stats.done / stats.assigned) * 100),
      };
    }),
    activity: logs.map((log) => {
      const meta = asRecord(log.metadata);
      const code = typeof meta.code === 'string' ? meta.code : '';
      const verb = ACTIONS[log.action] ?? 'cập nhật';
      return {
        id: log.id,
        title: `${names.get(log.actorId) ?? 'Hệ thống'} ${verb}${code ? ` ${code}` : ''}`,
        spaceName: typeof meta.name === 'string' ? meta.name : null,
        createdAt: log.createdAt.toISOString(),
      };
    }),
    tasks: scoped.slice(0, 80).map((task) => ({
      id: task.id,
      code: task.code,
      title: task.title,
      bucket: statusBucket(task.status.name),
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      assigneeName: task.assignee?.name ?? null,
      spaceId: task.space.id,
      spaceName: task.space.name,
    })),
  };
}

function parsePeriod(value?: string): Period {
  if (!value || value === 'week') return 'week';
  if (value === '30d' || value === 'month' || value === 'all') return value;
  throw new BadRequestException('Kỳ lọc không hợp lệ');
}

function periodRange(period: Period) {
  if (period === 'all') return null;
  const start = new Date();
  if (period === 'week') start.setDate(start.getDate() - 7);
  else if (period === '30d') start.setDate(start.getDate() - 30);
  else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start };
}

function inScope(
  task: { createdAt: Date; updatedAt: Date; dueAt: Date | null; status: { name: string } },
  range: { start: Date } | null,
) {
  if (!range) return true;
  if (statusBucket(task.status.name) !== 'DONE') return true;
  return task.updatedAt >= range.start || task.createdAt >= range.start || (task.dueAt !== null && task.dueAt >= range.start);
}

function isOverdue(task: { dueAt: Date | null; status: { name: string } }, now: Date) {
  return Boolean(task.dueAt && task.dueAt < now && statusBucket(task.status.name) !== 'DONE');
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
