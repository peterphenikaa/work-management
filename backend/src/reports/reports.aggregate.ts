import { statusBucket, statusColor } from '../common/status-bucket.js';
import type { ReportPeriod } from './dto/report.query.js';

export type ReportTask = {
  id: string;
  code: string;
  title: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  statusName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  reporterName: string;
  workspaceId: string;
  workspaceName: string;
  spaceId: string;
  spaceName: string;
  listName: string;
};

export type ReportOption = { id: string; name: string };

type Bucket = { start: Date; end: Date; label: string };

const DAY = 86_400_000;

export function rangeFor(period: ReportPeriod, now: Date) {
  const end = now;
  if (period === '7d') {
    return { start: daysAgo(now, 6), end, label: '7 ngày gần đây' };
  }
  if (period === '30d') {
    return { start: daysAgo(now, 29), end, label: '30 ngày gần đây' };
  }
  if (period === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end, label: 'Tháng này' };
  }
  const quarter = Math.floor(now.getMonth() / 3);
  return {
    start: new Date(now.getFullYear(), quarter * 3, 1),
    end,
    label: 'Quý này',
  };
}

export function taskInScope(task: Pick<ReportTask, 'createdAt' | 'updatedAt' | 'dueAt' | 'statusName'>, start: Date, end: Date, now: Date) {
  const done = statusBucket(task.statusName) === 'DONE';
  const created = task.createdAt >= start && task.createdAt <= end;
  const updated = task.updatedAt >= start && task.updatedAt <= end;
  const dueInRange = task.dueAt != null && task.dueAt >= start && task.dueAt <= end;
  const overdueOpen = !done && task.dueAt != null && task.dueAt.getTime() < now.getTime();
  return created || updated || dueInRange || overdueOpen;
}

export function aggregateReport(input: {
  tasks: ReportTask[];
  period: ReportPeriod;
  start: Date;
  end: Date;
  now: Date;
  rangeLabel: string;
  workspaceId: string | null;
  spaceId: string | null;
  assigneeId: string | null;
  truncated: boolean;
  options: {
    workspaces: ReportOption[];
    spaces: Array<ReportOption & { workspaceId: string; workspaceName: string }>;
    members: ReportOption[];
  };
}) {
  const tasks = input.tasks.filter((task) => taskInScope(task, input.start, input.end, input.now));
  const total = tasks.length;
  let completed = 0;
  let inProgress = 0;
  let overdue = 0;

  const statusCounts = new Map<string, number>();
  for (const task of tasks) {
    const bucket = statusBucket(task.statusName);
    if (bucket === 'DONE') completed += 1;
    if (bucket === 'IN_PROGRESS' || bucket === 'REVIEW') inProgress += 1;
    if (bucket !== 'DONE' && task.dueAt && task.dueAt.getTime() < input.now.getTime()) overdue += 1;
    statusCounts.set(task.statusName, (statusCounts.get(task.statusName) ?? 0) + 1);
  }

  const buckets = buildBuckets(input.period, input.start, input.end);
  const trend = buckets.map((bucket) => ({
    label: bucket.label,
    created: tasks.filter((task) => task.createdAt >= bucket.start && task.createdAt < bucket.end).length,
    completed: tasks.filter(
      (task) =>
        statusBucket(task.statusName) === 'DONE' &&
        task.updatedAt >= bucket.start &&
        task.updatedAt < bucket.end,
    ).length,
  }));

  const members = new Map<
    string,
    {
      memberId: string | null;
      memberName: string;
      assignedTasks: number;
      completedTasks: number;
      onTimeTasks: number;
      lateTasks: number;
      overdueOpenTasks: number;
    }
  >();

  for (const task of tasks) {
    const key = task.assigneeId ?? '__none__';
    const row = members.get(key) ?? {
      memberId: task.assigneeId,
      memberName: task.assigneeName ?? 'Chưa giao',
      assignedTasks: 0,
      completedTasks: 0,
      onTimeTasks: 0,
      lateTasks: 0,
      overdueOpenTasks: 0,
    };
    row.assignedTasks += 1;
    const done = statusBucket(task.statusName) === 'DONE';
    if (done) {
      row.completedTasks += 1;
      if (task.dueAt) {
        if (task.updatedAt.getTime() <= task.dueAt.getTime()) row.onTimeTasks += 1;
        else row.lateTasks += 1;
      }
    } else if (task.dueAt && task.dueAt.getTime() < input.now.getTime()) {
      row.overdueOpenTasks += 1;
    }
    members.set(key, row);
  }

  const overdueTasks = tasks
    .filter((task) => statusBucket(task.statusName) !== 'DONE' && task.dueAt && task.dueAt.getTime() < input.now.getTime())
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))
    .slice(0, 100)
    .map((task) => ({
      taskId: task.id,
      code: task.code,
      taskName: task.title,
      workspaceId: task.workspaceId,
      workspaceName: task.workspaceName,
      spaceId: task.spaceId,
      spaceName: task.spaceName,
      listName: task.listName,
      assigneeName: task.assigneeName,
      reporterName: task.reporterName,
      dueDate: task.dueAt?.toISOString() ?? null,
      daysOverdue: task.dueAt ? Math.max(1, Math.ceil((input.now.getTime() - task.dueAt.getTime()) / DAY)) : 0,
      priority: task.priority,
      status: task.statusName,
    }));

  const completedTasks = tasks
    .filter((task) => statusBucket(task.statusName) === 'DONE')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 20)
    .map((task) => ({
      taskId: task.id,
      code: task.code,
      taskName: task.title,
      workspaceId: task.workspaceId,
      spaceId: task.spaceId,
      spaceName: task.spaceName,
      assigneeName: task.assigneeName,
      completedAt: task.updatedAt.toISOString(),
      onTime: task.dueAt ? task.updatedAt.getTime() <= task.dueAt.getTime() : null,
      priority: task.priority,
    }));

  return {
    applied: {
      period: input.period,
      rangeLabel: input.rangeLabel,
      startDate: input.start.toISOString(),
      endDate: input.end.toISOString(),
      workspaceId: input.workspaceId,
      spaceId: input.spaceId,
      assigneeId: input.assigneeId,
    },
    truncated: input.truncated,
    options: input.options,
    kpis: {
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: inProgress,
      overdueTasks: overdue,
      completionRate: total === 0 ? null : Math.round((completed / total) * 100),
    },
    statusDistribution: [...statusCounts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        color: statusColor(name),
        percent: total === 0 ? 0 : Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi')),
    trend,
    members: [...members.values()]
      .map((row) => {
        const rated = row.onTimeTasks + row.lateTasks;
        return {
          ...row,
          onTimeRate: rated === 0 ? null : Math.round((row.onTimeTasks / rated) * 100),
        };
      })
      .sort((a, b) => b.assignedTasks - a.assignedTasks || a.memberName.localeCompare(b.memberName, 'vi')),
    overdueTasks,
    completedTasks,
  };
}

function daysAgo(now: Date, days: number) {
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildBuckets(period: ReportPeriod, start: Date, end: Date): Bucket[] {
  if (period === 'quarter') {
    const buckets: Bucket[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      buckets.push({ start: bucketStart, end: bucketEnd, label: `T${cursor.getMonth() + 1}` });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  if (period === '30d') {
    const buckets: Bucket[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + 7);
      buckets.push({
        start: bucketStart,
        end: bucketEnd,
        label: `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return buckets;
  }

  const buckets: Bucket[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() + 1);
    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      label: `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}
