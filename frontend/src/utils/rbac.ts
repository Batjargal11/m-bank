const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  SYSTEM_ADMIN: [
    'invoice:create', 'invoice:read', 'invoice:update', 'invoice:delete',
    'invoice:send', 'invoice:view', 'invoice:pay', 'invoice:cancel',
    'payment:create', 'payment:read', 'payment:approve', 'payment:reject',
    'audit:read', 'user:manage', 'org:manage', 'integration:retry', 'report:view',
  ],
  BANK_OPERATOR: [
    'invoice:view', 'integration:retry', 'report:view', 'audit:read',
  ],
  CORPORATE_MAKER: [
    'invoice:create', 'invoice:read', 'invoice:update', 'invoice:send', 'invoice:view',
    'payment:read',
  ],
  CORPORATE_APPROVER: [
    'invoice:read', 'invoice:view', 'invoice:cancel',
    'payment:read', 'payment:approve', 'payment:reject',
  ],
  CORPORATE_USER: [
    'invoice:read', 'invoice:view', 'invoice:pay',
    'payment:create', 'payment:read',
  ],
} as const;

export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function canAccessRoute(role: string, route: string): boolean {
  const routePermissions: Record<string, string> = {
    '/invoices/create': 'invoice:create',
    '/audit': 'audit:read',
  };

  const requiredPermission = routePermissions[route];
  if (!requiredPermission) return true;
  return hasPermission(role, requiredPermission);
}

export function hasRole(userRole: string, requiredRoles: readonly string[]): boolean {
  return requiredRoles.includes(userRole);
}
