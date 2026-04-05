import { Request, Response, NextFunction } from 'express';
import { successResponse, errorResponse } from '@m-bank/shared-types';
import { ValidationError } from '@m-bank/shared-utils';
import * as authService from '../services/auth.service';
import * as tokenService from '../services/token.service';
import { loginSchema, refreshSchema } from '../validators/auth.validator';

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const result = await authService.login(parsed.data.username, parsed.data.password);

    res.json(successResponse({
      tokens: result.tokens,
      user: result.user,
    }));
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const tokens = await authService.refresh(parsed.data.userId, parsed.data.refreshToken);
    res.json(successResponse({ tokens }));
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json(errorResponse('Unauthorized'));
      return;
    }

    await authService.logout(userId);
    res.json(successResponse({ message: 'Logged out successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.headers.authorization?.slice(7);
    if (!token) {
      res.status(401).json(errorResponse('No token provided'));
      return;
    }

    const payload = tokenService.verifyAccessToken(token);
    res.json(successResponse({ valid: true, user: payload }));
  } catch (err) {
    res.status(401).json(errorResponse('Invalid or expired token'));
  }
}
