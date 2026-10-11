"use client";

import { AdminDashboard } from "@/components/home/admin-dashboard";
import { LeaderDashboard } from "@/components/leader/leader-dashboard";
import { useLeader } from "@/components/leader/leader-shell";
import { MemberWorkspace } from "@/components/member/member-workspace";
import { AppShell, useShellUser } from "@/components/shell/app-shell";
import { WorkspaceInvites } from "@/components/workspaces/workspace-invites";
import { ROLE_LABEL } from "@/lib/roles";

export function RoleHome() {
  return (
    <AppShell>
      <RoleHomeBody />
    </AppShell>
  );
}

function RoleHomeBody() {
  const user = useShellUser();
  if (!user) return null;

  if (user.role === "ADMIN") {
    return <AdminDashboard />;
  }

  return <MemberHome name={user.name} roleLabel={ROLE_LABEL[user.role]} />;
}

function MemberHome({ name, roleLabel }: { name: string; roleLabel: string }) {
  const leader = useLeader();
  if (leader?.current) {
    return (
      <>
        <WorkspaceInvites inset onAccepted={(workspaceId) => void leader.reload(workspaceId)} />
        {leader.current.role === "MEMBER" ? <MemberWorkspace /> : <LeaderDashboard />}
      </>
    );
  }

  return (
    <section className="flex min-h-full flex-col">
      <WorkspaceInvites inset onAccepted={(workspaceId) => void leader?.reload(workspaceId)} />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-[#626f86]">{name}</p>
        <h1 className="mt-2 text-2xl font-semibold">{roleLabel}</h1>
      </div>
    </section>
  );
}
