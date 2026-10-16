import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateSpaceDto } from './dto/create-space.dto.js';
import { UpdateSpaceDto } from './dto/update-space.dto.js';
import { CreateListDto, UpdateListDto } from './dto/list.dto.js';
import { BulkUpdateTasksDto, CreateTaskDto, UpdateSpaceSettingsDto, UpdateTaskDto } from './dto/task.dto.js';
import { SpaceService } from './space.service.js';

@Controller('workspaces/:workspaceId/spaces')
@UseGuards(JwtAuthGuard)
export class SpaceController {
  constructor(private readonly spaces: SpaceService) {}

  @Get()
  list(@Req() request: { user: AuthUser }, @Param('workspaceId') workspaceId: string) {
    return this.spaces.list(request.user, workspaceId);
  }

  @Get('detailed')
  detailed(@Req() request: { user: AuthUser }, @Param('workspaceId') workspaceId: string) {
    return this.spaces.detailedList(request.user, workspaceId);
  }

  @Patch(':spaceId/settings')
  settings(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Body() dto: UpdateSpaceSettingsDto,
  ) {
    return this.spaces.updateSettings(request.user, workspaceId, spaceId, dto);
  }

  @Get(':spaceId')
  get(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
  ) {
    return this.spaces.get(request.user, workspaceId, spaceId);
  }

  @Post(':spaceId/lists')
  createList(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Body() dto: CreateListDto,
  ) {
    return this.spaces.createList(request.user, workspaceId, spaceId, dto);
  }

  @Patch(':spaceId/lists/:listId')
  updateList(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('listId') listId: string,
    @Body() dto: UpdateListDto,
  ) {
    return this.spaces.updateList(request.user, workspaceId, spaceId, listId, dto);
  }

  @Post(':spaceId/tasks')
  createTask(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.spaces.createTask(request.user, workspaceId, spaceId, dto);
  }

  @Post(':spaceId/tasks/bulk')
  bulkUpdateTasks(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Body() dto: BulkUpdateTasksDto,
  ) {
    return this.spaces.bulkUpdateTasks(request.user, workspaceId, spaceId, dto);
  }

  @Patch(':spaceId/tasks/:taskId')
  updateTask(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.spaces.updateTask(request.user, workspaceId, spaceId, taskId, dto);
  }

  @Delete(':spaceId/tasks/:taskId')
  removeTask(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.spaces.removeTask(request.user, workspaceId, spaceId, taskId);
  }

  @Patch(':spaceId')
  update(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.spaces.update(request.user, workspaceId, spaceId, dto);
  }

  @Post(':spaceId/archive')
  archive(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
  ) {
    return this.spaces.archive(request.user, workspaceId, spaceId);
  }

  @Post(':spaceId/restore')
  restore(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
  ) {
    return this.spaces.restore(request.user, workspaceId, spaceId);
  }

  @Delete(':spaceId')
  remove(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
  ) {
    return this.spaces.remove(request.user, workspaceId, spaceId);
  }

  @Post()
  create(
    @Req() request: { user: AuthUser },
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateSpaceDto,
  ) {
    return this.spaces.create(request.user, workspaceId, dto);
  }
}
