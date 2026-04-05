import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createLogger } from '@m-bank/shared-utils';

const logger = createLogger('api-gateway:auth');

const PUBLIC_PATHS: readonly string[] = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/health',
];

interface JwtPayload {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly orgId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isPublicPath(req.path)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error: unknown) {
    const message = error instanceof jwt.TokenExpiredError
      ? 'Token has expired'
      : 'Invalid token';

    logger.warn({ error, path: req.path }, 'JWT verification failed');

    res.status(401).json({
      success: false,
      data: null,
      error: message,
    });
  }
}
