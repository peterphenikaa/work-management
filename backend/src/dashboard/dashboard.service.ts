import { Injectable } from '@nestjs/common';
import { statusBucket, type StatusBucket } from '../common/status-bucket.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [activeWorkspaces, users, tasks] = await Promise.all([
      this.prisma.workspace.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, locked: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          space: {
            deletedAt: null,
            archivedAt: null,
            workspace: { deletedAt: null, status: 'ACTIVE' },
          },
        },
        select: { status: { select: { name: true } } },
      }),
    ]);

    const byStatus: Record<StatusBucket, number> = Object.fromEntries(
      TASK_STATUSES.map((status) => [status, 0]),
    ) as Record<StatusBucket, number>;
    for (const task of tasks) {
      byStatus[statusBucket(task.status.name)] += 1;
    }
    const taskTotal = tasks.length;
    const taskDone = byStatus.DONE;
    // Không có workspace hoạt động thì KPI công việc phải = 0.
    const effectiveTaskTotal = activeWorkspaces === 0 ? 0 : taskTotal;
    const effectiveDone = activeWorkspaces === 0 ? 0 : taskDone;

    return {
      workspaces: { active: activeWorkspaces },
      members: {
        total: users.length,
        active: users.filter((user) => !user.locked).length,
      },
      tasks: {
        total: effectiveTaskTotal,
        done: effectiveDone,
        percent: effectiveTaskTotal === 0 ? 0 : Math.round((effectiveDone / effectiveTaskTotal) * 100),
        byStatus:
          activeWorkspaces === 0
            ? (Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as Record<StatusBucket, number>)
            : byStatus,
      },
      membersPreview: users.slice(0, 8).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: !user.locked,
      })),
    };
  }
}
