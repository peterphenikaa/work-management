import type { Role } from "@/lib/api";

export type MineWorkspace = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  hasIcon: boolean;
  role: Role;
  memberCount: number;
};

const COLORS = ["#0C66E4", "#6E5DC6", "#159B91", "#E56910", "#AE4787", "#334563"];

export function workspaceColor(name: string) {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return COLORS[hash % COLORS.length];
}
