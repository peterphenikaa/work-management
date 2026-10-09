export const ROLES = ['ADMIN', 'LEADER', 'MEMBER'] as const;
export type Role = (typeof ROLES)[number];

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};
