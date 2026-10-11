"use client";

import { useSearchParams } from "next/navigation";
import { LeaderProjects } from "@/components/leader/leader-projects";
import { MemberDashboard } from "@/components/member/member-dashboard";
import { useMemberData } from "@/components/member/member-data";
import { MemberNotifications } from "@/components/member/member-notifications";
import { MemberSprint } from "@/components/member/member-sprint";
import { MemberTasks } from "@/components/member/member-tasks";

export function MemberWorkspace() {
  const data = useMemberData();
  const tab = useSearchParams().get("tab") ?? "dashboard";
  if (!data) return null;

  if (tab === "projects") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <LeaderProjects workspaceId={data.workspaceId} workspaceName={data.workspaceName} readOnly />
      </div>
    );
  }
  if (tab === "board" || tab === "list") return <MemberTasks key={tab} view={tab} />;
  if (tab === "sprint") return <MemberSprint />;
  if (tab === "notifications") return <MemberNotifications />;
  return <MemberDashboard />;
}
