import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { DeleteWorkspaceDto } from './dto/delete-workspace.dto.js';
import { InviteMemberDto, UpdateInvitationDto } from './dto/invitation.dto.js';
import { ListWorkspacesQuery } from './dto/list-workspaces.query.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { WorkspaceService } from './workspace.service.js';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get()
  list(@Req() request: { user: AuthUser }, @Query() query: ListWorkspacesQuery) {
    return this.workspaces.list(request.user, query);
  }

  @Get('people')
  people(@Req() request: { user: AuthUser }) {
    return this.workspaces.people(request.user);
  }

  @Get('invitations/mine')
  myInvitations(@Req() request: { user: AuthUser }) {
    return this.workspaces.myInvitations(request.user);
  }

  @Post('invitations/:invitationId/accept')
  acceptInvitation(@Req() request: { user: AuthUser }, @Param('invitationId') invitationId: string) {
    return this.workspaces.acceptInvitation(request.user, invitationId);
  }

  @Get(':id/icon')
  async icon(@Req() request: { user: AuthUser }, @Param('id') id: string) {
    const file = await this.workspaces.readIcon(request.user, id);
    return new StreamableFile(file.data, { type: file.mime });
  }

  @Post(':id/icon')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  setIcon(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
    @UploadedFile() file?: { mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('Chưa chọn biểu tượng');
    return this.workspaces.setIcon(request.user, id, file);
  }

  @Get(':id/members')
  members(@Req() request: { user: AuthUser }, @Param('id') id: string) {
    return this.workspaces.members(request.user, id);
  }

  @Get(':id/invitations')
  invitations(@Req() request: { user: AuthUser }, @Param('id') id: string) {
    return this.workspaces.invitations(request.user, id);
  }

  @Post(':id/invitations')
  invite(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaces.invite(request.user, id, dto);
  }

  @Patch(':id/invitations/:invitationId')
  updateInvitation(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @Body() dto: UpdateInvitationDto,
  ) {
    return this.workspaces.updateInvitation(request.user, id, invitationId, dto.role);
  }

  @Delete(':id/invitations/:invitationId')
  revokeInvitation(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspaces.revokeInvitation(request.user, id, invitationId);
  }

  @Post()
  create(@Req() request: { user: AuthUser }, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(request.user, dto);
  }

  @Patch(':id')
  update(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(request.user, id, dto);
  }

  @Delete(':id')
  remove(
    @Req() request: { user: AuthUser },
    @Param('id') id: string,
    @Body() dto: DeleteWorkspaceDto,
  ) {
    return this.workspaces.remove(request.user, id, dto);
  }
}


