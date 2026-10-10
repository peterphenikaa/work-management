import { WorkspaceScreen } from "@/components/workspaces/workspace-screen";
import { AppShell } from "@/components/shell/app-shell";

export default function WorkspacesPage() {
  return (
    <AppShell>
      <WorkspaceScreen />
    </AppShell>
  );
}
