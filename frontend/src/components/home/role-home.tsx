"use client";

import { AdminDashboard } from "@/components/home/admin-dashboard";
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

  return (
    <section className="flex min-h-full flex-col">
      <WorkspaceInvites inset />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-[#626f86]">{user.name}</p>
        <h1 className="mt-2 text-2xl font-semibold">{ROLE_LABEL[user.role]}</h1>
      </div>
    </section>
  );
}
