import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { statusBucket } from '../common/status-bucket.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSprintDto } from './dto/task.dto.js';
import { SpaceService } from './space.service.js';

const ORDER = { ACTIVE: 0, PLANNED: 1, CLOSED: 2 } as const;

@Injectable()
export class SprintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpaceService,
  ) {}

  // Mọi vai trò xem được Sprint trong các Space mình có quyền truy cập.
  async list(actor: AuthUser, workspaceId: string) {
    const access = await this.spaces.requireMembership(actor, workspaceId);
    const rows = await this.prisma.sprint.findMany({
      where: { space: { workspaceId, deletedAt: null, ...access.scope } },
      include: {
        space: { select: { name: true } },
        tasks: { where: { deletedAt: null }, select: { status: { select: { name: true } } } },
      },
    });
    const items = rows
      .map((row) => ({
        id: row.id,
        spaceId: row.spaceId,
        spaceName: row.space.name,
        name: row.name,
        goal: row.goal,
        status: row.status,
        startAt: row.startAt ? row.startAt.toISOString() : null,
        endAt: row.endAt ? row.endAt.toISOString() : null,
        total: row.tasks.length,
        done: row.tasks.filter((task) => statusBucket(task.status.name) === 'DONE').length,
        createdAt: row.createdAt,
      }))
      .sort((left, right) => ORDER[left.status] - ORDER[right.status] || right.createdAt.getTime() - left.createdAt.getTime())
      .map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
    return { items };
  }

  async create(actor: AuthUser, workspaceId: string, spaceId: string, dto: CreateSprintDto) {
    await this.spaces.requireLeader(actor, workspaceId);
    await this.spaces.requireSpace(workspaceId, spaceId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    const created = await this.prisma.sprint.create({
      data: { spaceId, name: dto.name, goal: dto.goal ?? null, startAt, endAt },
    });
    return { id: created.id };
  }

  async start(actor: AuthUser, workspaceId: string, sprintId: string) {
    await this.spaces.requireLeader(actor, workspaceId);
    const sprint = await this.require(workspaceId, sprintId);
    if (sprint.status !== 'PLANNED') throw new BadRequestException('Chỉ bắt đầu được Sprint đang ở trạng thái chuẩn bị');
    const active = await this.prisma.sprint.findFirst({ where: { spaceId: sprint.spaceId, status: 'ACTIVE' } });
    if (active) throw new BadRequestException(`Space đang có Sprint "${active.name}" chạy, hãy đóng trước khi bắt đầu Sprint mới`);
    await this.prisma.sprint.update({ where: { id: sprintId }, data: { status: 'ACTIVE' } });
    return { id: sprintId, status: 'ACTIVE' as const };
  }

  // Đóng Sprint: việc chưa xong quay về backlog để lập kế hoạch lại.
  async close(actor: AuthUser, workspaceId: string, sprintId: string) {
    await this.spaces.requireLeader(actor, workspaceId);
    const sprint = await this.require(workspaceId, sprintId);
    if (sprint.status !== 'ACTIVE') throw new BadRequestException('Chỉ đóng được Sprint đang chạy');
    const tasks = await this.prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      select: { id: true, status: { select: { name: true } } },
    });
    const unfinished = tasks.filter((task) => statusBucket(task.status.name) !== 'DONE').map((task) => task.id);
    await this.prisma.$transaction([
      this.prisma.sprint.update({ where: { id: sprintId }, data: { status: 'CLOSED' } }),
      this.prisma.task.updateMany({ where: { id: { in: unfinished } }, data: { sprintId: null } }),
    ]);
    return { id: sprintId, status: 'CLOSED' as const, returnedToBacklog: unfinished.length };
  }

  private async require(workspaceId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, space: { workspaceId, deletedAt: null } },
    });
    if (!sprint) throw new NotFoundException('Không tìm thấy Sprint');
    return sprint;
  }
}
