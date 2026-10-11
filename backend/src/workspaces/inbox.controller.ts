import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationService } from './notification.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  inbox(@Req() request: { user: AuthUser }) {
    return this.notifications.inbox(request.user);
  }

  @Post('read-all')
  readAll(@Req() request: { user: AuthUser }) {
    return this.notifications.markAllOwnRead(request.user);
  }

  @Post(':id/read')
  read(@Req() request: { user: AuthUser }, @Param('id') id: string) {
    return this.notifications.markOwnRead(request.user, id);
  }
}
