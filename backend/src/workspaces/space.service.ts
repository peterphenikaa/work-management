import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSpaceDto } from './dto/create-space.dto.js';
import { UpdateSpaceDto } from './dto/update-space.dto.js';
import { CreateListDto, UpdateListDto } from './dto/list.dto.js';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto.js';

@Injectable()
export class SpaceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, workspaceId: string) {
    this.assertAdmin(actor);
    await this.requireWorkspace(workspaceId);
    const rows = await this.prisma.space.findMany({
      where: { workspaceId, deletedAt: null },
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
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async create(actor: AuthUser, workspaceId: string, dto: CreateSpaceDto) {
    this.assertAdmin(actor);
    await this.requireWorkspace(workspaceId);

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
    const memberIds = [...new Set(dto.memberIds)];
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
    await this.requireWorkspace(workspaceId);
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
    const memberIds = [...new Set(dto.memberIds)];
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
    this.assertAdmin(actor);
    await this.requireWorkspace(workspaceId);
    const row = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null },
      include: {
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
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy space');

    const roles = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        userId: { in: row.members.map((member) => member.userId) },
      },
      select: { userId: true, role: true },
    });
    const roleByUser = new Map(roles.map((role) => [role.userId, role.role]));

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      accessType: row.accessType,
      views: row.views,
      workspaceName: row.workspace.name,
      statuses: row.statuses.map((status) => ({
        id: status.id,
        name: status.name,
        position: status.position,
      })),
      members: row.members.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: roleByUser.get(member.userId) ?? 'MEMBER',
      })),
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
    this.assertAdmin(actor);
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
    this.assertAdmin(actor);
    const space = await this.requireSpace(workspaceId, spaceId);
    await this.requireList(workspaceId, spaceId, dto.listId);
    const statusId = await this.resolveStatus(spaceId, dto.statusId);
    if (dto.assigneeId) await this.requireMember(spaceId, dto.assigneeId);
    const reporterId = dto.reporterId ?? actor.id;
    await this.requireMember(spaceId, reporterId);
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
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          position: (last?.position ?? -1) + 1,
        },
        include: {
          assignee: { select: { name: true } },
          reporter: { select: { name: true } },
        },
      });
    });
    return this.presentTask(created);
  }

  async updateTask(
    actor: AuthUser,
    workspaceId: string,
    spaceId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    this.assertAdmin(actor);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, spaceId, deletedAt: null, space: { workspaceId, deletedAt: null } },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    const listId = dto.listId ?? task.listId;
    if (listId !== task.listId) await this.requireList(workspaceId, spaceId, listId);
    const statusId = dto.statusId ? await this.resolveStatus(spaceId, dto.statusId) : task.statusId;
    if (dto.assigneeId) await this.requireMember(spaceId, dto.assigneeId);
    if (dto.reporterId) await this.requireMember(spaceId, dto.reporterId);
    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        listId,
        title: dto.title ?? task.title,
        description: dto.description === undefined ? task.description : dto.description,
        statusId,
        priority: dto.priority ?? task.priority,
        assigneeId: dto.assigneeId === undefined ? task.assigneeId : dto.assigneeId,
        reporterId: dto.reporterId ?? task.reporterId,
        dueAt: dto.dueAt === undefined ? task.dueAt : dto.dueAt ? new Date(dto.dueAt) : null,
      },
      include: {
        assignee: { select: { name: true } },
        reporter: { select: { name: true } },
      },
    });
    return this.presentTask(updated);
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
    createdAt: Date;
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
      createdAt: task.createdAt.toISOString(),
    };
  }

  private async requireSpace(workspaceId: string, spaceId: string) {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, workspaceId, deletedAt: null },
    });
    if (!space) throw new NotFoundException('Không tìm thấy space');
    return space;
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

  private async requireMember(spaceId: string, userId: string) {
    const member = await this.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
    });
    if (!member) throw new BadRequestException('Người thực hiện không thuộc space này');
  }

  private async assertSpaceMembers(workspaceId: string, memberIds: string[], accessType: 'PRIVATE' | 'PUBLIC') {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE', userId: { in: memberIds } },
      select: { userId: true, role: true },
    });
    if (memberships.length !== memberIds.length) {
      throw new BadRequestException('Có thành viên không thuộc Workspace');
    }
    if (accessType === 'PRIVATE') {
      const eligible = memberships.some((row) => row.role === 'LEADER' || row.role === 'MEMBER');
      if (!eligible) {
        throw new BadRequestException('Space riêng tư cần ít nhất một Trưởng nhóm hoặc Thành viên');
      }
    }
  }

  private async requireWorkspace(id: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
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
