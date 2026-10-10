import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateSpaceDto } from './dto/create-space.dto.js';
import { SpaceService } from './space.service.js';

@Controller('workspaces/:workspaceId/spaces')
@UseGuards(JwtAuthGuard)
export class SpaceController {
  constructor(private readonly spaces: SpaceService) {}

  @Get()
  list(@Req() request: { user: AuthUser }, @Param('workspaceId') workspaceId: string) {
    return this.spaces.list(request.user, workspaceId);
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
