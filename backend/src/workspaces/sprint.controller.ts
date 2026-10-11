import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateSprintDto } from './dto/task.dto.js';
import { SprintService } from './sprint.service.js';

@Controller('workspaces/:workspaceId')
@UseGuards(JwtAuthGuard)
export class SprintController {
  constructor(private readonly sprints: SprintService) {}

  @Get('sprints')
  list(@Req() request: { user: AuthUser }, @Param('workspaceId') workspaceId: string) {
    return this.sprints.list(request.user, workspaceId);
  }

  @Post('spaces/:spaceId/sprints')
  create(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprints.create(request.user, workspaceId, spaceId, dto);
  }

  @Post('sprints/:sprintId/start')
  start(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('sprintId') sprintId: string,
  ) {
    return this.sprints.start(request.user, workspaceId, sprintId);
  }

  @Post('sprints/:sprintId/close')
  close(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('sprintId') sprintId: string,
  ) {
    return this.sprints.close(request.user, workspaceId, sprintId);
  }
}
