import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  summary(@Req() request: { user: AuthUser }) {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ quản trị viên xem được tổng quan này');
    }
    return this.dashboard.summary();
  }
}
