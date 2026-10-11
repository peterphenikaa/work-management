import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(actor: AuthUser, raw: string | undefined) {
    const needle = raw?.trim() ?? '';
    if (needle.length < 2) return { items: [] };

    const space: Prisma.SpaceWhereInput = { deletedAt: null, workspace: { deletedAt: null } };
    if (actor.role !== 'ADMIN') {
      const memberships = await this.prisma.workspaceMember.findMany({
        where: { userId: actor.id, status: 'ACTIVE', workspace: { deletedAt: null } },
        select: { workspaceId: true, role: true },
      });
      const open = memberships.filter((row) => row.role !== 'MEMBER').map((row) => row.workspaceId);
      const limited = memberships.filter((row) => row.role === 'MEMBER').map((row) => row.workspaceId);
      if (open.length === 0 && limited.length === 0) return { items: [] };
      space.OR = [
        { workspaceId: { in: open } },
        {
          workspaceId: { in: limited },
          OR: [{ accessType: 'PUBLIC' }, { members: { some: { userId: actor.id } } }],
        },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        space,
        OR: [
          { title: { contains: needle, mode: 'insensitive' } },
          { code: { contains: needle, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        code: true,
        title: true,
        list: { select: { name: true } },
        space: { select: { id: true, name: true, workspace: { select: { id: true, name: true } } } },
      },
    });

    return {
      items: tasks.map((task) => ({
        taskId: task.id,
        code: task.code,
        title: task.title,
        listName: task.list.name,
        spaceId: task.space.id,
        spaceName: task.space.name,
        workspaceId: task.space.workspace.id,
        workspaceName: task.space.workspace.name,
      })),
    };
  }
}
