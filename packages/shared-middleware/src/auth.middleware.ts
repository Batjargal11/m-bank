import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole, hasPermission } from '@m-bank/shared-types';
import { UnauthorizedError, ForbiddenError } from '@m-bank/shared-utils';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      correlationId?: string;
    }
  }
}

export function authMiddleware(jwtSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing or invalid authorization header'));
    }

    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      req.user = decoded;
      next();
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userRole = req.user.role as UserRole;
    const allowed = permissions.some((perm) => hasPermission(userRole, perm));
    if (!allowed) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(new ForbiddenError('Insufficient role'));
    }

    next();
  };
}
