import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateCheckDto, CreateCommentDto, UpdateCheckDto } from './dto/task.dto.js';
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { MAX_ATTACHMENT_BYTES, TaskActivityService, type UploadedBlob } from './task-activity.service.js';

@Controller('workspaces/:workspaceId/spaces/:spaceId/tasks/:taskId')
@UseGuards(JwtAuthGuard)
export class TaskActivityController {
  constructor(private readonly activity: TaskActivityService) {}

  @Get('checks')
  checks(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.activity.checks(request.user, workspaceId, spaceId, taskId);
  }

  @Post('checks')
  addCheck(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCheckDto,
  ) {
    return this.activity.addCheck(request.user, workspaceId, spaceId, taskId, dto);
  }

  @Patch('checks/:checkId')
  updateCheck(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @Param('checkId') checkId: string,
    @Body() dto: UpdateCheckDto,
  ) {
    return this.activity.updateCheck(request.user, workspaceId, spaceId, taskId, checkId, dto);
  }

  @Delete('checks/:checkId')
  removeCheck(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @Param('checkId') checkId: string,
  ) {
    return this.activity.removeCheck(request.user, workspaceId, spaceId, taskId, checkId);
  }

  @Get('comments')
  comments(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.activity.comments(request.user, workspaceId, spaceId, taskId);
  }

  @Post('comments')
  addComment(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.activity.addComment(request.user, workspaceId, spaceId, taskId, dto);
  }

  @Get('attachments')
  attachments(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.activity.attachments(request.user, workspaceId, spaceId, taskId);
  }

  @Post('attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES + 1, files: 1 } }))
  upload(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @UploadedFile() file?: UploadedBlob,
  ) {
    return this.activity.upload(request.user, workspaceId, spaceId, taskId, file);
  }

  @Get('attachments/:attachmentId/download')
  async download(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const file = await this.activity.download(request.user, workspaceId, spaceId, taskId, attachmentId);
    // Luôn tải về (attachment) và chặn đoán kiểu nội dung để tệp tải lên không chạy được trong trình duyệt.
    return new StreamableFile(file.data, {
      type: 'application/octet-stream',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      length: file.data.length,
    });
  }

  @Delete('attachments/:attachmentId')
  remove(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.activity.removeAttachment(request.user, workspaceId, spaceId, taskId, attachmentId);
  }
}
