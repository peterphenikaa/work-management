import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types.js';
import { buildWorkspaceOverview } from './workspace.overview.js';
import type { InviteMemberDto } from './dto/invitation.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import type { DeleteWorkspaceDto } from './dto/delete-workspace.dto.js';
import type { ListWorkspacesQuery } from './dto/list-workspaces.query.js';
import type { UpdatePersonDto } from './dto/update-person.dto.js';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';

const workspaceInclude = {
  owner: { select: { id: true, name: true } },
  _count: { select: { members: { where: { status: 'ACTIVE' as const } } } },
} satisfies Prisma.WorkspaceInclude;

type WorkspaceRow = Prisma.WorkspaceGetPayload<{ include: typeof workspaceInclude }>;
type WorkspaceRole = 'ADMIN' | 'LEADER' | 'MEMBER';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, query: ListWorkspacesQuery) {
    this.assertAdmin(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sort = query.sort ?? 'createdAt';
    const order = query.order ?? (sort === 'name' ? 'asc' : 'desc');
    const q = query.q?.trim();

    const where: Prisma.WorkspaceWhereInput = {
      deletedAt: null,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(query.accessType ? { accessType: query.accessType } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const orderBy: Prisma.WorkspaceOrderByWithRelationInput =
      sort === 'name'
        ? { name: order }
        : sort === 'memberCount'
          ? { members: { _count: order } }
          : { createdAt: order };

    const [total, rows] = await Promise.all([
      this.prisma.workspace.count({ where }),
      this.prisma.workspace.findMany({
        where,
        include: workspaceInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row)),
      page,
      pageSize,
      total,
    };
  }

  async create(actor: AuthUser, dto: CreateWorkspaceDto) {
    this.assertAdmin(actor);
    // Chủ sở hữu luôn là người tạo, không nhận ownerId từ client.
    const ownerId = actor.id;

    const extras = new Map<string, 'ADMIN' | 'LEADER' | 'MEMBER'>();
    for (const member of dto.initialMembers ?? []) {
      if (member.userId === ownerId) continue;
      if (extras.has(member.userId)) {
        throw new BadRequestException('Danh sách thành viên ban đầu bị trùng');
      }
      extras.set(member.userId, member.role);
    }

    if (extras.size > 0) {
      const found = await this.prisma.user.findMany({
        where: { id: { in: [...extras.keys()] } },
        select: { id: true },
      });
      if (found.length !== extras.size) {
        throw new BadRequestException('Có thành viên không tồn tại');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
          accessType: dto.accessType,
          status: dto.status ?? 'ACTIVE',
          ownerId,
          members: {
            create: [
              { userId: ownerId, role: 'ADMIN', status: 'ACTIVE' },
              ...[...extras.entries()].map(([userId, role]) => ({
                userId,
                role,
                status: 'ACTIVE' as const,
              })),
            ],
          },
        },
        include: workspaceInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'WORKSPACE_CREATE',
          targetType: 'WORKSPACE',
          targetId: workspace.id,
          result: 'SUCCESS',
          metadata: { name: workspace.name, accessType: workspace.accessType },
        },
      });

      if (dto.invites?.length) {
        await this.writeInvites(tx, {
          workspaceId: workspace.id,
          ownerId,
          actorId: actor.id,
          invites: dto.invites,
        });
      }

      return workspace;
    });

    return this.toItem(created);
  }

  async update(actor: AuthUser, id: string, dto: UpdateWorkspaceDto) {
    this.assertAdmin(actor);
    const current = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Không tìm thấy workspace');

    if (current.updatedAt.toISOString() !== new Date(dto.updatedAt).toISOString()) {
      throw new ConflictException('Workspace đã được người khác cập nhật. Hãy tải lại.');
    }

    const data: Prisma.WorkspaceUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.accessType !== undefined) data.accessType = dto.accessType;
    if (dto.status !== undefined) data.status = dto.status;

    let nextOwnerId = current.ownerId;
    if (dto.ownerId !== undefined && dto.ownerId !== current.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
        select: { id: true },
      });
      if (!owner) throw new BadRequestException('Chủ sở hữu không tồn tại');
      data.owner = { connect: { id: dto.ownerId } };
      nextOwnerId = dto.ownerId;
    }

    const memberPlan = dto.members ? this.planMembers(dto.members, nextOwnerId) : null;
    if (memberPlan) {
      const found = await this.prisma.user.findMany({
        where: { id: { in: [...memberPlan.keys()] } },
        select: { id: true },
      });
      if (found.length !== memberPlan.size) {
        throw new BadRequestException('Có thành viên không tồn tại');
      }
    }

    if (Object.keys(data).length === 0 && !memberPlan) {
      throw new BadRequestException('Không có thay đổi nào để lưu');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (memberPlan) {
        const existing = await tx.workspaceMember.findMany({ where: { workspaceId: id } });
        const pending = new Map(memberPlan);
        for (const row of existing) {
          const role = pending.get(row.userId);
          if (!role) {
            if (row.status !== 'REMOVED') {
              await tx.workspaceMember.update({
                where: { id: row.id },
                data: { status: 'REMOVED' },
              });
            }
          } else {
            if (row.role !== role || row.status !== 'ACTIVE') {
              await tx.workspaceMember.update({
                where: { id: row.id },
                data: { role, status: 'ACTIVE' },
              });
            }
            pending.delete(row.userId);
          }
        }
        for (const [userId, role] of pending) {
          await tx.workspaceMember.create({
            data: { workspaceId: id, userId, role, status: 'ACTIVE' },
          });
        }
      } else if (nextOwnerId !== current.ownerId) {
        await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: { workspaceId: id, userId: nextOwnerId },
          },
          create: { workspaceId: id, userId: nextOwnerId, role: 'ADMIN', status: 'ACTIVE' },
          update: { role: 'ADMIN', status: 'ACTIVE' },
        });
      }

      const workspace = await tx.workspace.update({
        where: { id },
        data,
        include: workspaceInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'WORKSPACE_UPDATE',
          targetType: 'WORKSPACE',
          targetId: id,
          result: 'SUCCESS',
          metadata: {
            before: { name: current.name, accessType: current.accessType, status: current.status },
            after: {
              name: workspace.name,
              accessType: workspace.accessType,
              status: workspace.status,
            },
          },
        },
      });

      return workspace;
    });

    return this.toItem(updated);
  }

  async remove(actor: AuthUser, id: string, dto: DeleteWorkspaceDto) {
    this.assertAdmin(actor);
    const current = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Không tìm thấy workspace');
    if (dto.confirmName !== current.name.trim()) {
      throw new BadRequestException('Tên xác nhận không khớp');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const spaces = await tx.space.findMany({
        where: { workspaceId: id, deletedAt: null },
        select: { id: true },
      });
      const spaceIds = spaces.map((space) => space.id);

      await tx.workspace.update({
        where: { id },
        data: { deletedAt: now },
      });
      if (spaceIds.length > 0) {
        await tx.space.updateMany({
          where: { id: { in: spaceIds }, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.workList.updateMany({
          where: { spaceId: { in: spaceIds }, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.task.updateMany({
          where: { spaceId: { in: spaceIds }, deletedAt: null },
          data: { deletedAt: now },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'WORKSPACE_DELETE',
          targetType: 'WORKSPACE',
          targetId: id,
          result: 'SUCCESS',
          metadata: { name: current.name, spaces: spaceIds.length },
        },
      });
    });

    return { ok: true };
  }

  async invitations(actor: AuthUser, workspaceId: string) {
    this.assertAdmin(actor);
    await this.requireWorkspace(workspaceId);
    await this.expireStaleInvites(workspaceId);
    const rows = await this.prisma.invitation.findMany({
      where: { workspaceId, status: 'PENDING' },
      orderBy: { invitedAt: 'asc' },
    });
    const names = await this.namesForEmails(rows.map((row) => row.email));
    return { items: rows.map((row) => this.toInvite(row, names.get(row.email) ?? null)) };
  }

  async myInvitations(actor: AuthUser) {
    await this.expireStaleInvites();
    const rows = await this.prisma.invitation.findMany({
      where: {
        email: { equals: actor.email, mode: 'insensitive' },
        status: 'PENDING',
        workspace: { deletedAt: null },
      },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { invitedAt: 'desc' },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        workspaceId: row.workspace.id,
        workspaceName: row.workspace.name,
        role: row.role,
        expiresAt: row.expiresAt.toISOString(),
      })),
    };
  }

  async invite(actor: AuthUser, workspaceId: string, dto: InviteMemberDto) {
    this.assertAdmin(actor);
    const workspace = await this.requireWorkspace(workspaceId);
    return this.issueInvite(this.prisma as unknown as Prisma.TransactionClient, {
      workspaceId: workspace.id,
      ownerId: workspace.ownerId,
      actorId: actor.id,
      email: dto.email,
      role: dto.role,
    });
  }

  async updateInvitation(actor: AuthUser, workspaceId: string, invitationId: string, role: WorkspaceRole) {
    this.assertAdmin(actor);
    await this.requireWorkspace(workspaceId);
    const current = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId, status: 'PENDING' },
    });
    if (!current || current.expiresAt <= new Date()) {
      throw new NotFoundException('Không tìm thấy lời mời đang chờ');
    }
    const updated = await this.prisma.invitation.update({
      where: { id: current.id },
      data: { role },
    });
    const names = await this.namesForEmails([updated.email]);
    return this.toInvite(updated, names.get(updated.email) ?? null);
  }

  async revokeInvitation(actor: AuthUser, workspaceId: string, invitationId: string) {
    this.assertAdmin(actor);
    await this.requireWorkspace(workspaceId);
    const current = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId, status: 'PENDING' },
    });
    if (!current) throw new NotFoundException('Không tìm thấy lời mời đang chờ');
    await this.prisma.invitation.update({
      where: { id: current.id },
      data: { status: 'REVOKED' },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'INVITATION_REVOKE',
        targetType: 'INVITATION',
        targetId: current.id,
        result: 'SUCCESS',
        metadata: { email: current.email, workspaceId },
      },
    });
    return { ok: true };
  }

  async acceptInvitation(actor: AuthUser, invitationId: string) {
    const current = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!current || current.email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }
    if (current.status !== 'PENDING') {
      throw new BadRequestException('Lời mời không còn hiệu lực');
    }
    if (current.expiresAt <= new Date()) {
      await this.prisma.invitation.update({
        where: { id: current.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Lời mời đã hết hạn');
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: { id: current.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!workspace) throw new BadRequestException('Workspace không còn nhận thành viên');

    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: actor.id } },
      });
      if (!membership || membership.status !== 'ACTIVE') {
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: workspace.id, userId: actor.id } },
          create: {
            workspaceId: workspace.id,
            userId: actor.id,
            role: current.role,
            status: 'ACTIVE',
          },
          update: { role: current.role, status: 'ACTIVE' },
        });
      }
      await tx.invitation.update({
        where: { id: current.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'INVITATION_ACCEPT',
          targetType: 'INVITATION',
          targetId: current.id,
          result: 'SUCCESS',
          metadata: { workspaceId: workspace.id, role: current.role },
        },
      });
    });

    return { ok: true };
  }

  async rejectInvitation(actor: AuthUser, invitationId: string) {
    const current = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!current || current.email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }
    if (current.status !== 'PENDING') {
      throw new BadRequestException('Lời mời không còn hiệu lực');
    }
    await this.prisma.invitation.update({
      where: { id: current.id },
      data: { status: 'REJECTED' },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'INVITATION_REJECT',
        targetType: 'INVITATION',
        targetId: current.id,
        result: 'SUCCESS',
        metadata: { workspaceId: current.workspaceId },
      },
    });
    return { ok: true };
  }

  async mine(actor: AuthUser) {
    const rows = await this.prisma.workspaceMember.findMany({
      where: {
        userId: actor.id,
        status: 'ACTIVE',
        workspace: { deletedAt: null, status: 'ACTIVE' },
      },
      include: { workspace: { include: workspaceInclude } },
      orderBy: { joinedAt: 'asc' },
    });
    return {
      items: rows.map((row) => ({
        id: row.workspace.id,
        name: row.workspace.name,
        description: row.workspace.description,
        icon: row.workspace.icon,
        hasIcon: Boolean(row.workspace.iconMime),
        role: row.role,
        memberCount: row.workspace._count.members,
      })),
    };
  }

  async overview(actor: AuthUser, id: string, period?: string, spaceId?: string) {
    const access = await this.requireMembership(actor, id);
    if (access.role === 'MEMBER') {
      throw new ForbiddenException('Thành viên không xem được báo cáo tổng quan của workspace');
    }
    return buildWorkspaceOverview(this.prisma, {
      workspaceId: access.workspace.id,
      workspaceName: access.workspace.name,
      role: access.role,
      period,
      spaceId,
    });
  }

  async setIcon(
    actor: AuthUser,
    id: string,
    file: { mimetype: string; size: number; buffer: Buffer },
  ) {
    this.assertAdmin(actor);
    await this.requireWorkspace(id);
    const mime = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
    if ((mime !== 'image/png' && mime !== 'image/jpeg') || file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Chỉ nhận PNG hoặc JPG, tối đa 2 MB');
    }

    const bytes = new Uint8Array(file.buffer.byteLength);
    bytes.set(file.buffer);
    await this.prisma.$transaction([
      this.prisma.workspace.update({ where: { id }, data: { iconMime: mime } }),
      this.prisma.workspaceIcon.upsert({
        where: { workspaceId: id },
        create: { workspaceId: id, data: bytes },
        update: { data: bytes },
      }),
    ]);
    return { ok: true };
  }

  async readIcon(actor: AuthUser, id: string) {
    await this.requireMembership(actor, id);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: { iconMime: true, iconFile: { select: { data: true } } },
    });
    if (!workspace?.iconMime || !workspace.iconFile) {
      throw new NotFoundException('Workspace chưa có biểu tượng');
    }
    return { mime: workspace.iconMime, data: Buffer.from(workspace.iconFile.data) };
  }

  async get(actor: AuthUser, id: string) {
    this.assertAdmin(actor);
    const row = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      include: workspaceInclude,
    });
    if (!row) throw new NotFoundException('Không tìm thấy workspace');
    const [spaceCount, listCount, taskCount] = await Promise.all([
      this.prisma.space.count({ where: { workspaceId: id, deletedAt: null } }),
      this.prisma.workList.count({
        where: { deletedAt: null, space: { workspaceId: id, deletedAt: null } },
      }),
      this.prisma.task.count({
        where: { deletedAt: null, space: { workspaceId: id, deletedAt: null } },
      }),
    ]);
    return { ...this.toItem(row), spaceCount, listCount, taskCount };
  }

  async activity(actor: AuthUser, id: string) {
    this.assertAdmin(actor);
    await this.requireWorkspace(id);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { targetType: 'WORKSPACE', targetId: id },
          { metadata: { path: ['workspaceId'], equals: id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const actors = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.actorId))] } },
      select: { id: true, name: true },
    });
    const names = new Map(actors.map((actorRow) => [actorRow.id, actorRow.name]));
    const labels: Record<string, string> = {
      WORKSPACE_CREATE: 'Tạo Workspace',
      WORKSPACE_UPDATE: 'Cập nhật Workspace',
      WORKSPACE_DELETE: 'Xóa Workspace',
      INVITATION_CREATE: 'Mời thành viên',
      INVITATION_ACCEPT: 'Thành viên tham gia',
      INVITATION_REVOKE: 'Thu hồi lời mời',
      SPACE_CREATE: 'Tạo Space',
      SPACE_UPDATE: 'Cập nhật Space',
    };
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        label: labels[row.action] ?? row.action,
        actorName: names.get(row.actorId) ?? 'Hệ thống',
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async people(actor: AuthUser) {
    this.assertAdmin(actor);
    const items = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, locked: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async updatePerson(actor: AuthUser, userId: string, dto: UpdatePersonDto) {
    this.assertAdmin(actor);
    if (dto.role === undefined && dto.locked === undefined) {
      throw new BadRequestException('Không có thay đổi');
    }
    if (actor.id === userId && dto.locked) {
      throw new BadRequestException('Không thể khóa tài khoản của chính bạn');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy thành viên');
    if (user.role === 'ADMIN' && (dto.role && dto.role !== 'ADMIN' || dto.locked)) {
      await this.assertAnotherAdmin(userId);
    }
    // Vai trò workspace (LEADER/MEMBER/…) quản lý riêng từng workspace — không sync từ User.role.
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.locked === undefined ? {} : { locked: dto.locked }),
      },
      select: { id: true, name: true, email: true, role: true, locked: true },
    });
    return updated;
  }

  async removePerson(actor: AuthUser, userId: string) {
    this.assertAdmin(actor);
    if (actor.id === userId) {
      throw new BadRequestException('Không thể xóa tài khoản của chính bạn');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy thành viên');
    if (user.role === 'ADMIN') await this.assertAnotherAdmin(userId);
    const owned = await this.prisma.workspace.count({ where: { ownerId: userId, deletedAt: null } });
    if (owned > 0) {
      throw new BadRequestException('Người này đang sở hữu workspace, hãy chuyển quyền trước khi xóa');
    }
    const reported = await this.prisma.task.count({ where: { reporterId: userId, deletedAt: null } });
    if (reported > 0) {
      throw new BadRequestException('Không xóa được vì người này còn công việc đã giao');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } });
      await tx.spaceMember.deleteMany({ where: { userId } });
      await tx.workspaceMember.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    return { id: userId };
  }

  private async assertAnotherAdmin(userId: string) {
    const admins = await this.prisma.user.count({
      where: { role: 'ADMIN', locked: false, id: { not: userId } },
    });
    if (admins === 0) {
      throw new BadRequestException('Cần giữ ít nhất một quản trị viên đang hoạt động');
    }
  }

  async members(actor: AuthUser, id: string) {
    const access = await this.requireMembership(actor, id);
    if (access.role === 'MEMBER') {
      throw new ForbiddenException('Thành viên không xem được danh sách thành viên workspace');
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: { ownerId: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');

    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: id, status: 'ACTIVE' },
      include: { user: { select: { name: true, email: true, locked: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      ownerId: workspace.ownerId,
      items: rows.map((row) => ({
        userId: row.userId,
        name: row.user.name,
        email: row.user.email,
        role: row.role,
        locked: row.user.locked,
        isOwner: row.userId === workspace.ownerId,
      })),
    };
  }

  async updateMember(actor: AuthUser, workspaceId: string, userId: string, role: WorkspaceRole) {
    this.assertAdmin(actor);
    await this.requireWritableWorkspace(workspaceId);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
    if (userId === workspace.ownerId && role !== 'ADMIN') {
      throw new BadRequestException('Chủ sở hữu workspace phải giữ vai trò Quản trị viên');
    }
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Không tìm thấy thành viên trong workspace');
    }
    const updated = await this.prisma.workspaceMember.update({
      where: { id: membership.id },
      data: { role },
      include: { user: { select: { name: true, email: true, locked: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'MEMBER_ROLE_UPDATE',
        targetType: 'WORKSPACE_MEMBER',
        targetId: membership.id,
        result: 'SUCCESS',
        metadata: { workspaceId, userId, role },
      },
    });
    return {
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      locked: updated.user.locked,
      isOwner: updated.userId === workspace.ownerId,
    };
  }

  async removeMember(actor: AuthUser, workspaceId: string, userId: string) {
    this.assertAdmin(actor);
    await this.requireWritableWorkspace(workspaceId);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
    if (userId === workspace.ownerId) {
      throw new BadRequestException('Không thể gỡ chủ sở hữu khỏi workspace');
    }
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Không tìm thấy thành viên trong workspace');
    }
    await this.prisma.workspaceMember.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' },
    });
    await this.prisma.spaceMember.deleteMany({
      where: { userId, space: { workspaceId, deletedAt: null } },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'MEMBER_REMOVE',
        targetType: 'WORKSPACE_MEMBER',
        targetId: membership.id,
        result: 'SUCCESS',
        metadata: { workspaceId, userId },
      },
    });
    return { ok: true };
  }

  private async requireWritableWorkspace(id: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
    if (workspace.status === 'ARCHIVED') {
      throw new BadRequestException('Workspace đã lưu trữ, không thể chỉnh sửa nội dung');
    }
  }

  private async writeInvites(
    db: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      ownerId: string;
      actorId: string;
      invites: InviteMemberDto[];
    },
  ) {
    const seen = new Set<string>();
    for (const invite of input.invites) {
      if (seen.has(invite.email)) {
        throw new BadRequestException('Danh sách lời mời bị trùng');
      }
      seen.add(invite.email);
      await this.issueInvite(db, {
        workspaceId: input.workspaceId,
        ownerId: input.ownerId,
        actorId: input.actorId,
        email: invite.email,
        role: invite.role,
      });
    }
  }

  private async issueInvite(
    db: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      ownerId: string;
      actorId: string;
      email: string;
      role: WorkspaceRole;
    },
  ) {
    const owner = await db.user.findUnique({
      where: { id: input.ownerId },
      select: { email: true },
    });
    if (owner && owner.email.toLowerCase() === input.email) {
      throw new BadRequestException('Chủ sở hữu không cần lời mời');
    }

    const user = await db.user.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: user.id } },
    });
    if (membership?.status === 'ACTIVE') {
      throw new ConflictException('Người này đã là thành viên');
    }

    const pending = await db.invitation.findFirst({
      where: { workspaceId: input.workspaceId, email: input.email, status: 'PENDING' },
    });
    if (pending && pending.expiresAt > new Date()) {
      return this.toInvite(pending, user.name);
    }
    if (pending) {
      await db.invitation.update({ where: { id: pending.id }, data: { status: 'EXPIRED' } });
    }

    const created = await db.invitation.create({
      data: {
        email: input.email,
        workspaceId: input.workspaceId,
        role: input.role,
        token: randomBytes(32).toString('base64url'),
        status: 'PENDING',
        invitedBy: input.actorId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: 'INVITATION_CREATE',
        targetType: 'INVITATION',
        targetId: created.id,
        result: 'SUCCESS',
        metadata: { email: created.email, workspaceId: input.workspaceId, role: created.role },
      },
    });
    return this.toInvite(created, user.name);
  }

  private async requireWorkspace(id: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, ownerId: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
    return workspace;
  }

  private async expireStaleInvites(workspaceId?: string) {
    await this.prisma.invitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: { status: 'EXPIRED' },
    });
  }

  private async namesForEmails(emails: string[]) {
    const names = new Map<string, string>();
    if (emails.length === 0) return names;
    const users = await this.prisma.user.findMany({
      where: { OR: emails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })) },
      select: { email: true, name: true },
    });
    for (const user of users) names.set(user.email.toLowerCase(), user.name);
    return names;
  }

  private toInvite(
    row: { id: string; email: string; role: WorkspaceRole; status: string; invitedAt: Date; expiresAt: Date },
    name: string | null,
  ) {
    return {
      id: row.id,
      email: row.email,
      name,
      role: row.role,
      status: row.status,
      invitedAt: row.invitedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  private planMembers(
    members: { userId: string; role: 'ADMIN' | 'LEADER' | 'MEMBER' }[],
    ownerId: string,
  ) {
    const plan = new Map<string, 'ADMIN' | 'LEADER' | 'MEMBER'>();
    for (const member of members) {
      if (plan.has(member.userId)) {
        throw new BadRequestException('Danh sách thành viên bị trùng');
      }
      plan.set(member.userId, member.role);
    }
    plan.set(ownerId, 'ADMIN');
    return plan;
  }

  private async requireMembership(actor: AuthUser, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
    if (actor.role === 'ADMIN') return { workspace, role: 'ADMIN' as const };
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actor.id } },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenException('Bạn không thuộc workspace này');
    }
    return { workspace, role: member.role };
  }

  private assertAdmin(actor: AuthUser) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ quản trị viên xem được danh sách workspace.');
    }
  }

  private toItem(row: WorkspaceRow) {
    return {
      id: row.id,
      workspaceId: row.id,
      name: row.name,
      icon: row.icon,
      hasIcon: Boolean(row.iconMime),
      description: row.description,
      ownerId: row.ownerId,
      ownerName: row.owner.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      memberCount: row._count.members,
      accessType: row.accessType,
      status: row.status,
    };
  }
}
