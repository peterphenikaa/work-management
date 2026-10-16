import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCheckDto, CreateCommentDto, UpdateCheckDto } from './dto/task.dto.js';
import { NotificationService } from './notification.service.js';
import { SpaceService } from './space.service.js';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_TASK = 20;

export type UploadedBlob = { originalname: string; mimetype: string; size: number; buffer: Buffer };

function safeName(name: string) {
  // Multer đọc tên tệp theo latin1; đổi lại về UTF-8 để giữ dấu tiếng Việt.
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  const cleaned = (decoded.includes('\ufffd') ? name : decoded).replace(/[\\/:*?"<>|\r\n]+/g, '_').trim();
  return (cleaned || 'tep-dinh-kem').slice(0, 160);
}

@Injectable()
export class TaskActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpaceService,
    private readonly notifications: NotificationService,
  ) {}

  async checks(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string) {
    await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const rows = await this.prisma.taskCheckItem.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
    });
    return { items: rows.map((row) => this.presentCheck(row)) };
  }

  async addCheck(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string, dto: CreateCheckDto) {
    await this.spaces.requireWritableWorkspace(workspaceId);
    await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const count = await this.prisma.taskCheckItem.count({ where: { taskId } });
    if (count >= 50) throw new BadRequestException('Checklist tối đa 50 mục');
    const created = await this.prisma.taskCheckItem.create({
      data: { taskId, title: dto.title, position: count },
    });
    return this.presentCheck(created);
  }

  async updateCheck(
    actor: AuthUser,
    workspaceId: string,
    spaceId: string,
    taskId: string,
    checkId: string,
    dto: UpdateCheckDto,
  ) {
    await this.spaces.requireWritableWorkspace(workspaceId);
    await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const current = await this.prisma.taskCheckItem.findFirst({ where: { id: checkId, taskId } });
    if (!current) throw new NotFoundException('Không tìm thấy mục checklist');
    const updated = await this.prisma.taskCheckItem.update({
      where: { id: current.id },
      data: {
        title: dto.title ?? current.title,
        done: dto.done ?? current.done,
      },
    });
    return this.presentCheck(updated);
  }

  async removeCheck(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string, checkId: string) {
    await this.spaces.requireWritableWorkspace(workspaceId);
    await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const current = await this.prisma.taskCheckItem.findFirst({ where: { id: checkId, taskId } });
    if (!current) throw new NotFoundException('Không tìm thấy mục checklist');
    await this.prisma.taskCheckItem.delete({ where: { id: current.id } });
    return { ok: true };
  }

  private presentCheck(row: { id: string; title: string; done: boolean }) {
    return { id: row.id, title: row.title, done: row.done };
  }

  async comments(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string) {
    await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const rows = await this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { author: { select: { name: true } } },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        body: row.body,
        authorId: row.authorId,
        authorName: row.author.name,
        mentionIds: row.mentionIds,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async addComment(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string, dto: CreateCommentDto) {
    await this.spaces.requireWritableWorkspace(workspaceId);
    const { task } = await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const mentionIds = await this.mentionable(workspaceId, spaceId, task.space.accessType, dto.mentionIds ?? []);
    const created = await this.prisma.taskComment.create({
      data: { taskId, authorId: actor.id, kind: 'COMMENT', body: dto.body, mentionIds },
    });

    const common = { actorId: actor.id, workspaceId, spaceId, taskId };
    await this.notifications.notify({
      ...common,
      userIds: mentionIds,
      type: 'MENTION',
      title: `${actor.name} đã nhắc đến bạn trong ${task.code}`,
      body: dto.body.slice(0, 200),
    });
    await this.notifications.notify({
      ...common,
      userIds: [task.assigneeId, task.reporterId].filter((id) => !mentionIds.includes(id ?? '')),
      type: 'COMMENT',
      title: `${actor.name} đã bình luận trong ${task.code}`,
      body: dto.body.slice(0, 200),
    });

    return {
      id: created.id,
      kind: created.kind,
      body: created.body,
      authorId: actor.id,
      authorName: actor.name,
      mentionIds,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async attachments(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string) {
    await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const rows = await this.prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: { uploader: { select: { name: true } } },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        mime: row.mime,
        size: row.size,
        uploaderId: row.uploaderId,
        uploaderName: row.uploader.name,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async upload(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string, file?: UploadedBlob) {
    await this.spaces.requireWritableWorkspace(workspaceId);
    const { task } = await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    if (!file || file.size === 0) throw new BadRequestException('Chưa chọn tệp hoặc tệp rỗng');
    if (file.size > MAX_ATTACHMENT_BYTES) throw new BadRequestException('Tệp tối đa 5 MB');
    const count = await this.prisma.taskAttachment.count({ where: { taskId } });
    if (count >= MAX_ATTACHMENTS_PER_TASK) throw new BadRequestException('Mỗi công việc tối đa 20 tệp');

    const fileName = safeName(file.originalname);
    const created = await this.prisma.$transaction(async (tx) => {
      const attachment = await tx.taskAttachment.create({
        data: {
          taskId,
          uploaderId: actor.id,
          fileName,
          mime: file.mimetype || 'application/octet-stream',
          size: file.size,
          file: { create: { data: new Uint8Array(file.buffer) } },
        },
      });
      await tx.taskComment.create({
        data: { taskId, authorId: actor.id, kind: 'EVENT', body: `đã đính kèm tệp "${fileName}"` },
      });
      return attachment;
    });
    await this.notifications.notify({
      actorId: actor.id,
      workspaceId,
      spaceId,
      taskId,
      userIds: [task.assigneeId, task.reporterId],
      type: 'COMMENT',
      title: `${actor.name} đã đính kèm tệp vào ${task.code}`,
      body: fileName,
    });
    return {
      id: created.id,
      fileName: created.fileName,
      mime: created.mime,
      size: created.size,
      uploaderId: actor.id,
      uploaderName: actor.name,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async download(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string, attachmentId: string) {
    await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const row = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
      include: { file: true },
    });
    if (!row || !row.file) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    return { fileName: row.fileName, mime: row.mime, data: Buffer.from(row.file.data) };
  }

  async removeAttachment(actor: AuthUser, workspaceId: string, spaceId: string, taskId: string, attachmentId: string) {
    await this.spaces.requireWritableWorkspace(workspaceId);
    const { access } = await this.spaces.requireTaskAccess(actor, workspaceId, spaceId, taskId);
    const row = await this.prisma.taskAttachment.findFirst({ where: { id: attachmentId, taskId } });
    if (!row) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    if (row.uploaderId !== actor.id && access.role === 'MEMBER') {
      throw new ForbiddenException('Chỉ người tải lên hoặc trưởng nhóm mới xóa được tệp');
    }
    await this.prisma.taskAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  }

  // Chỉ cho nhắc đến những người thật sự có quyền xem Space này (BR-M06).
  private async mentionable(workspaceId: string, spaceId: string, accessType: 'PRIVATE' | 'PUBLIC', ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const [members, spaceMembers] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE', userId: { in: unique } },
        select: { userId: true, role: true },
      }),
      this.prisma.spaceMember.findMany({ where: { spaceId, userId: { in: unique } }, select: { userId: true } }),
    ]);
    const inSpace = new Set(spaceMembers.map((row) => row.userId));
    return members
      .filter((row) => row.role !== 'MEMBER' || accessType === 'PUBLIC' || inSpace.has(row.userId))
      .map((row) => row.userId);
  }
}
