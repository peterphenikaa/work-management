import type { Role } from "@/lib/api";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  LEADER: "Trưởng nhóm",
  MEMBER: "Thành viên",
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "N";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
