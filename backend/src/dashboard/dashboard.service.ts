import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [activeWorkspaces, users] = await Promise.all([
      this.prisma.workspace.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0]));
    const taskTotal = 0;
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
