import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSpaceDto } from './dto/create-space.dto.js';

@Injectable()
export class SpaceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, workspaceId: string) {
    this.assertAdmin(actor);
    await this.requireWorkspace(workspaceId);
    const rows = await this.prisma.space.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { members: true, statuses: true } } },
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
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE', userId: { in: memberIds } },
      select: { userId: true, role: true },
    });
    if (memberships.length !== memberIds.length) {
      throw new BadRequestException('Có thành viên không thuộc Workspace');
    }
    if (dto.accessType === 'PRIVATE') {
      const eligible = memberships.some((row) => row.role === 'LEADER' || row.role === 'MEMBER');
      if (!eligible) {
        throw new BadRequestException('Space riêng tư cần ít nhất một Trưởng nhóm hoặc Thành viên');
      }
    }

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
