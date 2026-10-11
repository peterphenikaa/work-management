import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationService } from './notification.service.js';

@Controller('workspaces/:workspaceId/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@Req() request: { user: AuthUser }, @Param('workspaceId') workspaceId: string) {
    return this.notifications.list(request.user, workspaceId);
  }

  @Post('read-all')
  readAll(@Req() request: { user: AuthUser }, @Param('workspaceId') workspaceId: string) {
    return this.notifications.markAllRead(request.user, workspaceId);
  }

  @Post(':id/read')
  read(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(request.user, workspaceId, id);
  }
}
