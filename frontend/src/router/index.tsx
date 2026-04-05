import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { hasPermission, hasRole } from '@/utils/rbac';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  readonly children: ReactNode;
  readonly requiredPermission?: string;
  readonly requiredRole?: readonly string[];
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && !hasRole(user.role, requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
