"use client";

import TaskDialog from "@/components/spaces/task-detail";
import { useMemberData } from "@/components/member/member-data";

// Chi tiết task ở chế độ Member: chỉ xem, đổi trạng thái (nếu được giao), checklist và bình luận.
// Nếu task không còn nằm trong phạm vi được xem thì không mở (kiểm tra lại quyền, BR-M02).
export function MemberTaskDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const data = useMemberData();
  const task = data?.tasks.find((item) => item.id === taskId);
  const space = data?.spaces.find((item) => item.id === task?.spaceId);
  if (!data || !task || !space) return null;
  return (
    <TaskDialog
      key={task.id}
      memberMode
      workspaceId={data.workspaceId}
      spaceId={space.id}
      workspaceName={data.workspaceName}
      spaceName={space.name}
      lists={space.lists}
      statuses={space.statuses}
      members={space.members}
      task={task}
      presetListId={task.listId}
      currentUserId={data.userId}
      onClose={onClose}
      onSaved={() => {
        onClose();
        void data.refresh();
      }}
    />
  );
}

// M05: Member tạo nhanh công việc, chỉ khi Space bật quyền. Server vẫn kiểm tra lại (người báo cáo = chính Member).
export function MemberCreateTaskDialog({ spaceId, presetStatusId, presetListId, onClose }: { spaceId: string; presetStatusId?: string; presetListId?: string; onClose: () => void }) {
  const data = useMemberData();
  const space = data?.spaces.find((item) => item.id === spaceId);
  if (!data || !space || !space.memberCanCreateTask || space.lists.length === 0) return null;
  const people = space.members.some((member) => member.userId === data.userId) ? space.members : [...space.members, { userId: data.userId, name: "Bạn" }];
  return (
    <TaskDialog
      memberMode
      workspaceId={data.workspaceId}
      spaceId={space.id}
      workspaceName={data.workspaceName}
      spaceName={space.name}
      lists={space.lists}
      statuses={space.statuses}
      members={people}
      task={null}
      presetListId={presetListId || space.lists[0].id}
      presetStatusId={presetStatusId}
      currentUserId={data.userId}
      onClose={onClose}
      onSaved={() => {
        onClose();
        void data.refresh();
      }}
    />
  );
}
