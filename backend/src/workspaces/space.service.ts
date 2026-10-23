import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types.js';
import { statusBucket } from '../common/status-bucket.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from './notification.service.js';
import { CreateSpaceDto } from './dto/create-space.dto.js';
import { UpdateSpaceDto } from './dto/update-space.dto.js';
import { CreateListDto, UpdateListDto } from './dto/list.dto.js';
import { BulkUpdateTasksDto, CreateTaskDto, UpdateTaskDto } from './dto/task.dto.js';

const SPACE_DETAIL_INCLUDE = {
  workspace: { select: { name: true } },
  statuses: { orderBy: { position: 'asc' } },
  members: {
    include: { user: { select: { name: true, email: true } } },
    orderBy: { id: 'asc' },
  },
  lists: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    include: { tasks: { where: { deletedAt: null }, select: { id: true } } },
  },
  tasks: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    include: {
      assignee: { select: { name: true } },
      reporter: { select: { name: true } },
    },
  },
} satisfies Prisma.SpaceInclude;

type SpaceDetailRow = Prisma.SpaceGetPayload<{ include: typeof SPACE_DETAIL_INCLUDE }>;

@Injectable()
export class SpaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async list(actor: AuthUser, workspaceId: string) {
    const access = await this.requireMembership(actor, workspaceId);
    const rows = await this.prisma.space.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(actor.role === 'ADMIN' ? {} : { archivedAt: null }),
        ...access.scope,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { members: true, statuses: true } },
        lists: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        color: row.color,
        accessType: row.accessType,
        views: row.views,
        memberCount: row._count.members,
        statusCount: row._count.statuses,
        listCount: row.lists.length,
        archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async archive(actor: AuthUser, workspaceId: string, spaceId: string) {
    this.assertAdmin(actor);
    await this.requireWritableWorkspace(workspaceId);
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null },
    });
    if (!space) throw new NotFoundException('Không tìm thấy space');
    if (space.archivedAt) return { id: spaceId, archivedAt: space.archivedAt.toISOString() };
    const updated = await this.prisma.space.update({
      where: { id: spaceId },
      data: { archivedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'SPACE_ARCHIVE',
        targetType: 'SPACE',
        targetId: spaceId,
        result: 'SUCCESS',
        metadata: { workspaceId, name: space.name },
      },
    });
    return { id: spaceId, archivedAt: updated.archivedAt!.toISOString() };
  }

  async restore(actor: AuthUser, workspaceId: string, spaceId: string) {
    this.assertAdmin(actor);
    await this.requireWritableWorkspace(workspaceId);
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null },
    });
    if (!space) throw new NotFoundException('Không tìm thấy space');
    if (!space.archivedAt) return { id: spaceId, archivedAt: null };
    await this.prisma.space.update({
      where: { id: spaceId },
      data: { archivedAt: null },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'SPACE_RESTORE',
        targetType: 'SPACE',
        targetId: spaceId,
        result: 'SUCCESS',
        metadata: { workspaceId, name: space.name },
      },
    });
    return { id: spaceId, archivedAt: null };
  }

  async remove(actor: AuthUser, workspaceId: string, spaceId: string) {
    this.assertAdmin(actor);
    await this.requireWritableWorkspace(workspaceId);
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!space) throw new NotFoundException('Không tìm thấy space');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.space.update({ where: { id: spaceId }, data: { deletedAt: now } });
      await tx.workList.updateMany({
        where: { spaceId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.task.updateMany({
        where: { spaceId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'SPACE_DELETE',
          targetType: 'SPACE',
          targetId: spaceId,
          result: 'SUCCESS',
          metadata: { workspaceId, name: space.name },
        },
      });
    });
    return { ok: true };
  }

  async create(actor: AuthUser, workspaceId: string, dto: CreateSpaceDto) {
    await this.requireLeader(actor, workspaceId);

    const statuses = dto.statuses.map((name) => name.trim()).filter(Boolean);
    if (statuses.length === 0) {
      throw new BadRequestException('Cần ít nhất một trạng thái');
    }
    if (statuses.some((name) => name.length > 40)) {
      throw new BadRequestException('Tên trạng thái tối đa 40 ký tự');
    }
    if (new Set(statuses.map((name) => name.toLocaleLowerCase('vi'))).size !== statuses.length) {
      throw new BadRequestException('Trạng thái bị trùng tên');
    }

    const views = [...new Set(dto.views)];
    // Space công khai không gắn danh sách thành viên; mọi member workspace đều vào được.
    const memberIds = dto.accessType === 'PUBLIC' ? [] : [...new Set(dto.memberIds)];
    await this.assertSpaceMembers(workspaceId, memberIds, dto.accessType);

    const space = await this.prisma.$transaction(async (tx) => {
      const created = await tx.space.create({
        data: {
          workspaceId,
          name: dto.name,
          description: dto.description ?? null,
          icon: dto.icon,
          color: dto.color,
          accessType: dto.accessType,
          views,
          members: {
            create: memberIds.map((userId) => ({ userId })),
          },
          statuses: {
            create: statuses.map((name, position) => ({ name, position })),
          },
          // Mỗi space mới có sẵn 1 list mặc định để tạo task ngay.
          lists: {
            create: [{ name: 'List', position: 0 }],
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'SPACE_CREATE',
          targetType: 'SPACE',
          targetId: created.id,
          result: 'SUCCESS',
          metadata: { workspaceId, name: created.name },
        },
      });
      return created;
    });

    return {
      id: space.id,
      name: space.name,
      icon: space.icon,
      color: space.color,
    };
  }

  async update(actor: AuthUser, workspaceId: string, spaceId: string, dto: UpdateSpaceDto) {
    this.assertAdmin(actor);
    await this.requireWritableWorkspace(workspaceId);
    const current = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null },
      include: {
        statuses: {
          include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
        },
      },
    });
    if (!current) throw new NotFoundException('Không tìm thấy space');

    const statuses = dto.statuses.map((status) => ({ id: status.id, name: status.name.trim() }));
    if (statuses.some((status) => !status.name)) {
      throw new BadRequestException('Tên trạng thái không được để trống');
    }
    if (new Set(statuses.map((status) => status.name.toLocaleLowerCase('vi'))).size !== statuses.length) {
      throw new BadRequestException('Trạng thái bị trùng tên');
    }
    const known = new Map(current.statuses.map((status) => [status.id, status]));
    if (statuses.some((status) => status.id && !known.has(status.id))) {
      throw new BadRequestException('Trạng thái không thuộc space này');
    }
    const kept = new Set(statuses.flatMap((status) => (status.id ? [status.id] : [])));
    const removed = current.statuses.filter((status) => !kept.has(status.id));
    const blocked = removed.filter((status) => status._count.tasks > 0);
    if (blocked.length > 0) {
      throw new BadRequestException(
        `Không xóa được trạng thái đang có công việc: ${blocked.map((status) => status.name).join(', ')}`,
      );
    }

    const views = [...new Set(dto.views)];
    const memberIds = dto.accessType === 'PUBLIC' ? [] : [...new Set(dto.memberIds)];
    await this.assertSpaceMembers(workspaceId, memberIds, dto.accessType);

    await this.prisma.$transaction(async (tx) => {
      await tx.space.update({
        where: { id: spaceId },
        data: {
          name: dto.name,
          description: dto.description ?? null,
          icon: dto.icon,
          color: dto.color,
          accessType: dto.accessType,
          views,
        },
      });

      const members = await tx.spaceMember.findMany({ where: { spaceId }, select: { userId: true } });
      const currentIds = new Set(members.map((member) => member.userId));
      const nextIds = new Set(memberIds);
      const toRemove = [...currentIds].filter((userId) => !nextIds.has(userId));
      const toAdd = memberIds.filter((userId) => !currentIds.has(userId));
      if (toRemove.length > 0) {
        await tx.spaceMember.deleteMany({ where: { spaceId, userId: { in: toRemove } } });
      }
      if (toAdd.length > 0) {
        await tx.spaceMember.createMany({ data: toAdd.map((userId) => ({ spaceId, userId })) });
      }

      if (removed.length > 0) {
        await tx.spaceStatus.deleteMany({ where: { id: { in: removed.map((status) => status.id) } } });
      }
      for (const [position, status] of statuses.entries()) {
        if (status.id) {
          await tx.spaceStatus.update({ where: { id: status.id }, data: { name: status.name, position } });
        } else {
          await tx.spaceStatus.create({ data: { spaceId, name: status.name, position } });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'SPACE_UPDATE',
          targetType: 'SPACE',
          targetId: spaceId,
          result: 'SUCCESS',
          metadata: { workspaceId, name: dto.name },
        },
      });
    });

    return { id: spaceId, name: dto.name };
  }

  async get(actor: AuthUser, workspaceId: string, spaceId: string) {
    const access = await this.requireMembership(actor, workspaceId);
    const row = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        workspaceId,
        deletedAt: null,
        ...(actor.role === 'ADMIN' ? {} : { archivedAt: null }),
        ...access.scope,
      },
      include: SPACE_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Không tìm thấy space');
    const people = await this.workspacePeople(workspaceId);
    return this.presentSpace(row, people, access.role);
  }

  // Một lần gọi trả về mọi Space (kèm trạng thái, list, task) mà người dùng được xem.
  async detailedList(actor: AuthUser, workspaceId: string) {
    const access = await this.requireMembership(actor, workspaceId);
    const rows = await this.prisma.space.findMany({
      where: { workspaceId, deletedAt: null, archivedAt: null, ...access.scope },
      orderBy: { createdAt: 'asc' },
      include: SPACE_DETAIL_INCLUDE,
    });
    const people = await this.workspacePeople(workspaceId);
    return { items: rows.map((row) => this.presentSpace(row, people, access.role)) };
  }

  async updateSettings(
    actor: AuthUser,
    workspaceId: string,
    spaceId: string,
    dto: { memberCanCreateTask: boolean },
  ) {
    await this.requireLeader(actor, workspaceId);
    await this.requireSpace(workspaceId, spaceId);
    const updated = await this.prisma.space.update({
      where: { id: spaceId },
      data: { memberCanCreateTask: dto.memberCanCreateTask },
      select: { id: true, memberCanCreateTask: true },
    });
    return updated;
  }

  private async workspacePeople(workspaceId: string) {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      orderBy: { joinedAt: 'asc' },
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    });
    return rows.map((row) => ({
      userId: row.userId,
      role: row.role,
      name: row.user.name,
      email: row.user.email,
    }));
  }

  private presentSpace(
    row: SpaceDetailRow,
    people: { userId: string; role: string; name: string; email: string }[],
    viewerRole: 'ADMIN' | 'LEADER' | 'MEMBER',
  ) {
    const byId = new Map(people.map((person) => [person.userId, person]));
    // Space công khai: giao được cho mọi thành viên đang hoạt động của workspace.
    const roster =
      row.accessType === 'PUBLIC'
        ? people
        : row.members.map((member) => {
            const person = byId.get(member.userId);
            return {
              userId: member.userId,
              role: person?.role ?? 'MEMBER',
              name: member.user.name,
              email: member.user.email,
            };
          });
    const seen = new Set<string>();
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      accessType: row.accessType,
      views: row.views,
      memberCanCreateTask: row.memberCanCreateTask,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      workspaceName: row.workspace.name,
      statuses: row.statuses.map((status) => ({
        id: status.id,
        name: status.name,
        position: status.position,
      })),
      members: roster.flatMap((person) => {
        if (seen.has(person.userId)) return [];
        seen.add(person.userId);
        return [
          {
            userId: person.userId,
            name: person.name,
            email: viewerRole === 'MEMBER' ? '' : person.email,
            role: person.role,
          },
        ];
      }),
      lists: row.lists.map((list) => ({
        id: list.id,
        name: list.name,
        description: list.description,
        taskCount: list.tasks.length,
      })),
      tasks: row.tasks.map((task) => this.presentTask(task)),
    };
  }

  async createList(actor: AuthUser, workspaceId: string, spaceId: string, dto: CreateListDto) {
    await this.requireLeader(actor, workspaceId);
    await this.requireSpace(workspaceId, spaceId);
    const last = await this.prisma.workList.findFirst({
      where: { spaceId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const created = await this.prisma.workList.create({
      data: {
        spaceId,
        name: dto.name,
        description: dto.description,
        position: (last?.position ?? -1) + 1,
      },
    });
    return { id: created.id, name: created.name, description: created.description, taskCount: 0 };
  }

  async updateList(
    actor: AuthUser,
    workspaceId: string,
    spaceId: string,
    listId: string,
    dto: UpdateListDto,
  ) {
    this.assertAdmin(actor);
    const current = await this.requireList(workspaceId, spaceId, listId);
    const destinationId = dto.spaceId && dto.spaceId !== spaceId ? dto.spaceId : spaceId;
    if (destinationId !== spaceId) {
      const destination = await this.requireSpace(workspaceId, destinationId);
      const statuses = await this.prisma.spaceStatus.findMany({
        where: { spaceId: destinationId },
        orderBy: { position: 'asc' },
      });
      if (statuses.length === 0) {
        throw new BadRequestException('Space đích chưa có trạng thái');
      }
      const tasks = await this.prisma.task.findMany({
        where: { listId, deletedAt: null },
        include: { status: true },
      });
      await this.prisma.$transaction(async (tx) => {
        const last = await tx.workList.findFirst({
          where: { spaceId: destinationId, deletedAt: null },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        await tx.workList.update({
          where: { id: listId },
          data: {
            spaceId: destinationId,
            name: dto.name,
            description: dto.description ?? null,
            position: (last?.position ?? -1) + 1,
          },
        });
        for (const task of tasks) {
          const match = statuses.find(
            (status) => status.name.toLocaleLowerCase('vi') === task.status.name.toLocaleLowerCase('vi'),
          );
          await tx.task.update({
            where: { id: task.id },
            data: { spaceId: destinationId, statusId: (match ?? statuses[0]).id },
          });
        }
      });
      return { id: listId, spaceId: destination.id };
    }

    const updated = await this.prisma.workList.update({
      where: { id: current.id },
      data: { name: dto.name, description: dto.description ?? null },
    });
    return { id: updated.id, spaceId };
  }

  async createTask(actor: AuthUser, workspaceId: string, spaceId: string, dto: CreateTaskDto) {
    await this.requireWritableWorkspace(workspaceId);
    const access = await this.requireMembership(actor, workspaceId);
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null, ...access.scope },
    });
    if (!space) throw new NotFoundException('Không tìm thấy space');

    let reporterId = dto.reporterId ?? actor.id;
    if (access.role === 'MEMBER') {
      // BR-M07: chỉ tạo được khi Space bật quyền; Member luôn là người giao và chỉ tự nhận việc.
      if (!space.memberCanCreateTask) {
        throw new ForbiddenException('Space này không cho phép thành viên tạo công việc');
      }
      const joined = await this.prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId: actor.id } },
      });
      if (!joined) throw new ForbiddenException('Bạn chưa là thành viên của Space này');
      if (dto.assigneeId && dto.assigneeId !== actor.id) {
        throw new ForbiddenException('Bạn không có quyền giao việc cho người khác');
      }
      reporterId = actor.id;
    }

    await this.requireList(workspaceId, spaceId, dto.listId);
    const statusId = await this.resolveStatus(spaceId, dto.statusId);
    if (dto.assigneeId) await this.requireAssignable(workspaceId, spaceId, dto.assigneeId);
    await this.requireAssignable(workspaceId, spaceId, reporterId);
    const dueAt = this.requireFutureDue(dto.dueAt);
    const startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (startAt && Number.isNaN(startAt.getTime())) throw new BadRequestException('Ngày bắt đầu không hợp lệ');
    const created = await this.prisma.$transaction(async (tx) => {
      const count = await tx.task.count({ where: { spaceId } });
      const last = await tx.task.findFirst({
        where: { listId: dto.listId, deletedAt: null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      return tx.task.create({
        data: {
          spaceId,
          listId: dto.listId,
          code: `${codePrefix(space.name)}-${count + 1}`,
          title: dto.title,
          description: dto.description,
          statusId,
          priority: dto.priority ?? 'MEDIUM',
          assigneeId: dto.assigneeId,
          reporterId,
          dueAt,
          startAt,
          storyPoints: dto.storyPoints ?? null,
          position: (last?.position ?? -1) + 1,
        },
        include: {
          assignee: { select: { name: true } },
          reporter: { select: { name: true } },
        },
      });
    });
    if (created.assigneeId) {
      await this.notifications.notify({
        userIds: [created.assigneeId],
        actorId: actor.id,
        workspaceId,
        spaceId,
        taskId: created.id,
        type: 'ASSIGNED',
        title: `${actor.name} đã giao cho bạn ${created.code}`,
        body: created.title,
      });
    }
    return this.presentTask(created);
  }

  async updateTask(
    actor: AuthUser,
    workspaceId: string,
    spaceId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    await this.requireWritableWorkspace(workspaceId);
    const access = await this.requireMembership(actor, workspaceId);
    if (access.role === 'MEMBER') {
      // BR-M01/M04: Member chỉ được đổi trạng thái, không sửa nội dung hay người phụ trách.
      const touched = Object.entries(dto).filter(([, value]) => value !== undefined);
      if (!dto.statusId || touched.some(([key]) => key !== 'statusId')) {
        throw new ForbiddenException('Thành viên chỉ được cập nhật trạng thái công việc');
      }
    }
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        spaceId,
        deletedAt: null,
        space: { workspaceId, deletedAt: null, ...access.scope },
      },
      include: {
        status: { select: { name: true } },
        checks: { select: { done: true } },
        _count: { select: { attachments: true } },
      },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    if (access.role === 'MEMBER' && task.assigneeId !== actor.id) {
      throw new ForbiddenException('Thành viên chỉ được chuyển trạng thái công việc được giao cho mình');
    }
    const listId = dto.listId ?? task.listId;
    if (listId !== task.listId) await this.requireList(workspaceId, spaceId, listId);
    const statusId = dto.statusId ? await this.resolveStatus(spaceId, dto.statusId) : task.statusId;
    const nextAssignee = dto.assigneeId === undefined ? task.assigneeId : dto.assigneeId;
    if (dto.assigneeId) await this.requireAssignable(workspaceId, spaceId, dto.assigneeId);
    if (dto.reporterId) await this.requireAssignable(workspaceId, spaceId, dto.reporterId);
    if (dto.sprintId) {
      const sprint = await this.prisma.sprint.findFirst({ where: { id: dto.sprintId, spaceId } });
      if (!sprint) throw new BadRequestException('Sprint không thuộc space này');
      if (sprint.status === 'CLOSED') throw new BadRequestException('Sprint đã đóng');
    }
    const nextDue =
      dto.dueAt === undefined ? undefined : dto.dueAt === null || dto.dueAt === '' ? null : this.requireFutureDue(dto.dueAt);
    const nextStart =
      dto.startAt === undefined
        ? undefined
        : dto.startAt === null || dto.startAt === ''
          ? null
          : (() => {
              const date = new Date(dto.startAt);
              if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày bắt đầu không hợp lệ');
              return date;
            })();

    let nextStatusName = task.status.name;
    if (dto.statusId && statusId !== task.statusId) {
      const nextStatus = await this.prisma.spaceStatus.findFirst({ where: { id: statusId, spaceId } });
      if (!nextStatus) throw new BadRequestException('Trạng thái không hợp lệ');
      nextStatusName = nextStatus.name;
      await this.assertStatusTransition({
        from: task.status.name,
        to: nextStatus.name,
        assigneeId: nextAssignee,
        attachmentCount: task._count.attachments,
        checks: task.checks,
      });
    }

    const toDone = statusBucket(nextStatusName) === 'DONE';
    const fromDone = statusBucket(task.status.name) === 'DONE';
    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        listId,
        title: dto.title ?? task.title,
        description: dto.description === undefined ? task.description : dto.description,
        statusId,
        priority: dto.priority ?? task.priority,
        assigneeId: nextAssignee,
        reporterId: dto.reporterId ?? task.reporterId,
        dueAt: nextDue === undefined ? task.dueAt : nextDue,
        startAt: nextStart === undefined ? task.startAt : nextStart,
        storyPoints: dto.storyPoints === undefined ? task.storyPoints : dto.storyPoints,
        sprintId: dto.sprintId === undefined ? task.sprintId : dto.sprintId,
        completedAt: toDone ? (task.completedAt ?? new Date()) : fromDone && !toDone ? null : task.completedAt,
      },
      include: {
        assignee: { select: { name: true } },
        reporter: { select: { name: true } },
        status: { select: { name: true } },
      },
    });

    await this.recordChanges(actor, workspaceId, task, updated);
    if (toDone && !fromDone) {
      await this.notifications.notify({
        ...{ actorId: actor.id, workspaceId, spaceId, taskId: task.id },
        userIds: [updated.reporterId, updated.assigneeId],
        type: 'STATUS',
        title: `${actor.name} đã hoàn thành ${task.code}`,
        body: task.title,
      });
    }
    if (statusBucket(nextStatusName) === 'REVIEW' && statusBucket(task.status.name) !== 'REVIEW') {
      await this.notifications.notify({
        actorId: actor.id,
        workspaceId,
        spaceId,
        taskId: task.id,
        userIds: [updated.reporterId],
        type: 'REVIEW',
        title: `${actor.name} gửi ${task.code} để đánh giá`,
        body: task.title,
      });
    }
    return this.presentTask(updated);
  }

  async bulkUpdateTasks(actor: AuthUser, workspaceId: string, spaceId: string, dto: BulkUpdateTasksDto) {
    await this.requireWritableWorkspace(workspaceId);
    await this.requireLeader(actor, workspaceId);
    if (dto.taskIds.length === 0) throw new BadRequestException('Chưa chọn công việc');
    const results = [];
    for (const taskId of dto.taskIds) {
      const patch: UpdateTaskDto = {};
      if (dto.statusId !== undefined) patch.statusId = dto.statusId;
      if (dto.assigneeId !== undefined) patch.assigneeId = dto.assigneeId;
      if (dto.sprintId !== undefined) patch.sprintId = dto.sprintId;
      results.push(await this.updateTask(actor, workspaceId, spaceId, taskId, patch));
    }
    return { items: results };
  }

  private async assertStatusTransition(input: {
    from: string;
    to: string;
    assigneeId: string | null;
    attachmentCount: number;
    checks: { done: boolean }[];
  }) {
    const from = statusBucket(input.from);
    const to = statusBucket(input.to);
    if (from === to) return;
    if (to === 'IN_PROGRESS' && !input.assigneeId) {
      throw new BadRequestException('Cần gán người thực hiện trước khi chuyển sang Đang làm');
    }
    if (to === 'REVIEW' && input.attachmentCount === 0) {
      throw new BadRequestException('Cần đính kèm kết quả/link trước khi gửi Review');
    }
    if (to === 'DONE') {
      if (input.checks.length === 0) {
        throw new BadRequestException('Cần có checklist và hoàn thành 100% trước khi đánh dấu xong');
      }
      if (input.checks.some((row) => !row.done)) {
        throw new BadRequestException('Checklist phải hoàn thành 100% trước khi chuyển sang Hoàn thành');
      }
    }
  }

  // Ghi lịch sử hoạt động và gửi thông báo khi đổi trạng thái hoặc giao việc.
  private async recordChanges(
    actor: AuthUser,
    workspaceId: string,
    before: { id: string; spaceId: string; code: string; title: string; statusId: string; assigneeId: string | null; reporterId: string; status: { name: string } },
    after: { statusId: string; assigneeId: string | null; reporterId: string; assignee: { name: string } | null; status: { name: string } },
  ) {
    const events: string[] = [];
    if (after.statusId !== before.statusId) {
      events.push(`đã chuyển trạng thái từ "${before.status.name}" sang "${after.status.name}"`);
    }
    if (after.assigneeId !== before.assigneeId) {
      events.push(after.assignee ? `đã giao việc cho ${after.assignee.name}` : 'đã bỏ người thực hiện');
    }
    if (events.length === 0) return;
    try {
      await this.prisma.taskComment.createMany({
        data: events.map((body) => ({ taskId: before.id, authorId: actor.id, kind: 'EVENT', body })),
      });
    } catch {
      // Lịch sử là phần phụ, không chặn cập nhật chính.
    }
    const common = { actorId: actor.id, workspaceId, spaceId: before.spaceId, taskId: before.id };
    if (after.statusId !== before.statusId) {
      const review = statusBucket(after.status.name) === 'REVIEW';
      const watchers = await this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE', role: { in: ['LEADER', 'ADMIN'] } },
        select: { userId: true },
      });
      await this.notifications.notify({
        ...common,
        userIds: [
          ...(review ? [after.reporterId] : [after.assigneeId, after.reporterId]),
          ...watchers.map((watcher) => watcher.userId),
        ],
        type: review ? 'REVIEW' : 'STATUS',
        title: review
          ? `${actor.name} gửi ${before.code} để đánh giá`
          : `${actor.name} chuyển ${before.code} sang "${after.status.name}"`,
        body: before.title,
      });
    }
    if (after.assigneeId && after.assigneeId !== before.assigneeId) {
      await this.notifications.notify({
        ...common,
        userIds: [after.assigneeId],
        type: 'ASSIGNED',
        title: `${actor.name} đã giao cho bạn ${before.code}`,
        body: before.title,
      });
    }
  }

  async removeTask(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string) {
    await this.requireWritableWorkspace(workspaceId);
    await this.requireLeader(actor, workspaceId);
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        spaceId,
        deletedAt: null,
        space: { workspaceId, deletedAt: null },
      },
      select: { id: true, code: true, title: true },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'TASK_DELETE',
          targetType: 'TASK',
          targetId: taskId,
          result: 'SUCCESS',
          metadata: { workspaceId, spaceId, code: task.code, title: task.title },
        },
      });
    });
    return { ok: true };
  }

  async requireTaskAccess(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string) {
    const access = await this.requireMembership(actor, workspaceId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, spaceId, deletedAt: null, space: { workspaceId, deletedAt: null, ...access.scope } },
      include: { space: { select: { accessType: true } }, status: { select: { name: true } } },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return { access, task };
  }

  private presentTask(task: {
    id: string;
    listId: string;
    code: string;
    title: string;
    description: string | null;
    statusId: string;
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
    assigneeId: string | null;
    reporterId: string;
    dueAt: Date | null;
    startAt?: Date | null;
    storyPoints?: number | null;
    completedAt?: Date | null;
    sprintId: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignee: { name: string } | null;
    reporter: { name: string };
  }) {
    return {
      id: task.id,
      listId: task.listId,
      code: task.code,
      title: task.title,
      description: task.description,
      statusId: task.statusId,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.name ?? null,
      reporterId: task.reporterId,
      reporterName: task.reporter.name,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      startAt: task.startAt ? task.startAt.toISOString() : null,
      storyPoints: task.storyPoints ?? null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      sprintId: task.sprintId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async requireSpace(workspaceId: string, spaceId: string) {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null, archivedAt: null },
    });
    if (!space) throw new NotFoundException('Không tìm thấy space');
    return space;
  }

  private requireFutureDue(raw?: string | null) {
    if (!raw) return null;
    const due = new Date(raw);
    if (Number.isNaN(due.getTime())) throw new BadRequestException('Hạn chót không hợp lệ');
    if (due.getTime() <= Date.now()) throw new BadRequestException('Hạn chót phải là thời điểm trong tương lai');
    return due;
  }

  private async requireList(workspaceId: string, spaceId: string, listId: string) {
    const list = await this.prisma.workList.findFirst({
      where: { id: listId, spaceId, deletedAt: null, space: { workspaceId, deletedAt: null } },
    });
    if (!list) throw new NotFoundException('Không tìm thấy list');
    return list;
  }

  private async resolveStatus(spaceId: string, statusId?: string) {
    if (statusId) {
      const status = await this.prisma.spaceStatus.findFirst({ where: { id: statusId, spaceId } });
      if (!status) throw new BadRequestException('Trạng thái không thuộc space này');
      return status.id;
    }
    const first = await this.prisma.spaceStatus.findFirst({
      where: { spaceId },
      orderBy: { position: 'asc' },
    });
    if (!first) throw new BadRequestException('Space chưa có trạng thái');
    return first.id;
  }

  // Space công khai giao cho mọi thành viên workspace. Space riêng tư chỉ giao cho thành viên của Space.
  private async requireAssignable(workspaceId: string, spaceId: string, userId: string) {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null },
      select: { accessType: true },
    });
    if (!space) throw new NotFoundException('Không tìm thấy space');
    if (space.accessType === 'PUBLIC') {
      const member = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
      if (!member || member.status !== 'ACTIVE') {
        throw new BadRequestException('Người được chọn không thuộc workspace');
      }
      return;
    }
    const member = await this.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
    });
    if (!member) throw new BadRequestException('Người thực hiện không thuộc space này');
  }

  private async assertSpaceMembers(workspaceId: string, memberIds: string[], accessType: 'PRIVATE' | 'PUBLIC') {
    if (accessType === 'PUBLIC') return;
    if (memberIds.length === 0) {
      throw new BadRequestException('Space riêng tư cần ít nhất một Trưởng nhóm hoặc Thành viên');
    }
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE', userId: { in: memberIds } },
      select: { userId: true, role: true },
    });
    if (memberships.length !== memberIds.length) {
      throw new BadRequestException('Có thành viên không thuộc Workspace');
    }
    const eligible = memberships.some((row) => row.role === 'LEADER' || row.role === 'MEMBER');
    if (!eligible) {
      throw new BadRequestException('Space riêng tư cần ít nhất một Trưởng nhóm hoặc Thành viên');
    }
  }

  async requireLeader(actor: AuthUser, workspaceId: string) {
    await this.requireWritableWorkspace(workspaceId);
    if (actor.role === 'ADMIN') return;
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actor.id } },
    });
    if (!member || member.status !== 'ACTIVE' || (member.role !== 'LEADER' && member.role !== 'ADMIN')) {
      throw new ForbiddenException('Chỉ trưởng nhóm mới thay đổi được nội dung này');
    }
  }

  // Trả về vai trò trong workspace và điều kiện lọc Space mà người dùng được nhìn thấy.
  // Member thường chỉ thấy Space PUBLIC hoặc Space mình là thành viên (BR-M02).
  async requireMembership(
    actor: AuthUser,
    workspaceId: string,
  ): Promise<{ role: 'ADMIN' | 'LEADER' | 'MEMBER'; scope: Prisma.SpaceWhereInput }> {
    await this.requireWorkspace(workspaceId);
    if (actor.role === 'ADMIN') return { role: 'ADMIN', scope: {} };
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actor.id } },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenException('Bạn không thuộc workspace này');
    }
    if (member.role === 'MEMBER') {
      return {
        role: 'MEMBER',
        scope: { OR: [{ accessType: 'PUBLIC' }, { members: { some: { userId: actor.id } } }] },
      };
    }
    return { role: member.role === 'ADMIN' ? 'ADMIN' : 'LEADER', scope: {} };
  }

  private async requireWorkspace(id: string, mode: 'read' | 'write' = 'read') {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
    if (mode === 'write' && workspace.status === 'ARCHIVED') {
      throw new BadRequestException('Workspace đã lưu trữ, không thể chỉnh sửa nội dung');
    }
  }

  async requireWritableWorkspace(id: string) {
    await this.requireWorkspace(id, 'write');
  }

  private assertAdmin(actor: AuthUser) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ quản trị viên xem được danh sách workspace.');
    }
  }
}

function codePrefix(name: string) {
  const plain = name.normalize('NFD').replace(/\p{M}/gu, '');
  const letters = plain
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return letters || 'NS';
}
