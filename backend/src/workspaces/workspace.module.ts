import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InboxController } from './inbox.controller.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { SpaceController } from './space.controller.js';
import { SpaceService } from './space.service.js';
import { SprintController } from './sprint.controller.js';
import { SprintService } from './sprint.service.js';
import { TaskActivityController } from './task-activity.controller.js';
import { TaskActivityService } from './task-activity.service.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WorkspaceController, SpaceController, TaskActivityController, SprintController, NotificationController, InboxController],
  providers: [WorkspaceService, SpaceService, NotificationService, TaskActivityService, SprintService],
})
export class WorkspaceModule {}
