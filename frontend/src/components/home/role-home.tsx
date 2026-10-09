"use client";

import { AppShell, useShellUser } from "@/components/shell/app-shell";
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

  return (
    <section className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-[#626f86]">{user.name}</p>
      <h1 className="mt-2 text-2xl font-semibold">{ROLE_LABEL[user.role]}</h1>
    </section>
  );
}
