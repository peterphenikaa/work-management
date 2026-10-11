import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types.js';
import { statusBucket } from '../common/status-bucket.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;
const VN_OFFSET = 7 * 60 * 60 * 1000;

function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Gửi thông báo cho người khác; không bao giờ làm hỏng luồng nghiệp vụ chính.
  async notify(input: {
    userIds: (string | null | undefined)[];
    actorId: string;
    workspaceId: string;
    spaceId: string;
    taskId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
  }) {
    const userIds = [...new Set(input.userIds.filter((id): id is string => Boolean(id) && id !== input.actorId))];
    if (userIds.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          workspaceId: input.workspaceId,
          spaceId: input.spaceId,
          taskId: input.taskId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
        })),
      });
    } catch (error) {
      this.logger.warn(`Không tạo được thông báo: ${String(error)}`);
    }
  }

  async list(actor: AuthUser, workspaceId: string) {
    const spaceIds = await this.visibleSpaceIds(actor, workspaceId);
    await this.generateDeadlines(actor.id, workspaceId, spaceIds);

    const rows = await this.prisma.notification.findMany({
      where: { userId: actor.id, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // BR-M06: chỉ trả thông báo của công việc mà người dùng vẫn còn quyền truy cập.
    const taskIds = rows.flatMap((row) => (row.taskId ? [row.taskId] : []));
    const reachable = new Set(
      (
        await this.prisma.task.findMany({
          where: { id: { in: taskIds }, deletedAt: null, spaceId: { in: spaceIds } },
          select: { id: true },
        })
      ).map((task) => task.id),
    );
    const items = rows
      .filter((row) => !row.taskId || reachable.has(row.taskId))
      .map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        taskId: row.taskId,
        spaceId: row.spaceId,
        read: row.readAt !== null,
        createdAt: row.createdAt.toISOString(),
      }));
    return { items, unread: items.filter((item) => !item.read).length };
  }

  async markRead(actor: AuthUser, workspaceId: string, id: string) {
    await this.visibleSpaceIds(actor, workspaceId);
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: actor.id, workspaceId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId: actor.id, workspaceId } });
      if (!exists) throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { ok: true };
  }

  // Hộp thư của chính người dùng, dùng cho chuông của Leader và Admin.
  async inbox(actor: AuthUser) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId: actor.id, status: 'ACTIVE', workspace: { deletedAt: null } },
      select: { workspaceId: true, workspace: { select: { name: true } } },
    });
    const names = new Map(memberships.map((row) => [row.workspaceId, row.workspace.name]));
    if (names.size === 0) return { items: [], unread: 0 };
    const rows = await this.prisma.notification.findMany({
      where: { userId: actor.id, workspaceId: { in: [...names.keys()] } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const items = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      taskId: row.taskId,
      spaceId: row.spaceId,
      workspaceId: row.workspaceId,
      workspaceName: names.get(row.workspaceId) ?? '',
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, unread: items.filter((item) => !item.read).length };
  }

  async markOwnRead(actor: AuthUser, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId: actor.id } });
      if (!exists) throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { ok: true };
  }

  async markAllOwnRead(actor: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(actor: AuthUser, workspaceId: string) {
    await this.visibleSpaceIds(actor, workspaceId);
    await this.prisma.notification.updateMany({
      where: { userId: actor.id, workspaceId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  // Cảnh báo hạn chót sinh theo yêu cầu, chống trùng bằng dedupeKey (mỗi mốc một thông báo).
  private async generateDeadlines(userId: string, workspaceId: string, spaceIds: string[]) {
    const today = utcDay(new Date(Date.now() + VN_OFFSET));
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        deletedAt: null,
        spaceId: { in: spaceIds },
        dueAt: { not: null, lt: new Date(today + 3 * DAY + 12 * 60 * 60 * 1000) },
      },
      include: { status: { select: { name: true } } },
    });
    const data: Prisma.NotificationCreateManyInput[] = [];
    for (const task of tasks) {
      if (!task.dueAt || statusBucket(task.status.name) === 'DONE') continue;
      const dueDay = utcDay(task.dueAt);
      const diff = Math.round((dueDay - today) / DAY);
      const dayKey = new Date(dueDay).toISOString().slice(0, 10);
      const base = { userId, workspaceId, spaceId: task.spaceId, taskId: task.id, type: 'DEADLINE' as const, body: task.title };
      if (diff < 0) {
        data.push({ ...base, title: `${task.code} đã quá hạn`, dedupeKey: `overdue:${task.id}:${dayKey}` });
      } else if (diff === 0) {
        data.push({ ...base, title: `${task.code} đến hạn hôm nay`, dedupeKey: `due0:${task.id}:${dayKey}` });
      } else if (diff <= 2) {
        data.push({ ...base, title: `${task.code} sắp đến hạn (${diff} ngày nữa)`, dedupeKey: `soon:${task.id}:${dayKey}` });
      }
    }
    if (data.length > 0) {
      try {
        await this.prisma.notification.createMany({ data, skipDuplicates: true });
      } catch (error) {
        this.logger.warn(`Không tạo được cảnh báo hạn: ${String(error)}`);
      }
    }
  }

  private async visibleSpaceIds(actor: AuthUser, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({ where: { id: workspaceId, deletedAt: null }, select: { id: true } });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
    let scope: Prisma.SpaceWhereInput = {};
    if (actor.role !== 'ADMIN') {
      const member = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: actor.id } },
      });
      if (!member || member.status !== 'ACTIVE') throw new ForbiddenException('Bạn không thuộc workspace này');
      if (member.role === 'MEMBER') {
        scope = { OR: [{ accessType: 'PUBLIC' }, { members: { some: { userId: actor.id } } }] };
      }
    }
    const spaces = await this.prisma.space.findMany({
      where: { workspaceId, deletedAt: null, ...scope },
      select: { id: true },
    });
    return spaces.map((space) => space.id);
  }
}
