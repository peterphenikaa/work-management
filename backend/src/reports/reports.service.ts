import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { aggregateReport, rangeFor, type ReportTask } from './reports.aggregate.js';
import type { ReportQuery } from './dto/report.query.js';
import { workbook } from './reports.spreadsheet.js';

const TASK_TAKE = 5000;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(actor: AuthUser, query: ReportQuery) {
    const allowed = await this.allowedWorkspaceIds(actor);
    const period = query.period ?? '30d';
    const now = new Date();
    const range = rangeFor(period, now);
    const workspaceId = query.workspaceId ?? null;
    const spaceId = await this.resolveSpace(query.spaceId, workspaceId, allowed);
    const assigneeId = await this.resolveAssignee(query.assigneeId);

    if (workspaceId && allowed && !allowed.includes(workspaceId)) {
      throw new ForbiddenException('Bạn không có quyền xem workspace này');
    }

    const workspaceFilter = workspaceId ? [workspaceId] : allowed;
    const options = await this.options(workspaceFilter, workspaceId);
    const rows = await this.loadTasks(workspaceFilter, spaceId, assigneeId);

    const tasks: ReportTask[] = rows;

    return aggregateReport({
      tasks,
      period,
      start: range.start,
      end: range.end,
      now,
      rangeLabel: range.label,
      workspaceId,
      spaceId,
      assigneeId,
      truncated: rows.length >= TASK_TAKE,
      options,
    });
  }

  async exportXlsx(actor: AuthUser, query: ReportQuery) {
    const report = await this.build(actor, query);
    const generatedAt = new Date();
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'REPORT_EXPORT',
        targetType: 'REPORT',
        targetId: actor.id,
        result: 'SUCCESS',
        metadata: {
          format: 'XLSX',
          generatedAt: generatedAt.toISOString(),
          generatedBy: actor.id,
          reportTitle: 'Báo cáo tiến độ',
          filters: report.applied,
        },
      },
    });

    const date = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '');
    const buffer = workbook([
      {
        name: 'Tóm tắt',
        rows: [
          ['Báo cáo tiến độ'],
          ['Khoảng', report.applied.rangeLabel],
          ['Từ', date(report.applied.startDate)],
          ['Đến', date(report.applied.endDate)],
          ['Xuất lúc', generatedAt.toLocaleString('vi-VN')],
          ['Người xuất', actor.name],
          [],
          ['Chỉ số', 'Giá trị'],
          ['Tổng công việc', report.kpis.totalTasks],
          ['Đã hoàn thành', report.kpis.completedTasks],
          ['Đang thực hiện', report.kpis.inProgressTasks],
          ['Quá hạn', report.kpis.overdueTasks],
          ['Tỷ lệ hoàn thành (%)', report.kpis.completionRate ?? ''],
        ],
      },
      {
        name: 'Trạng thái',
        rows: [
          ['Trạng thái', 'Số lượng', 'Phần trăm'],
          ...report.statusDistribution.map((row) => [row.name, row.count, row.percent]),
        ],
      },
      {
        name: 'Xu hướng',
        rows: [
          ['Mốc', 'Tạo mới', 'Hoàn thành'],
          ...report.trend.map((row) => [row.label, row.created, row.completed]),
        ],
      },
      {
        name: 'Thành viên',
        rows: [
          ['Thành viên', 'Được giao', 'Hoàn thành', 'Đúng hạn', 'Trễ hạn', 'Đang quá hạn', 'Tỷ lệ đúng hạn (%)'],
          ...report.members.map((row) => [
            row.memberName,
            row.assignedTasks,
            row.completedTasks,
            row.onTimeTasks,
            row.lateTasks,
            row.overdueOpenTasks,
            row.onTimeRate ?? '',
          ]),
        ],
      },
      {
        name: 'Quá hạn',
        rows: [
          ['Mã', 'Công việc', 'Workspace', 'Space', 'List', 'Người thực hiện', 'Người giao', 'Hạn', 'Số ngày trễ', 'Ưu tiên', 'Trạng thái'],
          ...report.overdueTasks.map((row) => [
            row.code,
            row.taskName,
            row.workspaceName,
            row.spaceName,
            row.listName,
            row.assigneeName ?? '',
            row.reporterName,
            date(row.dueDate),
            row.daysOverdue,
            row.priority,
            row.status,
          ]),
        ],
      },
    ]);

    return buffer;
  }

  private async allowedWorkspaceIds(actor: AuthUser) {
    if (actor.role === 'ADMIN') return null;
    if (actor.role !== 'LEADER') {
      throw new ForbiddenException('Chỉ quản trị viên và trưởng nhóm xem được báo cáo');
    }
    const [memberships, owned] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { userId: actor.id, status: 'ACTIVE', role: 'LEADER' },
        select: { workspaceId: true },
      }),
      this.prisma.workspace.findMany({
        where: { ownerId: actor.id, deletedAt: null },
        select: { id: true },
      }),
    ]);
    return [...new Set([...memberships.map((row) => row.workspaceId), ...owned.map((row) => row.id)])];
  }

  private async resolveSpace(spaceId: string | undefined, workspaceId: string | null, allowed: string[] | null) {
    if (!spaceId) return null;
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, deletedAt: null },
      select: { id: true, workspaceId: true },
    });
    if (!space) throw new BadRequestException('Space không tồn tại');
    if (workspaceId && space.workspaceId !== workspaceId) {
      throw new BadRequestException('Space không thuộc workspace đã chọn');
    }
    if (allowed && !allowed.includes(space.workspaceId)) {
      throw new ForbiddenException('Bạn không có quyền xem space này');
    }
    return space.id;
  }

  private async resolveAssignee(assigneeId: string | undefined) {
    if (!assigneeId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
    if (!user) throw new BadRequestException('Không tìm thấy thành viên');
    return user.id;
  }

  private async options(workspaceFilter: string[] | null, workspaceId: string | null) {
    if (workspaceFilter && workspaceFilter.length === 0) {
      return { workspaces: [], spaces: [], members: [] };
    }
    const workspaceWhere = {
      deletedAt: null,
      ...(workspaceFilter ? { id: { in: workspaceFilter } } : {}),
    };
    const [workspaces, spaces, memberships] = await Promise.all([
      this.prisma.workspace.findMany({
        where: { ...workspaceWhere, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.space.findMany({
        where: {
          deletedAt: null,
          ...(workspaceId ? { workspaceId } : {}),
          workspace: workspaceWhere,
        },
        select: { id: true, name: true, workspaceId: true, workspace: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workspaceMember.findMany({
        where: {
          status: 'ACTIVE',
          workspace: {
            deletedAt: null,
            ...(workspaceId ? { id: workspaceId } : workspaceFilter ? { id: { in: workspaceFilter } } : {}),
          },
        },
        select: { user: { select: { id: true, name: true } } },
      }),
    ]);

    const members = new Map<string, { id: string; name: string }>();
    for (const row of memberships) {
      if (row.user) members.set(row.user.id, row.user);
    }
    const memberList = [...members.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    return {
      workspaces,
      spaces: spaces.map((space) => ({
        id: space.id,
        name: space.name,
        workspaceId: space.workspaceId,
        workspaceName: space.workspace.name,
      })),
      members: memberList,
    };
  }

  private async loadTasks(workspaceFilter: string[] | null, spaceId: string | null, assigneeId: string | null) {
    if (workspaceFilter && workspaceFilter.length === 0) return [];
    const spaces = await this.prisma.space.findMany({
      where: {
        deletedAt: null,
        ...(spaceId ? { id: spaceId } : {}),
        workspace: {
          deletedAt: null,
          ...(workspaceFilter ? { id: { in: workspaceFilter } } : {}),
        },
      },
      select: {
        id: true,
        name: true,
        workspace: { select: { id: true, name: true } },
      },
    });
    if (spaces.length === 0) return [];
    const spaceById = new Map(spaces.map((space) => [space.id, space]));
    const rows = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        spaceId: { in: [...spaceById.keys()] },
        ...(assigneeId ? { assigneeId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: TASK_TAKE,
      include: {
        status: { select: { name: true } },
        assignee: { select: { id: true, name: true } },
        reporter: { select: { name: true } },
        list: { select: { name: true } },
      },
    });

    const tasks: ReportTask[] = [];
    for (const row of rows) {
      const space = spaceById.get(row.spaceId);
      if (!space || !row.status || !row.list || !row.reporter) continue;
      tasks.push({
        id: row.id,
        code: row.code,
        title: row.title,
        priority: row.priority,
        dueAt: row.dueAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        statusName: row.status.name,
        assigneeId: row.assignee?.id ?? null,
        assigneeName: row.assignee?.name ?? null,
        reporterName: row.reporter.name,
        workspaceId: space.workspace.id,
        workspaceName: space.workspace.name,
        spaceId: space.id,
        spaceName: space.name,
        listName: row.list.name,
      });
    }
    return tasks;
  }
}
