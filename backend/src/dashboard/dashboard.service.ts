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
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.task.findMany({
        where: { deletedAt: null, space: { deletedAt: null } },
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

    return {
      workspaces: { active: activeWorkspaces },
      members: { total: users.length, active: users.length },
      tasks: {
        total: taskTotal,
        done: taskDone,
        percent: taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100),
        byStatus,
      },
      membersPreview: users.map((user) => ({ ...user, active: true })),
    };
  }
}
