export enum UserRole {
  CORPORATE_USER = 'CORPORATE_USER',
  CORPORATE_APPROVER = 'CORPORATE_APPROVER',
  CORPORATE_MAKER = 'CORPORATE_MAKER',
  BANK_OPERATOR = 'BANK_OPERATOR',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  [UserRole.CORPORATE_MAKER]: ['invoice:create', 'invoice:send', 'invoice:view'],
  [UserRole.CORPORATE_USER]: ['invoice:view', 'invoice:pay'],
  [UserRole.CORPORATE_APPROVER]: ['invoice:view', 'payment:approve', 'invoice:cancel'],
  [UserRole.BANK_OPERATOR]: ['invoice:view', 'integration:retry', 'report:view'],
  [UserRole.SYSTEM_ADMIN]: [
    'invoice:create', 'invoice:send', 'invoice:view', 'invoice:pay', 'invoice:cancel',
    'payment:approve', 'integration:retry', 'report:view', 'user:manage', 'org:manage',
  ],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export interface User {
  user_id: string;
  org_id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: UserRole;
  username: string;
}
